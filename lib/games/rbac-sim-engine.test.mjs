/**
 * Engine correctness test for the Kubernetes RBAC Simulator.
 *
 * Run with:  npx tsx lib/games/rbac-sim-engine.test.mjs
 *
 * These assert the behaviour the simulator teaches. The cases that matter most
 * are the ones where RBAC does something people do not expect, because a
 * simulator that is confidently wrong about those is worse than no simulator.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SCENARIOS,
  RESOURCES,
  can,
  ruleCovers,
  effectiveScope,
  sameSubject,
  allowedVerbs,
  kubectlFor,
  isClusterScoped,
} from "./rbac-sim-engine.ts";

const sa = (name, namespace) => ({ kind: "ServiceAccount", name, namespace });

/** Read pods in the core group. */
const readPods = {
  apiGroups: [""],
  resources: ["pods"],
  verbs: ["get", "list", "watch"],
};

// ---------------------------------------------------------------------------
// The ordinary case
// ---------------------------------------------------------------------------

test("a RoleBinding to a Role grants inside that namespace", () => {
  const cluster = {
    roles: [{ kind: "Role", name: "pod-reader", namespace: "dev", rules: [readPods] }],
    bindings: [
      {
        kind: "RoleBinding",
        name: "read-pods",
        namespace: "dev",
        roleRef: { kind: "Role", name: "pod-reader" },
        subjects: [sa("ci", "dev")],
      },
    ],
  };
  const r = can(cluster, { subject: sa("ci", "dev"), verb: "list", resource: "pods", namespace: "dev" });
  assert.equal(r.allowed, true);
  assert.equal(r.via.role.name, "pod-reader");
  assert.match(r.summary, /^Yes\./);
});

test("and grants nothing in another namespace", () => {
  const cluster = {
    roles: [{ kind: "Role", name: "pod-reader", namespace: "dev", rules: [readPods] }],
    bindings: [
      {
        kind: "RoleBinding",
        name: "read-pods",
        namespace: "dev",
        roleRef: { kind: "Role", name: "pod-reader" },
        subjects: [sa("ci", "dev")],
      },
    ],
  };
  const r = can(cluster, { subject: sa("ci", "dev"), verb: "list", resource: "pods", namespace: "prod" });
  assert.equal(r.allowed, false);
  assert.match(r.nearMisses[0].reason, /only applies in dev/);
});

// ---------------------------------------------------------------------------
// The one that surprises everyone
// ---------------------------------------------------------------------------

test("a ClusterRole bound by a RoleBinding is confined to that namespace", () => {
  // The single most surprising thing in RBAC: the role is cluster-wide in
  // definition and namespaced in effect.
  const cluster = {
    roles: [{ kind: "ClusterRole", name: "pod-reader", rules: [readPods] }],
    bindings: [
      {
        kind: "RoleBinding",
        name: "read-pods-in-dev",
        namespace: "dev",
        roleRef: { kind: "ClusterRole", name: "pod-reader" },
        subjects: [sa("ci", "dev")],
      },
    ],
  };

  const inDev = can(cluster, { subject: sa("ci", "dev"), verb: "list", resource: "pods", namespace: "dev" });
  assert.equal(inDev.allowed, true);
  assert.equal(inDev.via.effectiveScope, "namespace dev");

  const inProd = can(cluster, { subject: sa("ci", "dev"), verb: "list", resource: "pods", namespace: "prod" });
  assert.equal(inProd.allowed, false);
  assert.match(inProd.nearMisses[0].reason, /cluster-wide in definition and namespaced in effect/);
});

test("the same ClusterRole bound by a ClusterRoleBinding reaches every namespace", () => {
  const cluster = {
    roles: [{ kind: "ClusterRole", name: "pod-reader", rules: [readPods] }],
    bindings: [
      {
        kind: "ClusterRoleBinding",
        name: "read-pods-everywhere",
        roleRef: { kind: "ClusterRole", name: "pod-reader" },
        subjects: [sa("ci", "dev")],
      },
    ],
  };
  for (const namespace of ["dev", "prod", "kube-system"]) {
    assert.equal(
      can(cluster, { subject: sa("ci", "dev"), verb: "list", resource: "pods", namespace }).allowed,
      true,
      `should be allowed in ${namespace}`,
    );
  }
});

