'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Globe,
  Layers,
  LockKeyhole,
  Network,
  Play,
  RotateCcw,
  Route,
  Server,
  Shield,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type ScenarioId = 'same-node' | 'cross-node' | 'cluster-ip' | 'ingress' | 'network-policy' | 'egress';
type Dataplane = 'overlay' | 'direct' | 'ebpf';
type PacketTone = 'translated' | 'blocked' | 'external';

interface PacketStep {
  title: string;
  packet: string;
  explanation: string;
  mutation: string;
  highlights: string[];
  tone?: PacketTone;
}

interface Scenario {
  id: ScenarioId;
  title: string;
  subtitle: string;
  lesson: string;
  icon: LucideIcon;
  steps: PacketStep[];
}

const DATAPLANES: Record<
  Dataplane,
  {
    label: string;
    shortLabel: string;
    description: string;
    servicePath: string;
    crossNodePath: string;
  }
> = {
  overlay: {
    label: 'Overlay CNI',
    shortLabel: 'VXLAN',
    description:
      'Pod traffic keeps pod IPs inside the cluster packet, while cross-node hops can be wrapped in an outer node-to-node tunnel.',
    servicePath: 'kube-proxy programs iptables/IPVS rules for Service VIP translation.',
    crossNodePath: 'Node A encapsulates the pod packet, the underlay carries it to Node B, then Node B decapsulates it.',
  },
  direct: {
    label: 'Routed CNI',
    shortLabel: 'BGP / routes',
    description:
      'Pod CIDRs are routable through the node or fabric routing table, so cross-node pod traffic can travel without an overlay header.',
    servicePath: 'kube-proxy still handles ClusterIP translation unless the CNI replaces it.',
    crossNodePath: 'Node A routes directly to Node B because the fabric knows where the destination PodCIDR lives.',
  },
  ebpf: {
    label: 'eBPF CNI',
    shortLabel: 'eBPF',
    description:
      'eBPF programs can enforce policy and perform Service load balancing in the kernel datapath, sometimes replacing kube-proxy.',
    servicePath: 'The eBPF datapath can translate the Service VIP to a backend before iptables is involved.',
    crossNodePath: 'The packet takes native routing or tunneling, with eBPF programs applying policy and visibility at key hooks.',
  },
};

