/**
 * Kubernetes RBAC engine for the RBAC Simulator.
 *
 * Answers the question people actually ask: can this subject do this verb on
 * this resource in this namespace, and why. The "why" is the whole point. A
 * yes or no is what `kubectl auth can-i` already gives you; what it does not
 * give you is the rule that granted it, or the reason a binding you were sure
 * about did not apply.
 *
 * Three behaviours in here are the ones that confuse people, and all three are
 * modelled explicitly rather than glossed:
 *
 *   * A ClusterRole bound with a RoleBinding is scoped to that RoleBinding's
 *     namespace. The permissions are cluster-wide in definition and namespaced
 *     in effect, which is the single most surprising thing in RBAC.
 *
 *   * There are no deny rules. Permissions only ever add, so "why can this
 *     service account do X" is never answered by finding the rule that allows
 *     it and assuming something else revokes it.
 *
 *   * A RoleBinding cannot grant a Role from another namespace, and a
 *     RoleBinding to a ClusterRole does not grant cluster-scoped resources.
 *
 * No Kubernetes and no network in this file: it is a pure function of the
 * objects you hand it, which is what makes every case testable.
 */

export type Verb =
  | "get"
  | "list"
  | "watch"
  | "create"
  | "update"
  | "patch"
  | "delete"
  | "deletecollection";

export const VERBS: Verb[] = [
  "get",
  "list",
  "watch",
  "create",
  "update",
  "patch",
  "delete",
  "deletecollection",
];

export interface PolicyRule {
  /** `[""]` is the core group. `["*"]` matches any group. */
  apiGroups: string[];
  /** Plural resource names, e.g. `pods`, `secrets`, `deployments`. `*` matches any. */
  resources: string[];
  verbs: (Verb | "*")[];
  /** When set, the rule only covers objects with these exact names. */
  resourceNames?: string[];
}

export interface Role {
  kind: "Role" | "ClusterRole";
  name: string;
  /** Set for a Role, absent for a ClusterRole. */
  namespace?: string;
  rules: PolicyRule[];
}

export interface Subject {
  kind: "ServiceAccount" | "User" | "Group";
  name: string;
  /** Required for a ServiceAccount; a User or Group is cluster-wide. */
  namespace?: string;
}

export interface Binding {
  kind: "RoleBinding" | "ClusterRoleBinding";
  name: string;
  /** Set for a RoleBinding, absent for a ClusterRoleBinding. */
  namespace?: string;
  roleRef: { kind: "Role" | "ClusterRole"; name: string };
  subjects: Subject[];
}

export interface Cluster {
  roles: Role[];
  bindings: Binding[];
}

export interface Question {
  subject: Subject;
  verb: Verb;
  resource: string;
  /** Absent means a cluster-scoped request, e.g. `kubectl get nodes`. */
  namespace?: string;
  /** Asking about one named object, e.g. a specific secret. */
  resourceName?: string;
  /** `""` for the core group. */
  apiGroup?: string;
}

export interface Explanation {
  allowed: boolean;
  /** The binding and rule that granted it, when allowed. */
  via?: {
    binding: Binding;
    role: Role;
    rule: PolicyRule;
    /** Where the permission applies, which is not always where the role says. */
    effectiveScope: string;
  };
  /** Bindings that name this subject but did not grant the request, and why. */
  nearMisses: { binding: Binding; reason: string }[];
  /** One line, in the terms a person would use. */
  summary: string;
  /** The command that asks Kubernetes the same question. */
  kubectl: string;
}

/** Do two subjects refer to the same identity? */
export function sameSubject(a: Subject, b: Subject): boolean {
  if (a.kind !== b.kind || a.name !== b.name) return false;
  // A ServiceAccount is namespaced, so the namespace is part of its identity.
  // A User or Group is cluster-wide and carries no namespace.
  if (a.kind === "ServiceAccount") return a.namespace === b.namespace;
  return true;
}

function matches(patterns: string[], value: string): boolean {
  return patterns.includes("*") || patterns.includes(value);
}

/** Does this rule cover the request, ignoring where it applies? */
export function ruleCovers(rule: PolicyRule, q: Question): boolean {
  const group = q.apiGroup ?? "";
  if (!matches(rule.apiGroups, group)) return false;
  if (!matches(rule.resources, q.resource)) return false;
  if (!rule.verbs.includes("*") && !rule.verbs.includes(q.verb)) return false;
  // resourceNames narrows a rule to specific objects, so it cannot answer a
  // question about the whole collection. A list or watch of one named object
  // is allowed if the request carries a metadata.name field selector; asking
  // about a named object here stands for that.
  if (rule.resourceNames && rule.resourceNames.length > 0) {
    if (!q.resourceName) return false;
    if (!rule.resourceNames.includes(q.resourceName)) return false;
  }
  return true;
}