test("a RoleBinding cannot grant a cluster-scoped resource, even through a ClusterRole", () => {
  const cluster = {
    roles: [
      { kind: "ClusterRole", name: "node-reader", rules: [{ apiGroups: [""], resources: ["nodes"], verbs: ["list"] }] },
    ],
    bindings: [
      {
        kind: "RoleBinding",
        name: "nodes-in-dev",
        namespace: "dev",
        roleRef: { kind: "ClusterRole", name: "node-reader" },
        subjects: [sa("ci", "dev")],
      },
    ],
  };
  const r = can(cluster, { subject: sa("ci", "dev"), verb: "list", resource: "nodes" });
  assert.equal(r.allowed, false);
  assert.match(r.nearMisses[0].reason, /cluster-scoped resource/);
});

// ---------------------------------------------------------------------------
// There are no deny rules
// ---------------------------------------------------------------------------

test("permissions only ever add: a second binding cannot take one away", () => {
  // People coming from IAM or firewall rules look for the deny that explains a
  // refusal. There is not one.
  const cluster = {
    roles: [
      { kind: "Role", name: "reader", namespace: "dev", rules: [readPods] },
      { kind: "Role", name: "nothing", namespace: "dev", rules: [] },
    ],
    bindings: [
      {
        kind: "RoleBinding",
        name: "a",
        namespace: "dev",
        roleRef: { kind: "Role", name: "reader" },
        subjects: [sa("ci", "dev")],
      },
      {
        kind: "RoleBinding",
        name: "b",
        namespace: "dev",
        roleRef: { kind: "Role", name: "nothing" },
        subjects: [sa("ci", "dev")],
      },
    ],
  };
  const r = can(cluster, { subject: sa("ci", "dev"), verb: "get", resource: "pods", namespace: "dev" });
  assert.equal(r.allowed, true);
  // The empty role is reported as a near miss rather than as a denial.
  assert.equal(r.nearMisses.length, 1);
  assert.match(r.nearMisses[0].reason, /no rule covering/);
});

test("a subject with no bindings at all is refused, and told why", () => {
  const r = can({ roles: [], bindings: [] }, {
    subject: sa("nobody", "dev"),
    verb: "get",
    resource: "pods",
    namespace: "dev",
  });
  assert.equal(r.allowed, false);
  assert.match(r.summary, /no permissions at all/);
  assert.match(r.summary, /no deny rules/);
});

// ---------------------------------------------------------------------------
// Rule matching
// ---------------------------------------------------------------------------

test("an empty apiGroup means the core group", () => {
  const q = { subject: sa("x", "dev"), verb: "get", resource: "pods", namespace: "dev" };
  assert.equal(ruleCovers({ apiGroups: [""], resources: ["pods"], verbs: ["get"] }, q), true);
  assert.equal(ruleCovers({ apiGroups: ["apps"], resources: ["pods"], verbs: ["get"] }, q), false);
});

test("a resource in a named group needs that group", () => {
  const q = {
    subject: sa("x", "dev"),
    verb: "get",
    resource: "deployments",
    namespace: "dev",
    apiGroup: "apps",
  };
  assert.equal(ruleCovers({ apiGroups: ["apps"], resources: ["deployments"], verbs: ["get"] }, q), true);
  assert.equal(ruleCovers({ apiGroups: [""], resources: ["deployments"], verbs: ["get"] }, q), false);
});

test("a wildcard matches anything in its position", () => {
  const q = { subject: sa("x", "dev"), verb: "delete", resource: "secrets", namespace: "dev" };
  assert.equal(ruleCovers({ apiGroups: ["*"], resources: ["*"], verbs: ["*"] }, q), true);
});

test("resourceNames narrow a rule to named objects only", () => {
  const rule = {
    apiGroups: [""],
    resources: ["secrets"],
    verbs: ["get"],
    resourceNames: ["db-password"],
  };
  const base = { subject: sa("x", "dev"), verb: "get", resource: "secrets", namespace: "dev" };
  assert.equal(ruleCovers(rule, { ...base, resourceName: "db-password" }), true);
  assert.equal(ruleCovers(rule, { ...base, resourceName: "other" }), false);
  // Asking about the collection: a named rule cannot answer it, which is why
  // `list` never works with resourceNames.
  assert.equal(ruleCovers(rule, base), false);
});

test("a rule with resourceNames does not permit listing the collection", () => {
  const cluster = {
    roles: [
      {
        kind: "Role",
        name: "one-secret",
        namespace: "dev",
        rules: [
          { apiGroups: [""], resources: ["secrets"], verbs: ["get", "list"], resourceNames: ["db-password"] },
        ],
      },
    ],
    bindings: [
      {
        kind: "RoleBinding",
        name: "b",
        namespace: "dev",
        roleRef: { kind: "Role", name: "one-secret" },
        subjects: [sa("app", "dev")],
      },
    ],
  };
  assert.equal(
    can(cluster, { subject: sa("app", "dev"), verb: "get", resource: "secrets", namespace: "dev", resourceName: "db-password" }).allowed,
    true,
  );
  assert.equal(
    can(cluster, { subject: sa("app", "dev"), verb: "list", resource: "secrets", namespace: "dev" }).allowed,
    false,
  );
});

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