const SCENARIOS: Scenario[] = [
  {
    id: 'same-node',
    title: 'Pod to Pod, Same Node',
    subtitle: 'The simplest packet path',
    lesson: 'Pods get their own IPs. On the same node, traffic can move through veth pairs and local routing without a Service.',
    icon: Boxes,
    steps: [
      {
        title: 'Application opens a socket',
        packet: 'src=10.244.1.12:43152 -> dst=10.244.1.34:8080',
        explanation:
          'The frontend Pod sends directly to the backend Pod IP. This is normal Kubernetes networking: Pod IPs are first-class addresses inside the cluster.',
        mutation: 'No NAT. The destination is already a Pod IP.',
        highlights: ['pod-frontend', 'pod-api', 'same-node-link'],
      },
      {
        title: 'Packet exits the Pod namespace',
        packet: 'eth0 -> veth peer -> node network namespace',
        explanation:
          'The CNI plugin created the Pod interface and connected it to the node using a veth pair or an equivalent datapath.',
        mutation: 'The packet leaves the Pod, but source and destination IPs stay the same.',
        highlights: ['pod-frontend', 'cni-a', 'node-a'],
      },
      {
        title: 'Node routes locally',
        packet: 'node-a route lookup: 10.244.1.34 is local',
        explanation:
          'Because both Pods are on node-a, the kernel or CNI datapath can forward to the backend Pod interface locally.',
        mutation: 'No Service lookup is needed. No overlay tunnel is needed.',
        highlights: ['node-a', 'cni-a', 'pod-api', 'same-node-link'],
      },
      {
        title: 'Backend receives the packet',
        packet: 'backend sees src=10.244.1.12 -> dst=10.244.1.34',
        explanation:
          'The backend can identify the calling Pod by its Pod IP. That direct addressing is one of the core ideas behind Kubernetes networking.',
        mutation: 'Pod identity is preserved at L3.',
        highlights: ['pod-frontend', 'pod-api'],
      },
    ],
  },
  {
    id: 'cross-node',
    title: 'Pod to Pod, Cross Node',
    subtitle: 'Overlay, routed, or eBPF',
    lesson:
      'Cross-node traffic is where the CNI dataplane matters most: it must make PodCIDRs reachable across nodes.',
    icon: Route,
    steps: [
      {
        title: 'Frontend targets a remote Pod IP',
        packet: 'src=10.244.1.12 -> dst=10.244.2.21',
        explanation:
          'The app is still talking to a Pod IP. Kubernetes expects this to work across nodes without the app doing anything special.',
        mutation: 'The inner packet is a Pod-to-Pod packet.',
        highlights: ['pod-frontend', 'pod-payments', 'cross-node-link'],
      },
      {
        title: 'Node A finds the remote PodCIDR',
        packet: '10.244.2.0/24 belongs behind node-b',
        explanation:
          'The node routing table, CNI agent, or eBPF map tells the datapath that the destination Pod lives on node-b.',
        mutation: 'Next hop becomes node-b, but the inner destination remains the remote Pod IP.',
        highlights: ['node-a', 'cni-a', 'node-fabric', 'node-b'],
      },
      {
        title: 'CNI moves the packet between nodes',
        packet: 'node-a -> node-b transport',
        explanation:
          'Depending on the CNI mode, this may be VXLAN/IP-in-IP encapsulation, direct routing with BGP/static routes, or an eBPF-native path.',
        mutation: 'The node-to-node hop is implementation detail; the Pod packet is still addressed to 10.244.2.21.',
        highlights: ['cni-a', 'node-fabric', 'cni-b', 'cross-node-link'],
      },
      {
        title: 'Node B delivers to the Pod',
        packet: 'backend sees src=10.244.1.12 -> dst=10.244.2.21',
        explanation:
          'After decapsulation or route delivery, node-b forwards the packet to the payments Pod interface.',
        mutation: 'The destination Pod sees the source Pod IP, not a random node address.',
        highlights: ['node-b', 'cni-b', 'pod-payments'],
      },
    ],
  },
  {
    id: 'cluster-ip',
    title: 'ClusterIP Service',
    subtitle: 'Stable virtual IP to changing Pods',
    lesson:
      'Services give clients a stable virtual IP and DNS name while the datapath picks one healthy endpoint Pod.',
    icon: Layers,
    steps: [
      {
        title: 'DNS returns a Service VIP',
        packet: 'payments.default.svc.cluster.local -> 10.96.12.40',
        explanation:
          'CoreDNS returns the ClusterIP. That IP is virtual; it is not a Pod and usually not assigned to a real interface.',
        mutation: 'The app now targets a Service IP instead of a Pod IP.',
        highlights: ['pod-frontend', 'dns', 'service'],
        tone: 'translated',
      },
      {
        title: 'Packet leaves for the ClusterIP',
        packet: 'src=10.244.1.12 -> dst=10.96.12.40:443',
        explanation:
          'The client thinks it is connecting to one stable endpoint. Kubernetes dataplane rules handle the backend selection.',
        mutation: 'Destination is still the Service VIP at this moment.',
        highlights: ['pod-frontend', 'service', 'service-link'],
        tone: 'translated',
      },
      {
        title: 'Service translation picks an endpoint',
        packet: '10.96.12.40:443 -> 10.244.2.21:8443',
        explanation:
          'kube-proxy in iptables/IPVS mode or an eBPF replacement translates the virtual Service destination to a real endpoint Pod.',
        mutation: 'Destination IP and port are rewritten to the selected Pod endpoint.',
        highlights: ['service', 'kube-proxy', 'pod-payments'],
        tone: 'translated',
      },
      {
        title: 'Reply follows connection tracking',
        packet: 'reply returns as the same Service connection',
        explanation:
          'Connection tracking or reverse load balancing makes the reply line up with the client connection to the Service.',
        mutation: 'The client keeps its stable Service abstraction.',
        highlights: ['pod-payments', 'service', 'pod-frontend'],
        tone: 'translated',
      },
    ],
  },
  {
    id: 'ingress',
    title: 'Ingress to Pod',
    subtitle: 'North-south traffic path',
    lesson:
      'Ingress is HTTP routing at the edge. It normally points at Services, and Services point at endpoint Pods.',
    icon: Globe,
    steps: [
      {
        title: 'External client reaches the edge',
        packet: 'client -> load balancer / ingress IP',
        explanation:
          'Traffic from outside the cluster first reaches a load balancer, node port, or ingress controller endpoint.',
        mutation: 'The packet crosses from outside the cluster into the Kubernetes edge.',
        highlights: ['internet', 'ingress', 'ingress-link'],
        tone: 'external',
      },
      {
        title: 'Ingress applies HTTP routing',
        packet: 'Host: shop.example.com, Path: /checkout',
        explanation:
          'The ingress controller matches host and path rules, then forwards to the configured Service backend.',
        mutation: 'L7 routing chooses the payments Service.',
        highlights: ['ingress', 'service'],
        tone: 'external',
      },
      {
        title: 'Service chooses a backend Pod',
        packet: 'Service VIP -> endpoint 10.244.2.21:8443',
        explanation:
          'The Service still does endpoint selection. The ingress controller is not hard-coding individual Pod IPs.',
        mutation: 'Destination becomes the selected endpoint Pod.',
        highlights: ['service', 'kube-proxy', 'pod-payments'],
        tone: 'translated',
      },
      {
        title: 'Response returns through the edge',
        packet: 'pod -> service path -> ingress -> client',
        explanation:
          'Source IP preservation depends on the load balancer, proxy mode, and externalTrafficPolicy settings.',
        mutation: 'The user receives the response from the public edge, not from a Pod IP.',
        highlights: ['pod-payments', 'ingress', 'internet'],
        tone: 'external',
      },
    ],
  },
  {
    id: 'network-policy',
    title: 'NetworkPolicy',
    subtitle: 'Allowed is a policy decision',
    lesson:
      'NetworkPolicy is a Kubernetes API, but enforcement is done by a CNI plugin that supports policy.',
    icon: Shield,
    steps: [
      {
        title: 'No policy selects the backend',
        packet: 'frontend -> payments:8443 allowed',
        explanation:
          'If no NetworkPolicy selects a Pod, Kubernetes network policy semantics leave it non-isolated, assuming the cluster has no stricter external policy.',
        mutation: 'Traffic is allowed by default.',
        highlights: ['pod-frontend', 'pod-payments', 'policy'],
      },
      {
        title: 'Default deny isolates the backend',
        packet: 'frontend -> payments:8443 blocked',
        explanation:
          'Once a policy selects the payments Pod for ingress and has no matching allow rule, inbound traffic is denied.',
        mutation: 'The packet is dropped before the application sees it.',
        highlights: ['pod-frontend', 'policy', 'pod-payments'],
        tone: 'blocked',
      },
      {
        title: 'Allow rule matches labels and port',
        packet: 'allow from app=frontend to port 8443',
        explanation:
          'NetworkPolicy rules match peers, namespaces, IP blocks, ports, and direction. Labels are the stable control point.',
        mutation: 'The same packet is now allowed because it matches policy.',
        highlights: ['pod-frontend', 'policy', 'pod-payments'],
      },
      {
        title: 'CNI enforces the decision',
        packet: 'policy verdict: forward',
        explanation:
          'The API object alone does not filter packets. The CNI plugin must implement NetworkPolicy for the policy to have effect.',
        mutation: 'Policy enforcement happens in the datapath, not in the application.',
        highlights: ['cni-a', 'policy', 'cni-b'],
      },
    ],
  },
  {
    id: 'egress',
    title: 'Pod Egress to Internet',
    subtitle: 'Leaving the cluster',
    lesson:
      'Inside the cluster, Pod IPs are routable. On the internet, they usually are not, so egress commonly uses node SNAT or a gateway.',
    icon: Server,
    steps: [
      {
        title: 'Pod calls an external API',
        packet: 'src=10.244.1.12 -> dst=140.82.112.6:443',
        explanation:
          'The destination is outside the cluster CIDR, so the packet follows the node default route instead of the pod network route.',
        mutation: 'Destination is external; source is still the Pod IP inside the node.',
        highlights: ['pod-frontend', 'internet', 'egress-link'],
        tone: 'external',
      },
      {
        title: 'Node prepares internet egress',
        packet: 'SNAT 10.244.1.12 -> node-a primary IP',
        explanation:
          'Most clusters translate Pod source IPs to a node or gateway IP before sending traffic to the internet.',
        mutation: 'Source address changes so the external network has a return route.',
        highlights: ['node-a', 'cni-a', 'internet'],
        tone: 'translated',
      },
      {
        title: 'Egress policy can restrict destinations',
        packet: 'allow *.github.com:443, deny 0.0.0.0/0 otherwise',
        explanation:
          'Some CNIs can enforce egress policy before SNAT, preserving workload identity for policy decisions.',
        mutation: 'Policy decision happens before the packet leaves the cluster.',
        highlights: ['policy', 'pod-frontend', 'internet'],
        tone: 'blocked',
      },
      {
        title: 'Reply is tracked back to the Pod',
        packet: 'external API -> node IP -> 10.244.1.12',
        explanation:
          'Connection tracking maps the reply to the original Pod connection and returns it to the correct network namespace.',
        mutation: 'The Pod receives the response as if it talked directly to the external service.',
        highlights: ['internet', 'node-a', 'pod-frontend'],
        tone: 'external',
      },
    ],
  },
];

