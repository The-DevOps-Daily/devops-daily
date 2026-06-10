import type { Metadata } from 'next';
import KubernetesNetworkingCniSimulator from '@/components/games/kubernetes-networking-cni-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('kubernetes-networking-cni-simulator');
}

function KubernetesNetworkingEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About this Kubernetes networking simulator</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>How Pods communicate by Pod IP on the same node and across nodes</li>
            <li>What a CNI plugin does when a Pod network namespace is created</li>
            <li>Why ClusterIP Services are virtual IPs that map to real endpoint Pods</li>
            <li>How EndpointSlices connect Service selectors to concrete backend addresses</li>
            <li>Where kube-proxy, IPVS, iptables, and eBPF-style service routing fit</li>
            <li>How Ingress, LoadBalancer, and NodePort traffic reaches a backend Pod</li>
            <li>How externalTrafficPolicy changes source IP preservation and routing tradeoffs</li>
            <li>Why NetworkPolicy requires enforcement by a capable networking plugin</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Packet paths covered</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Pod networking:</strong> same-node and cross-node
              Pod-to-Pod flows
            </li>
            <li>
              <strong className="text-foreground">Service networking:</strong> DNS, ClusterIP,
              EndpointSlices, endpoint selection, headless Services, and reply tracking
            </li>
            <li>
              <strong className="text-foreground">Edge traffic:</strong> external client to
              LoadBalancer, NodePort, Ingress, Service, and Pod
            </li>
            <li>
              <strong className="text-foreground">Security:</strong> default-deny, allow rules,
              egress controls, and CNI policy enforcement
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">CNI vs Service routing</h4>
        <p className="text-sm text-muted-foreground">
          CNI plugins make Pod networking work: interfaces, IPAM, routes, overlays or native
          routing, and often policy. Kubernetes Services are a separate abstraction that map stable
          virtual IPs and DNS names to changing endpoint Pods.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Browser-safe by design</h4>
        <p className="text-sm text-muted-foreground">
          This simulator does not connect to a real cluster. It models the packet path and dataplane
          decisions in the browser so you can learn how Kubernetes networking behaves before
          debugging iptables, eBPF maps, CNI agents, or cloud load balancers in production.
        </p>
      </div>
    </>
  );
}

export default function KubernetesNetworkingCniSimulatorPage() {
  return (
    <SimulatorShell
      slug="kubernetes-networking-cni-simulator"
      fallbackTitle="Kubernetes Networking / CNI Simulator"
      fallbackDescription="Visualize Kubernetes networking and CNI packet paths. Learn Pod-to-Pod routing, ClusterIP Services, kube-proxy, eBPF, Ingress, NetworkPolicy, and egress in an interactive browser simulator."
      educational={<KubernetesNetworkingEducational />}
      shareText="Learn Kubernetes networking and CNI packet paths with this interactive simulator."
    >
      <KubernetesNetworkingCniSimulator />
    </SimulatorShell>
  );
}
