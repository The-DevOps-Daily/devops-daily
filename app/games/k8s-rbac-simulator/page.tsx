import type { Metadata } from 'next';
import K8sRbacSimulator from '@/components/games/k8s-rbac-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('k8s-rbac-simulator');
}

const seoLearningPoints = [
  'Why a ClusterRole bound with a RoleBinding only works in one namespace',
  'The difference between Role and ClusterRole, and RoleBinding and ClusterRoleBinding',
  'Why a namespaced binding can never grant access to nodes or other cluster-scoped resources',
  'Why `resourceNames` lets you `get` an object but never `list` the collection',
  'That RBAC has no deny rules, so permissions only ever add',
  'Why a typo in a `roleRef` fails silently, with no error and no event',
  'How a ServiceAccount is identified, and why its namespace is part of its name',
  'What an empty `apiGroups: [""]` means, and when you need `apps` instead',
  'How to ask the same question of a real cluster with `kubectl auth can-i`',
  'How to read a denial and find the binding that was supposed to grant it',
];

function RbacEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About this Kubernetes RBAC simulator</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              That the answer to &quot;why can this service account not list pods&quot; is almost
              always about scope, not about the rules
            </li>
            <li>That a ClusterRole is cluster-wide in definition and only as wide as the binding that grants it</li>
            <li>That there is no deny rule to find, so a refusal means nothing granted it in the first place</li>
            <li>The mistakes that produce silence instead of an error, which are the expensive ones</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">How it works</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>The evaluation is real and runs in your browser. Nothing here is a canned answer.</li>
            <li>Every answer names the binding and rule responsible, or explains why each candidate did not apply.</li>
            <li>Each question prints the matching `kubectl auth can-i`, so it teaches the real tool.</li>
            <li>Change the namespace on the same cluster and watch the answer flip.</li>
          </ul>
        </div>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        The behaviour here follows the{' '}
        <a
          href="https://kubernetes.io/docs/reference/access-authn-authz/rbac/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Kubernetes RBAC documentation
        </a>
        . One detail is worth stating plainly because it is the source of most confusion: a{' '}
        <code className="font-mono">RoleBinding</code> can reference a{' '}
        <code className="font-mono">ClusterRole</code>, and when it does, the permissions apply only
        inside that RoleBinding&apos;s namespace. The role is defined once and granted narrowly. That
        is a feature, since it lets you define <code className="font-mono">view</code> or{' '}
        <code className="font-mono">edit</code> once and hand them out per namespace, but it catches
        people who expect &quot;cluster&quot; in the name to mean cluster-wide.
      </p>

      <p className="mt-4 text-sm text-muted-foreground">
        Reading about RBAC only gets you so far, and the fastest way to make it stick is to break it
        on a cluster you do not mind breaking. A managed cluster is the cheapest way to get one:{' '}
        <a
          href="https://m.do.co/c/2a9bba940f39"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          DigitalOcean Kubernetes
        </a>{' '}
        gives you a conformant cluster in a few minutes, and RBAC behaves identically there to
        anywhere else, so every scenario on this page can be reproduced with{' '}
        <code className="font-mono">kubectl apply</code> and checked with{' '}
        <code className="font-mono">kubectl auth can-i</code>. That is a referral link, and
        DigitalOcean sponsors this site.
      </p>

      <p className="mt-4 text-sm text-muted-foreground">
        Related: the{' '}
        <a href="/games/kubernetes-terminal-simulator" className="underline">
          Kubernetes terminal simulator
        </a>{' '}
        for the commands themselves, and the{' '}
        <a href="/games/yaml-parsing-simulator" className="underline">
          YAML parsing simulator
        </a>{' '}
        for the other way a manifest can mean something you did not write.
      </p>
    </>
  );
}

export default function Page() {
  return (
    <SimulatorShell
      slug="k8s-rbac-simulator"
      educational={<RbacEducational />}
      seoLearningPoints={seoLearningPoints}
    >
      <K8sRbacSimulator />
    </SimulatorShell>
  );
}