function getScenario(id: ScenarioId): Scenario {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? SCENARIOS[0]!;
}

function toneLabel(tone: PacketTone | undefined) {
  if (tone === 'translated') return 'translated';
  if (tone === 'blocked') return 'blocked';
  if (tone === 'external') return 'external';
  return 'forwarded';
}

export default function KubernetesNetworkingCniSimulator() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('same-node');
  const [dataplane, setDataplane] = useState<Dataplane>('overlay');
  const [stepIndex, setStepIndex] = useState(0);

  const scenario = getScenario(scenarioId);
  const step = scenario.steps[stepIndex] ?? scenario.steps[0]!;
  const progress = ((stepIndex + 1) / scenario.steps.length) * 100;
  const dataplaneCopy = DATAPLANES[dataplane];

  const scenarioCompletedCount = useMemo(() => {
    return stepIndex === scenario.steps.length - 1 ? 1 : 0;
  }, [scenario.steps.length, stepIndex]);

  const chooseScenario = (nextScenario: ScenarioId) => {
    setScenarioId(nextScenario);
    setStepIndex(0);
  };

  const nextStep = () => {
    setStepIndex((current) => (current < scenario.steps.length - 1 ? current + 1 : 0));
  };

  const previousStep = () => {
    setStepIndex((current) => (current > 0 ? current - 1 : scenario.steps.length - 1));
  };

  const reset = () => {
    setScenarioId('same-node');
    setDataplane('overlay');
    setStepIndex(0);
  };

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-md border bg-muted/20 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="rounded-md border border-primary/30 bg-primary/10 p-2 text-primary">
              <Network className="h-6 w-6" />
            </div>
            <div>
              <p className="font-mono text-xs text-muted-foreground">// packet path lab</p>
              <h2 className="text-2xl font-bold md:text-3xl">
                Kubernetes Networking / CNI Simulator
              </h2>
            </div>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Follow packets through Pod IP routing, CNI dataplanes, ClusterIP Services, kube-proxy
            or eBPF translation, Ingress, NetworkPolicy, and internet egress.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Current path</span>
              <span className="text-sm text-muted-foreground">
                Hop {stepIndex + 1}/{scenario.steps.length}
              </span>
            </div>
            <Progress value={progress} />
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="Nodes" value="2" />
              <Metric label="Pod CIDRs" value="2" />
              <Metric label="Dataplane" value={dataplaneCopy.shortLabel} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[310px_minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="h-5 w-5" />
                Packet Scenarios
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {SCENARIOS.map((candidate) => {
                const active = candidate.id === scenarioId;
                const Icon = candidate.icon;

                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => chooseScenario(candidate.id)}
                    className={cn(
                      'w-full rounded-md border p-2.5 text-left transition-colors',
                      active
                        ? 'border-primary/60 bg-primary/10'
                        : 'border-border hover:border-primary/40 hover:bg-muted/30'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn('rounded-md border p-1.5', active ? 'text-primary' : 'text-muted-foreground')}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{candidate.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{candidate.subtitle}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Route className="h-5 w-5" />
                CNI Dataplane
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              <div className="grid gap-2">
                {(Object.keys(DATAPLANES) as Dataplane[]).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    variant={dataplane === mode ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDataplane(mode)}
                    className="justify-start"
                  >
                    {DATAPLANES[mode].label}
                  </Button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">{dataplaneCopy.description}</p>
            </CardContent>
          </Card>

          <Button size="sm" variant="outline" onClick={reset} className="w-full">
            <RotateCcw className="mr-1 h-4 w-4" />
            Reset lab
          </Button>
        </div>

        <div className="space-y-4">
          <Card className="border-primary/40">
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{scenario.title}</Badge>
                    <Badge>{toneLabel(step.tone)}</Badge>
                  </div>
                  <p className="text-sm font-medium sm:text-base">{step.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{scenario.lesson}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={previousStep}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button size="sm" onClick={nextStep}>
                    <Play className="mr-1 h-4 w-4" />
                    Next hop
                  </Button>
                  <Button size="sm" variant="outline" onClick={nextStep}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Progress value={progress} />
            </CardContent>
          </Card>

          <NetworkCanvas step={step} dataplane={dataplane} scenarioId={scenarioId} />

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowRight className="h-5 w-5" />
                What happens at this hop
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 pt-0 md:grid-cols-2">
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Packet</p>
                <p className="mt-2 break-words font-mono text-sm">{step.packet}</p>
              </div>
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mutation</p>
                <p className="mt-2 text-sm text-muted-foreground">{step.mutation}</p>
              </div>
              <div className="rounded-md border border-primary/25 bg-primary/5 p-3 md:col-span-2">
                <p className="text-sm leading-relaxed text-muted-foreground">{step.explanation}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <PacketInspector step={step} dataplane={dataplane} scenarioCompletedCount={scenarioCompletedCount} />
          <DataplaneNotes dataplane={dataplane} scenarioId={scenarioId} />
          <MentalModel />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <p className="truncate text-sm font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function NetworkCanvas({
  step,
  dataplane,
  scenarioId,
}: {
  step: PacketStep;
  dataplane: Dataplane;
  scenarioId: ScenarioId;
}) {
  const active = (id: string) => step.highlights.includes(id);
  const blocked = step.tone === 'blocked';
  const translated = step.tone === 'translated';

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="relative min-h-[560px] overflow-hidden bg-gradient-to-br from-background via-muted/20 to-primary/5 p-4">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:42px_42px] opacity-20" />

          <div className="relative z-10 mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-muted-foreground">cluster.local / pod network 10.244.0.0/16</p>
              <p className="text-lg font-semibold">Packet path: {step.title}</p>
            </div>
            <Badge variant={blocked ? 'destructive' : translated ? 'default' : 'secondary'}>
              {DATAPLANES[dataplane].label}
            </Badge>
          </div>

          <div className="relative z-10 grid gap-4 lg:grid-cols-[1fr_120px_1fr]">
            <div className="space-y-3">
              <NodeBox
                id="node-a"
                title="node-a"
                cidr="PodCIDR 10.244.1.0/24"
                active={active('node-a')}
                cniActive={active('cni-a')}
              >
                <PodCard
                  id="pod-frontend"
                  title="frontend"
                  ip="10.244.1.12"
                  labels="app=frontend"
                  active={active('pod-frontend')}
                />
                <PodCard
                  id="pod-api"
                  title="api"
                  ip="10.244.1.34"
                  labels="app=api"
                  active={active('pod-api')}
                />
              </NodeBox>

              <AuxiliaryCard
                id="dns"
                title="CoreDNS"
                detail="svc DNS -> ClusterIP"
                icon={<Network className="h-4 w-4" />}
                active={active('dns')}
              />
            </div>

            <div className="flex flex-col items-center justify-center gap-3 py-2">
              <div
                className={cn(
                  'relative h-36 w-1 overflow-hidden rounded-full bg-border lg:h-72',
                  active('node-fabric') && 'bg-primary/25'
                )}
              >
                {active('node-fabric') && (
                  <motion.div
                    className="absolute left-1/2 top-0 h-12 w-1 -translate-x-1/2 rounded-full bg-primary"
                    animate={{ y: ['0%', '600%'] }}
                    transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }}
                  />
                )}
              </div>
              <Badge variant="outline" className="text-center text-[11px]">
                {dataplane === 'overlay' ? 'tunnel' : dataplane === 'direct' ? 'route' : 'eBPF map'}
              </Badge>
            </div>

            <div className="space-y-3">
              <NodeBox
                id="node-b"
                title="node-b"
                cidr="PodCIDR 10.244.2.0/24"
                active={active('node-b')}
                cniActive={active('cni-b')}
              >
                <PodCard
                  id="pod-payments"
                  title="payments"
                  ip="10.244.2.21"
                  labels="app=payments"
                  active={active('pod-payments')}
                  blocked={blocked && active('pod-payments')}
                />
                <PodCard
                  id="pod-worker"
                  title="worker"
                  ip="10.244.2.45"
                  labels="app=worker"
                  active={active('pod-worker')}
                />
              </NodeBox>

              <AuxiliaryCard
                id="kube-proxy"
                title={dataplane === 'ebpf' ? 'eBPF Service LB' : 'kube-proxy'}
                detail={dataplane === 'ebpf' ? 'socket / tc hooks' : 'iptables or IPVS'}
                icon={<Zap className="h-4 w-4" />}
                active={active('kube-proxy')}
              />
            </div>
          </div>

          <div className="relative z-10 mt-4 grid gap-3 lg:grid-cols-4">
            <AuxiliaryCard
              id="internet"
              title={scenarioId === 'ingress' ? 'External client' : 'Internet'}
              detail={scenarioId === 'ingress' ? '203.0.113.8' : 'public API'}
              icon={<Globe className="h-4 w-4" />}
              active={active('internet')}
            />
            <AuxiliaryCard
              id="ingress"
              title="Ingress"
              detail="host/path routing"
              icon={<Server className="h-4 w-4" />}
              active={active('ingress')}
            />
            <AuxiliaryCard
              id="service"
              title="Service"
              detail="10.96.12.40:443"
              icon={<Layers className="h-4 w-4" />}
              active={active('service')}
            />
            <AuxiliaryCard
              id="policy"
              title="NetworkPolicy"
              detail={blocked ? 'verdict: drop' : 'verdict: forward'}
              icon={blocked ? <AlertTriangle className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
              active={active('policy')}
              blocked={blocked && active('policy')}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NodeBox({
  title,
  cidr,
  active,
  cniActive,
  children,
}: {
  id: string;
  title: string;
  cidr: string;
  active: boolean;
  cniActive: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn('rounded-lg border bg-card/90 p-3 shadow-sm', active && 'border-primary/60 bg-primary/10')}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="font-mono text-xs text-muted-foreground">{cidr}</p>
        </div>
        <Badge variant={active ? 'default' : 'secondary'}>Ready</Badge>
      </div>
      <div className="grid gap-2">{children}</div>
      <div
        className={cn(
          'mt-3 rounded-md border p-2 text-xs text-muted-foreground',
          cniActive && 'border-primary/50 bg-primary/10 text-foreground'
        )}
      >
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4" />
          CNI agent: IPAM, routes, veth, policy hooks
        </div>
      </div>
    </div>
  );
}

function PodCard({
  title,
  ip,
  labels,
  active,
  blocked,
}: {
  id: string;
  title: string;
  ip: string;
  labels: string;
  active: boolean;
  blocked?: boolean;
}) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-md border bg-background/80 p-2.5 transition-colors',
        active && 'border-primary/60 bg-primary/10',
        blocked && 'border-red-500/50 bg-red-500/10'
      )}
    >
      <div className="mb-2 flex min-w-0 items-center gap-2">
        <Boxes className={cn('h-4 w-4 shrink-0', active && 'text-primary', blocked && 'text-red-500')} />
        <p className="min-w-0 truncate text-sm font-semibold">{title}</p>
      </div>
      <p className="break-all font-mono text-xs leading-snug">{ip}</p>
      <p className="mt-1 break-all text-xs leading-snug text-muted-foreground">{labels}</p>
    </div>
  );
}