/**
 * Where a binding's permissions actually apply.
 *
 * This is the function that encodes the surprising rule: a ClusterRole bound
 * by a RoleBinding is confined to that RoleBinding's namespace.
 */
export function effectiveScope(binding: Binding): { namespace?: string; clusterWide: boolean } {
  if (binding.kind === "ClusterRoleBinding") return { clusterWide: true };
  return { namespace: binding.namespace, clusterWide: false };
}

/** Resources that only exist at cluster scope, so a namespaced binding can never grant them. */
export const CLUSTER_SCOPED_RESOURCES = new Set([
  "nodes",
  "namespaces",
  "persistentvolumes",
  "clusterroles",
  "clusterrolebindings",
  "storageclasses",
  "customresourcedefinitions",
]);

export function isClusterScoped(resource: string): boolean {
  return CLUSTER_SCOPED_RESOURCES.has(resource);
}

/**
 * Answer a question against a cluster, and explain the answer.
 *
 * Every binding naming the subject is examined even after a match is found, so
 * the near-miss list can say why the binding someone expected to work did not.
 */
export function can(cluster: Cluster, q: Question): Explanation {
  const nearMisses: Explanation["nearMisses"] = [];
  let granted: Explanation["via"] | undefined;

  for (const binding of cluster.bindings) {
    if (!binding.subjects.some((s) => sameSubject(s, q.subject))) continue;

    const role = cluster.roles.find(
      (r) => r.kind === binding.roleRef.kind && r.name === binding.roleRef.name,
    );
    if (!role) {
      nearMisses.push({
        binding,
        reason: `refers to ${binding.roleRef.kind}/${binding.roleRef.name}, which does not exist. Kubernetes accepts this: a dangling roleRef grants nothing and raises no error.`,
      });
      continue;
    }

    // A RoleBinding can only name a Role in its own namespace.
    if (binding.kind === "RoleBinding" && role.kind === "Role" && role.namespace !== binding.namespace) {
      nearMisses.push({
        binding,
        reason: `is in ${binding.namespace} but Role/${role.name} is in ${role.namespace}. A RoleBinding can only grant a Role from its own namespace.`,
      });
      continue;
    }

    const scope = effectiveScope(binding);

    if (!scope.clusterWide && isClusterScoped(q.resource)) {
      nearMisses.push({
        binding,
        reason: `is a RoleBinding, so it only grants permissions inside ${binding.namespace}. ${q.resource} is a cluster-scoped resource and cannot be granted by a namespaced binding, even through a ClusterRole.`,
      });
      continue;
    }

    // A namespaced resource asked about at cluster scope means every namespace at once
    // (`kubectl get pods -A`), which no RoleBinding can grant.
    if (!scope.clusterWide && q.namespace === undefined) {
      nearMisses.push({
        binding,
        reason: `is a RoleBinding, so it only grants permissions inside ${binding.namespace}. A request across all namespaces needs a ClusterRoleBinding.`,
      });
      continue;
    }

    if (!scope.clusterWide && q.namespace !== undefined && scope.namespace !== q.namespace) {
      const detail =
        role.kind === "ClusterRole"
          ? `binds ClusterRole/${role.name}, but a RoleBinding confines it to ${binding.namespace}. The permissions are cluster-wide in definition and namespaced in effect.`
          : `only applies in ${binding.namespace}.`;
      nearMisses.push({ binding, reason: detail });
      continue;
    }

    const rule = role.rules.find((r) => ruleCovers(r, q));
    if (!rule) {
      nearMisses.push({
        binding,
        reason: `grants ${role.kind}/${role.name}, which has no rule covering ${q.verb} on ${q.resource}${describeNamed(q)}.`,
      });
      continue;
    }

    if (!granted) {
      granted = {
        binding,
        role,
        rule,
        effectiveScope: scope.clusterWide
          ? "every namespace, and cluster-scoped resources"
          : `namespace ${scope.namespace}`,
      };
    }
  }

  return {
    allowed: Boolean(granted),
    via: granted,
    nearMisses,
    summary: summarise(q, granted, nearMisses),
    kubectl: kubectlFor(q),
  };
}

function describeNamed(q: Question): string {
  return q.resourceName ? ` named ${q.resourceName}` : "";
}

function subjectLabel(s: Subject): string {
  return s.kind === "ServiceAccount" ? `${s.kind} ${s.namespace}/${s.name}` : `${s.kind} ${s.name}`;
}