test("a ServiceAccount's namespace is part of its identity", () => {
  assert.equal(sameSubject(sa("ci", "dev"), sa("ci", "dev")), true);
  // Same name, different namespace: a different account entirely.
  assert.equal(sameSubject(sa("ci", "dev"), sa("ci", "prod")), false);
});

test("a User or Group is cluster-wide and carries no namespace", () => {
  assert.equal(sameSubject({ kind: "User", name: "ada" }, { kind: "User", name: "ada" }), true);
  assert.equal(sameSubject({ kind: "User", name: "ada" }, { kind: "Group", name: "ada" }), false);
});

test("a binding to one namespace's ServiceAccount does not grant another's", () => {
  const cluster = {
    roles: [{ kind: "Role", name: "reader", namespace: "dev", rules: [readPods] }],
    bindings: [
      {
        kind: "RoleBinding",
        name: "b",
        namespace: "dev",
        roleRef: { kind: "Role", name: "reader" },
        subjects: [sa("ci", "dev")],
      },
    ],
  };
  const r = can(cluster, { subject: sa("ci", "prod"), verb: "get", resource: "pods", namespace: "dev" });
  assert.equal(r.allowed, false);
  // Not even a near miss: the binding does not name this subject.
  assert.equal(r.nearMisses.length, 0);
});

// ---------------------------------------------------------------------------
// The mistakes that produce silence rather than an error
// ---------------------------------------------------------------------------

test("a dangling roleRef grants nothing and says so", () => {
  const cluster = {
    roles: [],
    bindings: [
      {
        kind: "RoleBinding",
        name: "typo",
        namespace: "dev",
        roleRef: { kind: "Role", name: "pod-readr" },
        subjects: [sa("ci", "dev")],
      },
    ],
  };
  const r = can(cluster, { subject: sa("ci", "dev"), verb: "get", resource: "pods", namespace: "dev" });
  assert.equal(r.allowed, false);
  assert.match(r.nearMisses[0].reason, /does not exist/);
  assert.match(r.nearMisses[0].reason, /raises no error/);
});

test("a RoleBinding cannot reach a Role in another namespace", () => {
  const cluster = {
    roles: [{ kind: "Role", name: "reader", namespace: "prod", rules: [readPods] }],
    bindings: [
      {
        kind: "RoleBinding",
        name: "b",
        namespace: "dev",
        roleRef: { kind: "Role", name: "reader" },
        subjects: [sa("ci", "dev")],
      },
    ],
  };
  const r = can(cluster, { subject: sa("ci", "dev"), verb: "get", resource: "pods", namespace: "dev" });
  assert.equal(r.allowed, false);
  assert.match(r.nearMisses[0].reason, /can only grant a Role from its own namespace/);
});

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

test("every binding naming the subject is examined, not just the first match", () => {
  // So the explanation can say why the binding someone expected did not work,
  // even when something else granted the request.
  const cluster = {
    roles: [
      { kind: "Role", name: "works", namespace: "dev", rules: [readPods] },
      { kind: "Role", name: "wrong-ns", namespace: "prod", rules: [readPods] },
    ],
    bindings: [
      {
        kind: "RoleBinding",
        name: "good",
        namespace: "dev",
        roleRef: { kind: "Role", name: "works" },
        subjects: [sa("ci", "dev")],
      },
      {
        kind: "RoleBinding",
        name: "broken",
        namespace: "dev",
        roleRef: { kind: "Role", name: "wrong-ns" },
        subjects: [sa("ci", "dev")],
      },
    ],
  };
  const r = can(cluster, { subject: sa("ci", "dev"), verb: "get", resource: "pods", namespace: "dev" });
  assert.equal(r.allowed, true);
  assert.equal(r.nearMisses.length, 1);
  assert.equal(r.nearMisses[0].binding.name, "broken");
});

test("allowedVerbs reports exactly what the rules permit", () => {
  const cluster = {
    roles: [{ kind: "Role", name: "reader", namespace: "dev", rules: [readPods] }],
    bindings: [
      {
        kind: "RoleBinding",
        name: "b",
        namespace: "dev",
        roleRef: { kind: "Role", name: "reader" },
        subjects: [sa("ci", "dev")],
      },
    ],
  };
  assert.deepEqual(allowedVerbs(cluster, { subject: sa("ci", "dev"), resource: "pods", namespace: "dev" }), [
    "get",
    "list",
    "watch",
  ]);
});

