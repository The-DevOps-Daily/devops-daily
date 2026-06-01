import type { Metadata } from 'next';
import KubernetesTerminalSimulator from '@/components/games/kubernetes-terminal-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('kubernetes-terminal-simulator');
}

function KubernetesTerminalEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About this Kubernetes simulator</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>How kubectl targets a cluster through kubeconfig contexts</li>
            <li>The relationship between Nodes, Pods, Deployments, ReplicaSets, and Services</li>
            <li>How labels and selectors connect workloads to stable network endpoints</li>
            <li>How scaling and rolling updates change desired state</li>
            <li>How logs, describe, exec, and events help during debugging</li>
            <li>How ConfigMaps and cleanup workflows fit into daily operations</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Key commands covered</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Cluster:</strong> kubectl version, config
              current-context, cluster-info, get nodes
            </li>
            <li>
              <strong className="text-foreground">Workloads:</strong> create deployment, get pods,
              get deployments
            </li>
            <li>
              <strong className="text-foreground">Networking:</strong> expose deployment, get svc,
              describe service
            </li>
            <li>
              <strong className="text-foreground">Operations:</strong> scale, rollout status, set
              image, logs, describe, exec, events
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Browser-safe by design</h4>
        <p className="text-sm text-muted-foreground">
          This lab does not connect to a real Kubernetes cluster. It models Kubernetes API objects
          in the browser so you can practice commands, see cause and effect, and build confidence
          before using kubectl against shared environments.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Why learn Kubernetes this way?</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>Kubernetes can feel abstract until you see how controllers reconcile state.</li>
          <li>Most day-to-day debugging starts with a small set of repeatable kubectl commands.</li>
          <li>Understanding Pods, Deployments, Services, and Events makes production incidents less mysterious.</li>
        </ul>
      </div>
    </>
  );
}

export default function KubernetesTerminalSimulatorPage() {
  return (
    <SimulatorShell
      slug="kubernetes-terminal-simulator"
      fallbackTitle="Kubernetes Terminal Simulator"
      fallbackDescription="Practice Kubernetes commands in an interactive browser terminal. Learn kubectl contexts, nodes, Pods, Deployments, Services, rollouts, logs, exec, events, ConfigMaps, and cleanup workflows."
      educational={<KubernetesTerminalEducational />}
      shareText="Practice kubectl in a browser with this interactive Kubernetes Terminal Simulator."
    >
      <KubernetesTerminalSimulator />
    </SimulatorShell>
  );
}