function summarise(
  q: Question,
  granted: Explanation["via"] | undefined,
  nearMisses: Explanation["nearMisses"],
): string {
  const where = q.namespace
    ? ` in ${q.namespace}`
    : isClusterScoped(q.resource)
      ? " at cluster scope"
      : " across all namespaces";
  const what = `${q.verb} ${q.resource}${describeNamed(q)}${where}`;

  if (granted) {
    return `Yes. ${subjectLabel(q.subject)} can ${what}, granted by ${granted.binding.kind}/${granted.binding.name} through ${granted.role.kind}/${granted.role.name}, which applies to ${granted.effectiveScope}.`;
  }
  if (nearMisses.length === 0) {
    return `No. Nothing binds ${subjectLabel(q.subject)} to any role, so it has no permissions at all. RBAC has no deny rules; access is only ever added.`;
  }
  return `No. ${nearMisses.length} binding${nearMisses.length === 1 ? "" : "s"} name${nearMisses.length === 1 ? "s" : ""} this subject, but none grants ${what}.`;
}

/**
 * The command that asks the API server the same thing.
 *
 * A named object is `resource/name`, which is how kubectl takes it, not a
 * flag. A ServiceAccount impersonates as `system:serviceaccount:<ns>:<name>`,
 * which is the form the API server actually sees and the part people get wrong
 * when they try this by hand.
 */
export function kubectlFor(q: Question): string {
  // The group qualifies the resource type, before the name: deployments.apps/web.
  const type = q.apiGroup ? `${q.resource}.${q.apiGroup}` : q.resource;
  const target = q.resourceName ? `${type}/${q.resourceName}` : type;
  const parts = ["kubectl auth can-i", q.verb, target];

  // Without -n, kubectl asks about the current namespace, which would silently
  // answer a different question. A cluster-scoped resource takes no namespace;
  // a namespaced one asked about at cluster scope means all namespaces.
  if (q.namespace) parts.push(`-n ${q.namespace}`);
  else if (!isClusterScoped(q.resource)) parts.push("--all-namespaces");

  parts.push(
    q.subject.kind === "ServiceAccount"
      ? `--as=system:serviceaccount:${q.subject.namespace}:${q.subject.name}`
      : q.subject.kind === "Group"
        ? `--as=system:anonymous --as-group=${q.subject.name}`
        : `--as=${q.subject.name}`,
  );
  return parts.join(" ");
}

/** Every verb this subject has on a resource, for the "what can it do" view. */
export function allowedVerbs(cluster: Cluster, q: Omit<Question, "verb">): Verb[] {
  return VERBS.filter((verb) => can(cluster, { ...q, verb }).allowed);
}

export interface Scenario {
  id: string;
  label: string;
  /** What this one is here to show. */
  teaches: string;
  cluster: Cluster;
  /** The question to ask first, chosen to land on the lesson. */
  question: Question;
}

const sa = (name: string, namespace: string): Subject => ({ kind: "ServiceAccount", name, namespace });

const READ_PODS: PolicyRule = { apiGroups: [""], resources: ["pods"], verbs: ["get", "list", "watch"] };