test("the kubectl command is the one you could actually paste", () => {
  assert.equal(
    kubectlFor({ subject: sa("ci", "dev"), verb: "list", resource: "pods", namespace: "dev" }),
    "kubectl auth can-i list pods -n dev --as=system:serviceaccount:dev:ci",
  );
  // A named object is resource/name, which is how kubectl takes it.
  assert.equal(
    kubectlFor({ subject: sa("app", "dev"), verb: "get", resource: "secrets", resourceName: "db-password", namespace: "dev" }),
    "kubectl auth can-i get secrets/db-password -n dev --as=system:serviceaccount:dev:app",
  );
  // No -n on a cluster-scoped question, or kubectl answers a different one.
  assert.equal(
    kubectlFor({ subject: { kind: "User", name: "ada" }, verb: "list", resource: "nodes" }),
    "kubectl auth can-i list nodes --as=ada",
  );
});

test("knows which resources only exist at cluster scope", () => {
  assert.equal(isClusterScoped("nodes"), true);
  assert.equal(isClusterScoped("namespaces"), true);
  assert.equal(isClusterScoped("pods"), false);
});

test("effectiveScope is where the permission lands, not where the role was defined", () => {
  assert.deepEqual(effectiveScope({ kind: "ClusterRoleBinding", name: "x", roleRef: { kind: "ClusterRole", name: "y" }, subjects: [] }), {
    clusterWide: true,
  });
  assert.deepEqual(
    effectiveScope({ kind: "RoleBinding", name: "x", namespace: "dev", roleRef: { kind: "ClusterRole", name: "y" }, subjects: [] }),
    { namespace: "dev", clusterWide: false },
  );
});

// ---------------------------------------------------------------------------
// The shipped scenarios must each land on the lesson they claim
// ---------------------------------------------------------------------------

test("every scenario's opening question demonstrates its point", () => {
  const expected = {
    namespaced: true,
    "clusterrole-rolebinding": false,
    "cluster-scoped": false,
    "resource-names": true,
    typo: false,
    "no-deny": false,
    "cluster-wide": true,
  };
  for (const s of SCENARIOS) {
    const r = can(s.cluster, s.question);
    assert.equal(
      r.allowed,
      expected[s.id],
      `${s.id} opens with allowed=${r.allowed}, expected ${expected[s.id]}`,
    );
  }
});

test("every refused scenario explains itself rather than just saying no", () => {
  for (const s of SCENARIOS) {
    const r = can(s.cluster, s.question);
    if (r.allowed) continue;
    const hasReason = r.nearMisses.length > 0 || /no permissions at all/.test(r.summary);
    assert.ok(hasReason, `${s.id} refuses without explaining why`);
  }
});

test("the surprising scenario is allowed in its own namespace and refused elsewhere", () => {
  // Pins the whole point of that scenario: same cluster, same subject, two
  // different answers depending only on the namespace asked about.
  const s = SCENARIOS.find((x) => x.id === "clusterrole-rolebinding");
  assert.equal(can(s.cluster, { ...s.question, namespace: "dev" }).allowed, true);
  assert.equal(can(s.cluster, { ...s.question, namespace: "prod" }).allowed, false);
});

test("the resourceNames scenario allows get and refuses list", () => {
  const s = SCENARIOS.find((x) => x.id === "resource-names");
  assert.equal(can(s.cluster, s.question).allowed, true);
  assert.equal(
    can(s.cluster, { ...s.question, verb: "list", resourceName: undefined }).allowed,
    false,
  );
});

test("every scenario names subjects and roles that exist, except the deliberate typo", () => {
  for (const s of SCENARIOS) {
    for (const b of s.cluster.bindings) {
      const role = s.cluster.roles.find(
        (r) => r.kind === b.roleRef.kind && r.name === b.roleRef.name,
      );
      if (s.id === "typo") continue;
      assert.ok(role, `${s.id}: ${b.name} points at a ${b.roleRef.kind} that is not defined`);
    }
  }
});

test("every resource the picker offers declares the right api group", () => {
  // deployments live in apps; getting this wrong makes the picker silently
  // ask a question the rules cannot match.
  const byName = Object.fromEntries(RESOURCES.map((r) => [r.name, r.apiGroup]));
  assert.equal(byName.pods, "");
  assert.equal(byName.secrets, "");
  assert.equal(byName.deployments, "apps");
  assert.equal(byName.nodes, "");
});