function AuxiliaryCard({
  title,
  detail,
  icon,
  active,
  blocked,
}: {
  id: string;
  title: string;
  detail: string;
  icon: ReactNode;
  active: boolean;
  blocked?: boolean;
}) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-md border bg-card/90 p-3 transition-colors',
        active && 'border-primary/60 bg-primary/10',
        blocked && 'border-red-500/50 bg-red-500/10'
      )}
    >
      <div className="mb-1 flex min-w-0 items-center gap-2">
        <div className={cn('shrink-0 text-muted-foreground', active && 'text-primary', blocked && 'text-red-500')}>{icon}</div>
        <p className="min-w-0 truncate text-sm font-semibold">{title}</p>
      </div>
      <p className="break-words text-xs leading-snug text-muted-foreground">{detail}</p>
    </div>
  );
}

function PacketInspector({
  step,
  dataplane,
  scenarioCompletedCount,
}: {
  step: PacketStep;
  dataplane: Dataplane;
  scenarioCompletedCount: number;
}) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <LockKeyhole className="h-5 w-5" />
          Packet Inspector
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        <div className="rounded-md border bg-muted/20 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current verdict</p>
          <div className="mt-2 flex items-center gap-2">
            {step.tone === 'blocked' ? (
              <AlertTriangle className="h-5 w-5 text-red-500" />
            ) : (
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            )}
            <span className="font-medium">{toneLabel(step.tone)}</span>
          </div>
        </div>

        <InspectorRow label="Dataplane" value={DATAPLANES[dataplane].label} />
        <InspectorRow label="Service handling" value={DATAPLANES[dataplane].servicePath} />
        <InspectorRow label="Cross-node handling" value={DATAPLANES[dataplane].crossNodePath} />
        <InspectorRow label="Scenario complete" value={scenarioCompletedCount ? 'yes' : 'not yet'} />
      </CardContent>
    </Card>
  );
}

function InspectorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-muted-foreground">{value}</p>
    </div>
  );
}

function DataplaneNotes({ dataplane, scenarioId }: { dataplane: Dataplane; scenarioId: ScenarioId }) {
  const scenarioNote =
    scenarioId === 'network-policy'
      ? 'NetworkPolicy requires a capable CNI plugin. A policy object can exist while traffic still flows if the plugin does not enforce it.'
      : scenarioId === 'cluster-ip'
        ? 'A ClusterIP is a virtual destination. The real endpoint is chosen by kube-proxy or a CNI datapath that replaces kube-proxy.'
        : scenarioId === 'egress'
          ? 'Internet egress commonly uses SNAT because Pod CIDRs are normally not routable outside the cluster.'
          : 'The Kubernetes network model expects Pods and nodes to reach Pod IPs without application-level awareness.';

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Network className="h-5 w-5" />
          Why it matters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        <p className="text-sm text-muted-foreground">{scenarioNote}</p>
        <div className="rounded-md border border-primary/25 bg-primary/5 p-3">
          <p className="text-sm font-medium">{DATAPLANES[dataplane].label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{DATAPLANES[dataplane].description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MentalModel() {
  const facts = [
    'CNI is called when a Pod sandbox is created or deleted.',
    'CNI assigns Pod networking; Services are Kubernetes abstractions over endpoint Pods.',
    'Pod-to-Pod traffic inside the cluster should not need NAT.',
    'NetworkPolicy is enforced by the networking plugin, not by kube-apiserver.',
  ];

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-5 w-5" />
          Mental Model
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        {facts.map((fact) => (
          <div key={fact} className="flex items-start gap-2 rounded-md border p-2.5">
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <p className="text-sm text-muted-foreground">{fact}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