export const SCENARIOS: Scenario[] = [
  {
    id: "namespaced",
    label: "The ordinary case",
    teaches:
      "A Role and a RoleBinding in the same namespace. Everything applies exactly where you put it, which is the mental model people then over-apply.",
    cluster: {
      roles: [{ kind: "Role", name: "pod-reader", namespace: "dev", rules: [READ_PODS] }],
      bindings: [
        {
          kind: "RoleBinding",
          name: "ci-reads-pods",
          namespace: "dev",
          roleRef: { kind: "Role", name: "pod-reader" },
          subjects: [sa("ci", "dev")],
        },
      ],
    },
    question: { subject: sa("ci", "dev"), verb: "list", resource: "pods", namespace: "dev" },
  },
  {
    id: "clusterrole-rolebinding",
    label: "The one that surprises everyone",
    teaches:
      "A ClusterRole bound by a RoleBinding. The permissions are cluster-wide in definition and namespaced in effect: this grants pods in dev and nowhere else. Ask the same question about prod.",
    cluster: {
      roles: [{ kind: "ClusterRole", name: "pod-reader", rules: [READ_PODS] }],
      bindings: [
        {
          kind: "RoleBinding",
          name: "ci-reads-pods-in-dev",
          namespace: "dev",
          roleRef: { kind: "ClusterRole", name: "pod-reader" },
          subjects: [sa("ci", "dev")],
        },
      ],
    },
    question: { subject: sa("ci", "dev"), verb: "list", resource: "pods", namespace: "prod" },
  },
  {
    id: "cluster-scoped",
    label: "Nodes are not in a namespace",
    teaches:
      "The same ClusterRole, the same RoleBinding, but asking about nodes. A namespaced binding can never grant a cluster-scoped resource, however broad the role is.",
    cluster: {
      roles: [
        {
          kind: "ClusterRole",
          name: "node-reader",
          rules: [{ apiGroups: [""], resources: ["nodes"], verbs: ["get", "list"] }],
        },
      ],
      bindings: [
        {
          kind: "RoleBinding",
          name: "ci-reads-nodes",
          namespace: "dev",
          roleRef: { kind: "ClusterRole", name: "node-reader" },
          subjects: [sa("ci", "dev")],
        },
      ],
    },
    question: { subject: sa("ci", "dev"), verb: "list", resource: "nodes" },
  },
  {
    id: "resource-names",
    label: "One secret, not the list",
    teaches:
      "resourceNames narrows a rule to named objects. This grants get on that one secret and nothing on the collection: a plain list of secrets is denied. (List can be limited to a name too, with a metadata.name field selector, but only if the rule also has the list verb.) Switch the verb to list.",
    cluster: {
      roles: [
        {
          kind: "Role",
          name: "db-secret-reader",
          namespace: "dev",
          rules: [
            {
              apiGroups: [""],
              resources: ["secrets"],
              verbs: ["get"],
              resourceNames: ["db-password"],
            },
          ],
        },
      ],
      bindings: [
        {
          kind: "RoleBinding",
          name: "app-reads-db-secret",
          namespace: "dev",
          roleRef: { kind: "Role", name: "db-secret-reader" },
          subjects: [sa("app", "dev")],
        },
      ],
    },
    question: {
      subject: sa("app", "dev"),
      verb: "get",
      resource: "secrets",
      namespace: "dev",
      resourceName: "db-password",
    },
  },
  {
    id: "typo",
    label: "The silent typo",
    teaches:
      "The binding refers to a role that does not exist. Kubernetes accepts it, raises no error, and grants nothing. There is no event and no warning; the only symptom is a permission that never works.",
    cluster: {
      roles: [{ kind: "Role", name: "pod-reader", namespace: "dev", rules: [READ_PODS] }],
      bindings: [
        {
          kind: "RoleBinding",
          name: "ci-reads-pods",
          namespace: "dev",
          roleRef: { kind: "Role", name: "pod-readr" },
          subjects: [sa("ci", "dev")],
        },
      ],
    },
    question: { subject: sa("ci", "dev"), verb: "list", resource: "pods", namespace: "dev" },
  },
  {
    id: "no-deny",
    label: "There is no deny",
    teaches:
      "Two bindings: one grants read on pods, the other grants nothing. Permissions only ever add, so the empty role cannot take anything away. If you are looking for the rule that revoked access, there isn't one.",
    cluster: {
      roles: [
        { kind: "Role", name: "pod-reader", namespace: "dev", rules: [READ_PODS] },
        { kind: "Role", name: "read-only-audit", namespace: "dev", rules: [] },
      ],
      bindings: [
        {
          kind: "RoleBinding",
          name: "ci-reads-pods",
          namespace: "dev",
          roleRef: { kind: "Role", name: "pod-reader" },
          subjects: [sa("ci", "dev")],
        },
        {
          kind: "RoleBinding",
          name: "ci-audit",
          namespace: "dev",
          roleRef: { kind: "Role", name: "read-only-audit" },
          subjects: [sa("ci", "dev")],
        },
      ],
    },
    question: { subject: sa("ci", "dev"), verb: "delete", resource: "pods", namespace: "dev" },
  },
  {
    id: "cluster-wide",
    label: "Genuinely cluster-wide",
    teaches:
      "The same ClusterRole, bound with a ClusterRoleBinding instead. Now it reaches every namespace, including kube-system. This is the one to be careful with.",
    cluster: {
      roles: [{ kind: "ClusterRole", name: "pod-reader", rules: [READ_PODS] }],
      bindings: [
        {
          kind: "ClusterRoleBinding",
          name: "ci-reads-pods-everywhere",
          roleRef: { kind: "ClusterRole", name: "pod-reader" },
          subjects: [sa("ci", "dev")],
        },
      ],
    },
    question: { subject: sa("ci", "dev"), verb: "list", resource: "pods", namespace: "kube-system" },
  },
];

/** Namespaces the picker offers. Arbitrary, but these are what people call them. */
export const NAMESPACES = ["dev", "staging", "prod", "kube-system"];

/** Resources the picker offers, with the api group each one lives in. */
export const RESOURCES: { name: string; apiGroup: string }[] = [
  { name: "pods", apiGroup: "" },
  { name: "secrets", apiGroup: "" },
  { name: "configmaps", apiGroup: "" },
  { name: "services", apiGroup: "" },
  { name: "deployments", apiGroup: "apps" },
  { name: "nodes", apiGroup: "" },
  { name: "namespaces", apiGroup: "" },
];
