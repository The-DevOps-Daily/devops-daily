'use client';

import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Boxes,
  CheckCircle,
  CircleDot,
  Cloud,
  Code2,
  FileText,
  Globe,
  Lightbulb,
  Network,
  Play,
  RotateCcw,
  Server,
  Terminal,
  Trophy,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type PodPhase = 'Running' | 'Pending' | 'CrashLoopBackOff';

interface KubeNode {
  name: string;
  status: 'Ready' | 'NotReady';
  role: 'control-plane' | 'worker';
  version: string;
  cpu: string;
  memory: string;
}

interface KubePod {
  name: string;
  app: string;
  image: string;
  status: PodPhase;
  restarts: number;
  age: string;
  node: string;
  logs: string[];
}

interface KubeDeployment {
  name: string;
  image: string;
  replicas: number;
  readyReplicas: number;
  generation: number;
  strategy: 'RollingUpdate' | 'Recreate';
}

interface KubeService {
  name: string;
  type: 'ClusterIP' | 'NodePort' | 'LoadBalancer';
  selector: string;
  port: number;
  targetPort: number;
  clusterIP: string;
}

interface KubeConfigMap {
  name: string;
  data: Record<string, string>;
}

interface KubeEvent {
  type: 'Normal' | 'Warning';
  reason: string;
  object: string;
  message: string;
}

interface KubeClusterState {
  context: string;
  namespace: string;
  nodes: KubeNode[];
  deployments: KubeDeployment[];
  pods: KubePod[];
  services: KubeService[];
  configMaps: KubeConfigMap[];
  events: KubeEvent[];
}

interface Lesson {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  commands: LessonCommand[];
}

interface LessonCommand {
  instruction: string;
  hint: string;
  expectedCommand: string | string[];
  explanation: string;
}

interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'success';
  content: string;
  timestamp: Date;
}

const SAMPLE_DEPLOYMENT = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: nginx
          image: nginx:1.27
          ports:
            - containerPort: 80`;

const SAMPLE_SERVICE = `apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  type: ClusterIP
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 80`;

const LESSONS: Lesson[] = [
  {
    id: 'cluster',
    title: 'Cluster Basics',
    description: 'Inspect the current context, API server, and nodes',
    icon: <Cloud className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Start by checking the kubectl client and cluster version.',
        hint: 'Use "kubectl version --short".',
        expectedCommand: ['kubectl version --short', 'kubectl version'],
        explanation:
          'kubectl talks to the Kubernetes API server. Version checks confirm the client can reach the cluster.',
      },
      {
        instruction: 'Show the active kubeconfig context.',
        hint: 'Use "kubectl config current-context".',
        expectedCommand: 'kubectl config current-context',
        explanation:
          'Your context decides which cluster and namespace kubectl targets. Always check it before touching production.',
      },
      {
        instruction: 'Show the cluster control plane endpoints.',
        hint: 'Use "kubectl cluster-info".',
        expectedCommand: 'kubectl cluster-info',
        explanation:
          'cluster-info is a quick API reachability check and shows where the control plane services live.',
      },
      {
        instruction: 'List all worker and control-plane nodes.',
        hint: 'Use "kubectl get nodes".',
        expectedCommand: 'kubectl get nodes',
        explanation:
          'Nodes are the machines that run Pods. Node readiness is the first signal for cluster capacity.',
      },
    ],
  },
  {
    id: 'workloads',
    title: 'Pods & Deployments',
    description: 'Create a Deployment and inspect the Pods it manages',
    icon: <Boxes className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Read the sample Deployment manifest.',
        hint: 'Use "cat deployment.yaml".',
        expectedCommand: 'cat deployment.yaml',
        explanation:
          'A Deployment describes desired state: replica count, labels, Pod template, and rollout strategy.',
      },
      {
        instruction: 'Create a web Deployment from the command line.',
        hint: 'Use "kubectl create deployment web --image=nginx:1.27".',
        expectedCommand: [
          'kubectl create deployment web --image=nginx:1.27',
          'kubectl create deployment web --image nginx:1.27',
        ],
        explanation:
          'The Deployment controller creates a ReplicaSet, and the ReplicaSet creates Pods until desired state is met.',
      },
      {
        instruction: 'List Deployments in the default namespace.',
        hint: 'Use "kubectl get deployments".',
        expectedCommand: ['kubectl get deployments', 'kubectl get deploy'],
        explanation:
          'Deployments show desired replicas, available replicas, and whether a rollout has completed.',
      },
      {
        instruction: 'List the Pods created by the Deployment.',
        hint: 'Use "kubectl get pods".',
        expectedCommand: ['kubectl get pods', 'kubectl get po'],
        explanation:
          'Pods are the smallest schedulable unit. Deployments own ReplicaSets, and ReplicaSets own Pods.',
      },
    ],
  },
  {
    id: 'services',
    title: 'Services & Networking',
    description: 'Expose Pods with a stable virtual IP and selector',
    icon: <Network className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Read the sample Service manifest.',
        hint: 'Use "cat service.yaml".',
        expectedCommand: 'cat service.yaml',
        explanation:
          'Services select Pods by labels and provide a stable endpoint even when Pods are replaced.',
      },
      {
        instruction: 'Expose the web Deployment on port 80.',
        hint: 'Use "kubectl expose deployment web --port=80 --target-port=80".',
        expectedCommand: [
          'kubectl expose deployment web --port=80 --target-port=80',
          'kubectl expose deployment web --port 80 --target-port 80',
        ],
        explanation:
          'A ClusterIP Service gives the Deployment a stable internal DNS name and virtual IP.',
      },
      {
        instruction: 'List Services in the namespace.',
        hint: 'Use "kubectl get svc".',
        expectedCommand: ['kubectl get svc', 'kubectl get services'],
        explanation:
          'Services are the normal way other workloads find your Pods without knowing Pod IPs.',
      },
      {
        instruction: 'Describe the web Service and inspect its selector.',
        hint: 'Use "kubectl describe svc web".',
        expectedCommand: ['kubectl describe svc web', 'kubectl describe service web'],
        explanation:
          'describe shows selectors, ports, endpoints, and events. It is one of the fastest networking debug commands.',
      },
    ],
  },
  {
    id: 'rollouts',
    title: 'Scaling & Rollouts',
    description: 'Scale replicas and perform a rolling image update',
    icon: <Play className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Scale the web Deployment to four replicas.',
        hint: 'Use "kubectl scale deployment web --replicas=4".',
        expectedCommand: [
          'kubectl scale deployment web --replicas=4',
          'kubectl scale deployment/web --replicas=4',
          'kubectl scale deployment web --replicas 4',
          'kubectl scale deployment/web --replicas 4',
        ],
        explanation:
          'Scaling changes desired state. The Deployment controller creates or removes Pods until reality matches.',
      },
      {
        instruction: 'Watch the rollout status for the Deployment.',
        hint: 'Use "kubectl rollout status deployment/web".',
        expectedCommand: 'kubectl rollout status deployment/web',
        explanation:
          'rollout status blocks until the Deployment has the expected number of available Pods.',
      },
      {
        instruction: 'Update the nginx container image to a newer tag.',
        hint: 'Use "kubectl set image deployment/web nginx=nginx:1.28".',
        expectedCommand: 'kubectl set image deployment/web nginx=nginx:1.28',
        explanation:
          'Changing the Pod template starts a new rollout. Kubernetes replaces Pods gradually with the new image.',
      },
      {
        instruction: 'Show the Deployment rollout history.',
        hint: 'Use "kubectl rollout history deployment/web".',
        expectedCommand: 'kubectl rollout history deployment/web',
        explanation:
          'Rollout history helps you see revisions and gives you a rollback target when a release fails.',
      },
    ],
  },
  {
    id: 'debugging',
    title: 'Debugging Workloads',
    description: 'Use logs, describe, exec, and events to inspect behavior',
    icon: <Terminal className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Read logs from the web Deployment.',
        hint: 'Use "kubectl logs deployment/web".',
        expectedCommand: 'kubectl logs deployment/web',
        explanation:
          'Deployment logs pick a Pod behind the Deployment. For exact debugging, use a specific Pod name.',
      },
      {
        instruction: 'Describe a web Pod to see scheduling and readiness details.',
        hint: 'Use "kubectl describe pod web".',
        expectedCommand: 'kubectl describe pod web',
        explanation:
          'describe pod shows containers, readiness, restarts, volumes, node placement, and recent events.',
      },
      {
        instruction: 'Run a command inside the web Deployment.',
        hint: 'Use "kubectl exec deployment/web -- printenv".',
        expectedCommand: 'kubectl exec deployment/web -- printenv',
        explanation:
          'exec starts a process inside an existing container. Use it sparingly in production and prefer logs/metrics first.',
      },
      {
        instruction: 'List recent namespace events.',
        hint: 'Use "kubectl get events".',
        expectedCommand: 'kubectl get events',
        explanation:
          'Events show scheduling, image pulls, scaling, and warnings. They are often the missing context during incidents.',
      },
    ],
  },
  {
    id: 'config-cleanup',
    title: 'Config & Cleanup',
    description: 'Create config data and safely remove objects',
    icon: <FileText className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Create a ConfigMap for application settings.',
        hint: 'Use "kubectl create configmap app-config --from-literal=LOG_LEVEL=debug".',
        expectedCommand: [
          'kubectl create configmap app-config --from-literal=LOG_LEVEL=debug',
          'kubectl create configmap app-config --from-literal LOG_LEVEL=debug',
        ],
        explanation:
          'ConfigMaps keep non-secret configuration outside container images so you can change behavior without rebuilding.',
      },
      {
        instruction: 'List ConfigMaps.',
        hint: 'Use "kubectl get configmaps".',
        expectedCommand: ['kubectl get configmaps', 'kubectl get cm'],
        explanation:
          'ConfigMaps are namespace-scoped API objects. Pods can consume them as env vars or mounted files.',
      },
      {
        instruction: 'Delete the web Service.',
        hint: 'Use "kubectl delete svc web".',
        expectedCommand: ['kubectl delete svc web', 'kubectl delete service web'],
        explanation:
          'Deleting a Service removes its stable network endpoint, but it does not delete the Pods it selected.',
      },
      {
        instruction: 'Delete the web Deployment and its managed Pods.',
        hint: 'Use "kubectl delete deployment web".',
        expectedCommand: ['kubectl delete deployment web', 'kubectl delete deploy web'],
        explanation:
          'Deleting a Deployment removes the desired state. Its ReplicaSet and Pods are cleaned up by owner references.',
      },
    ],
  },
];

function createInitialState(): KubeClusterState {
  return {
    context: 'devops-lab',
    namespace: 'default',
    nodes: [
      {
        name: 'control-plane-1',
        status: 'Ready',
        role: 'control-plane',
        version: 'v1.32.4',
        cpu: '22%',
        memory: '41%',
      },
      {
        name: 'worker-1',
        status: 'Ready',
        role: 'worker',
        version: 'v1.32.4',
        cpu: '18%',
        memory: '37%',
      },
      {
        name: 'worker-2',
        status: 'Ready',
        role: 'worker',
        version: 'v1.32.4',
        cpu: '27%',
        memory: '46%',
      },
    ],
    deployments: [],
    pods: [],
    services: [
      {
        name: 'kubernetes',
        type: 'ClusterIP',
        selector: 'component=apiserver',
        port: 443,
        targetPort: 6443,
        clusterIP: '10.96.0.1',
      },
    ],
    configMaps: [],
    events: [
      {
        type: 'Normal',
        reason: 'Starting',
        object: 'node/worker-1',
        message: 'Starting kubelet.',
      },
      {
        type: 'Normal',
        reason: 'NodeReady',
        object: 'node/worker-2',
        message: 'Node worker-2 status is now: NodeReady.',
      },
    ],
  };
}

function splitCommand(input: string): string[] {
  const matches = input.match(/"[^"]*"|'[^']*'|\S+/g) || [];
  return matches.map((part) => part.replace(/^["']|["']$/g, ''));
}

function commandMatches(cmd: string, expected: string | string[]) {
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').replace(/^k\s+/, 'kubectl ');
  const normalized = normalize(cmd);

  if (Array.isArray(expected)) {
    return expected.some((item) => normalize(item) === normalized);
  }

  return normalize(expected) === normalized;
}

function deploymentHash(deployment: KubeDeployment) {
  return deployment.generation === 1 ? '5d8f7c9b7b' : `6c${deployment.generation}f8d9a4`;
}

function makePods(deployment: KubeDeployment, nodes: KubeNode[]): KubePod[] {
  const hash = deploymentHash(deployment);

  return Array.from({ length: deployment.replicas }, (_, index) => ({
    name: `${deployment.name}-${hash}-${index}`,
    app: deployment.name,
    image: deployment.image,
    status: 'Running' as const,
    restarts: 0,
    age: deployment.generation === 1 ? '45s' : '8s',
    node: nodes[(index % Math.max(nodes.length - 1, 1)) + 1]?.name ?? nodes[0].name,
    logs: [
      `${deployment.name}: starting nginx worker process`,
      `${deployment.name}: GET /healthz 200`,
      `${deployment.name}: ready to serve traffic on port 80`,
    ],
  }));
}

function addEvent(state: KubeClusterState, event: KubeEvent): KubeClusterState {
  return {
    ...state,
    events: [event, ...state.events].slice(0, 8),
  };
}

function normalizeKind(kind: string) {
  if (kind === 'po') return 'pods';
  if (kind === 'pod') return 'pods';
  if (kind === 'deploy') return 'deployments';
  if (kind === 'deployment') return 'deployments';
  if (kind === 'svc') return 'services';
  if (kind === 'service') return 'services';
  if (kind === 'cm') return 'configmaps';
  if (kind === 'configmap') return 'configmaps';
  if (kind === 'node') return 'nodes';
  return kind;
}

function nameFromResource(resource: string) {
  return resource.includes('/') ? resource.split('/')[1] : resource;
}

function getFlagValue(args: string[], flag: string) {
  const inlineValue = args.find((arg) => arg.startsWith(`${flag}=`));
  if (inlineValue) return inlineValue.slice(flag.length + 1);

  const flagIndex = args.indexOf(flag);
  if (flagIndex >= 0) return args[flagIndex + 1];

  return undefined;
}

function formatNodes(nodes: KubeNode[]) {
  return [
    'NAME              STATUS   ROLES           AGE   VERSION',
    ...nodes.map((node) =>
      `${node.name.padEnd(17)} ${node.status.padEnd(8)} ${node.role.padEnd(15)} 14d   ${node.version}`
    ),
  ].join('\n');
}

function formatPods(pods: KubePod[]) {
  if (pods.length === 0) return 'No resources found in default namespace.';

  return [
    'NAME                       READY   STATUS    RESTARTS   AGE',
    ...pods.map((pod) =>
      `${pod.name.padEnd(26)} 1/1     ${pod.status.padEnd(9)} ${String(pod.restarts).padEnd(10)} ${pod.age}`
    ),
  ].join('\n');
}

function formatDeployments(deployments: KubeDeployment[]) {
  if (deployments.length === 0) return 'No resources found in default namespace.';

  return [
    'NAME   READY   UP-TO-DATE   AVAILABLE   AGE',
    ...deployments.map((deployment) =>
      `${deployment.name.padEnd(6)} ${`${deployment.readyReplicas}/${deployment.replicas}`.padEnd(7)} ${String(deployment.replicas).padEnd(12)} ${String(deployment.readyReplicas).padEnd(11)} 45s`
    ),
  ].join('\n');
}

function formatServices(services: KubeService[]) {
  return [
    'NAME         TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE',
    ...services.map((service) =>
      `${service.name.padEnd(12)} ${service.type.padEnd(11)} ${service.clusterIP.padEnd(14)} <none>        ${service.port}/TCP   1m`
    ),
  ].join('\n');
}

function formatConfigMaps(configMaps: KubeConfigMap[]) {
  if (configMaps.length === 0) return 'No resources found in default namespace.';

  return [
    'NAME         DATA   AGE',
    ...configMaps.map((configMap) =>
      `${configMap.name.padEnd(12)} ${String(Object.keys(configMap.data).length).padEnd(6)} 5s`
    ),
  ].join('\n');
}

function formatEvents(events: KubeEvent[]) {
  if (events.length === 0) return 'No events found in default namespace.';

  return [
    'TYPE      REASON              OBJECT                 MESSAGE',
    ...events.map((event) =>
      `${event.type.padEnd(9)} ${event.reason.padEnd(19)} ${event.object.padEnd(22)} ${event.message}`
    ),
  ].join('\n');
}

function formatAllResources(state: KubeClusterState) {
  return [
    'Pods:',
    formatPods(state.pods),
    '',
    'Deployments:',
    formatDeployments(state.deployments),
    '',
    'Services:',
    formatServices(state.services),
  ].join('\n');
}

function statusColor(status: PodPhase) {
  if (status === 'Running') return 'text-emerald-500';
  if (status === 'Pending') return 'text-amber-500';
  return 'text-red-500';
}

export default function KubernetesTerminalSimulator() {
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [currentCommandIndex, setCurrentCommandIndex] = useState(0);
  const [terminalHistory, setTerminalHistory] = useState<TerminalLine[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [clusterState, setClusterState] = useState<KubeClusterState>(createInitialState);
  const [completedCommands, setCompletedCommands] = useState<Set<string>>(new Set());
  const [showHint, setShowHint] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  const currentLesson = LESSONS[currentLessonIndex];
  const currentCommand = currentLesson?.commands[currentCommandIndex];
  const totalCommands = LESSONS.reduce((sum, lesson) => sum + lesson.commands.length, 0);
  const completedCount = completedCommands.size;
  const progressPercentage = (completedCount / totalCommands) * 100;
  const webDeployment = clusterState.deployments.find((deployment) => deployment.name === 'web');
  const webService = clusterState.services.find((service) => service.name === 'web');

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalHistory]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const findPod = useCallback(
    (name: string) => clusterState.pods.find((pod) => pod.name === name || pod.name.startsWith(name)),
    [clusterState.pods]
  );

  const findDeployment = useCallback(
    (name: string) => clusterState.deployments.find((deployment) => deployment.name === nameFromResource(name)),
    [clusterState.deployments]
  );

  const findService = useCallback(
    (name: string) => clusterState.services.find((service) => service.name === nameFromResource(name)),
    [clusterState.services]
  );

  const createDeployment = useCallback(
    (args: string[]) => {
      const name = args[1];
      const image = getFlagValue(args, '--image');

      if (!name || !image) {
        return 'error: required flag(s) "image" not set';
      }
      if (clusterState.deployments.some((deployment) => deployment.name === name)) {
        return `Error from server (AlreadyExists): deployments.apps "${name}" already exists`;
      }

      const deployment: KubeDeployment = {
        name,
        image,
        replicas: 1,
        readyReplicas: 1,
        generation: 1,
        strategy: 'RollingUpdate',
      };
      const pods = makePods(deployment, clusterState.nodes);

      setClusterState((prev) =>
        addEvent(
          {
            ...prev,
            deployments: [...prev.deployments, deployment],
            pods: [...prev.pods, ...pods],
          },
          {
            type: 'Normal',
            reason: 'ScalingReplicaSet',
            object: `deployment/${name}`,
            message: `Scaled up replica set ${name}-${deploymentHash(deployment)} to 1.`,
          }
        )
      );

      return `deployment.apps/${name} created`;
    },
    [clusterState.deployments, clusterState.nodes]
  );

  const createConfigMap = useCallback(
    (args: string[]) => {
      const name = args[1];
      const pair = getFlagValue(args, '--from-literal');
      const [key, ...valueParts] = pair?.split('=') ?? [];

      if (!name || !key) {
        return 'error: configmap name and --from-literal are required';
      }
      if (clusterState.configMaps.some((configMap) => configMap.name === name)) {
        return `Error from server (AlreadyExists): configmaps "${name}" already exists`;
      }

      setClusterState((prev) =>
        addEvent(
          {
            ...prev,
            configMaps: [...prev.configMaps, { name, data: { [key]: valueParts.join('=') } }],
          },
          {
            type: 'Normal',
            reason: 'Created',
            object: `configmap/${name}`,
            message: `Created ConfigMap ${name}.`,
          }
        )
      );

      return `configmap/${name} created`;
    },
    [clusterState.configMaps]
  );

  const exposeDeployment = useCallback(
    (args: string[]) => {
      const target = args[0]?.includes('/') ? args[0] : args[1];
      const name = nameFromResource(target || '');
      const deployment = findDeployment(name);
      const port = Number(getFlagValue(args, '--port') ?? 80);
      const targetPort = Number(getFlagValue(args, '--target-port') ?? port);
      const type = (getFlagValue(args, '--type') ?? 'ClusterIP') as KubeService['type'];

      if (!deployment) {
        return `Error from server (NotFound): deployments.apps "${name}" not found`;
      }
      if (clusterState.services.some((service) => service.name === name)) {
        return `Error from server (AlreadyExists): services "${name}" already exists`;
      }

      const service: KubeService = {
        name,
        type,
        selector: `app=${name}`,
        port,
        targetPort,
        clusterIP: `10.96.${20 + clusterState.services.length}.17`,
      };

      setClusterState((prev) =>
        addEvent(
          {
            ...prev,
            services: [...prev.services, service],
          },
          {
            type: 'Normal',
            reason: 'Created',
            object: `service/${name}`,
            message: `Created ${type} service for deployment ${name}.`,
          }
        )
      );

      return `service/${name} exposed`;
    },
    [clusterState.services, findDeployment]
  );

  const scaleDeployment = useCallback(
    (args: string[]) => {
      const resource = args[0];
      const name = resource?.includes('/') ? nameFromResource(resource) : args[1] || '';
      const replicas = Number(getFlagValue(args, '--replicas'));
      const deployment = findDeployment(name);

      if (!deployment) return `Error from server (NotFound): deployments.apps "${name}" not found`;
      if (!Number.isFinite(replicas) || replicas < 0) return 'error: --replicas must be a non-negative integer';

      const nextDeployment = {
        ...deployment,
        replicas,
        readyReplicas: replicas,
      };
      const nextPods = makePods(nextDeployment, clusterState.nodes);

      setClusterState((prev) =>
        addEvent(
          {
            ...prev,
            deployments: prev.deployments.map((item) => (item.name === name ? nextDeployment : item)),
            pods: [...prev.pods.filter((pod) => pod.app !== name), ...nextPods],
          },
          {
            type: 'Normal',
            reason: 'ScalingReplicaSet',
            object: `deployment/${name}`,
            message: `Scaled ${name} to ${replicas} replicas.`,
          }
        )
      );

      return `deployment.apps/${name} scaled`;
    },
    [clusterState.nodes, findDeployment]
  );

  const setImage = useCallback(
    (args: string[]) => {
      const resource = args[0];
      const resourceUsesSlash = resource?.includes('/');
      const name = resourceUsesSlash ? nameFromResource(resource || '') : args[1] || '';
      const imagePair = resourceUsesSlash ? args[1] || '' : args[2] || '';
      const [, image] = imagePair.split('=');
      const deployment = findDeployment(name);

      if (!deployment) return `Error from server (NotFound): deployments.apps "${name}" not found`;
      if (!image) return 'error: expected CONTAINER=IMAGE after deployment name';

      const nextDeployment = {
        ...deployment,
        image,
        generation: deployment.generation + 1,
        readyReplicas: deployment.replicas,
      };
      const nextPods = makePods(nextDeployment, clusterState.nodes);

      setClusterState((prev) =>
        addEvent(
          {
            ...prev,
            deployments: prev.deployments.map((item) => (item.name === name ? nextDeployment : item)),
            pods: [...prev.pods.filter((pod) => pod.app !== name), ...nextPods],
          },
          {
            type: 'Normal',
            reason: 'RollingUpdate',
            object: `deployment/${name}`,
            message: `Updated container image to ${image}.`,
          }
        )
      );

      return `deployment.apps/${name} image updated`;
    },
    [clusterState.nodes, findDeployment]
  );

  const deleteResource = useCallback(
    (args: string[]) => {
      const rawResource = args[0] || '';
      const [rawKind, rawName] = rawResource.includes('/') ? rawResource.split('/') : [rawResource, args[1]];
      const kind = normalizeKind(rawKind || '');
      const name = rawName;

      if (!kind || !name) return 'error: resource type and name are required';

      if (kind === 'services') {
        const service = findService(name);
        if (!service) return `Error from server (NotFound): services "${name}" not found`;

        setClusterState((prev) =>
          addEvent(
            {
              ...prev,
              services: prev.services.filter((item) => item.name !== service.name),
            },
            {
              type: 'Normal',
              reason: 'Deleted',
              object: `service/${service.name}`,
              message: `Deleted service ${service.name}.`,
            }
          )
        );
        return `service "${service.name}" deleted`;
      }

      if (kind === 'deployments') {
        const deployment = findDeployment(name);
        if (!deployment) return `Error from server (NotFound): deployments.apps "${name}" not found`;

        setClusterState((prev) =>
          addEvent(
            {
              ...prev,
              deployments: prev.deployments.filter((item) => item.name !== deployment.name),
              pods: prev.pods.filter((pod) => pod.app !== deployment.name),
            },
            {
              type: 'Normal',
              reason: 'Deleted',
              object: `deployment/${deployment.name}`,
              message: `Deleted deployment and owned Pods.`,
            }
          )
        );
        return `deployment.apps "${deployment.name}" deleted`;
      }

      return `error: delete for ${kind} is not implemented in this lab`;
    },
    [findDeployment, findService]
  );

  const describeResource = useCallback(
    (args: string[]) => {
      const kind = normalizeKind(args[0] || '');
      const name = args[1];

      if (kind === 'pods') {
        const pod = name ? findPod(name) : null;
        if (!pod) return `Error from server (NotFound): pods "${name}" not found`;
        return `Name:         ${pod.name}
Namespace:    ${clusterState.namespace}
Node:         ${pod.node}
Status:       ${pod.status}
IP:           10.244.${pod.name.endsWith('-0') ? '1.23' : '2.41'}
Containers:
  nginx:
    Image:      ${pod.image}
    Ready:      True
    Restarts:   ${pod.restarts}
Events:
  Normal  Scheduled  Successfully assigned default/${pod.name} to ${pod.node}
  Normal  Pulled     Container image "${pod.image}" already present
  Normal  Started    Started container nginx`;
      }

      if (kind === 'services') {
        const service = name ? findService(name) : null;
        if (!service) return `Error from server (NotFound): services "${name}" not found`;
        const endpoints = clusterState.pods
          .filter((pod) => pod.app === service.selector.replace('app=', ''))
          .map((pod, index) => `10.244.${index + 1}.${20 + index}:${service.targetPort}`)
          .join(',');

        return `Name:              ${service.name}
Namespace:         ${clusterState.namespace}
Type:              ${service.type}
IP:                ${service.clusterIP}
Port:              ${service.port}/TCP
TargetPort:        ${service.targetPort}/TCP
Selector:          ${service.selector}
Endpoints:         ${endpoints || '<none>'}`;
      }

      if (kind === 'deployments') {
        const deployment = name ? findDeployment(name) : null;
        if (!deployment) return `Error from server (NotFound): deployments.apps "${name}" not found`;
        return `Name:                   ${deployment.name}
Namespace:              ${clusterState.namespace}
Replicas:               ${deployment.replicas} desired | ${deployment.readyReplicas} available
StrategyType:           ${deployment.strategy}
Pod Template:
  Labels:               app=${deployment.name}
  Containers:
   nginx:
    Image:              ${deployment.image}`;
      }

      return `error: describe for ${kind || 'resource'} is not implemented in this lab`;
    },
    [clusterState.namespace, clusterState.pods, findDeployment, findPod, findService]
  );

  const executeKubectlCommand = useCallback(
    (args: string[]) => {
      const command = args[0];
      const rest = args.slice(1);

      switch (command) {
        case 'version':
          return `Client Version: v1.32.4
Server Version: v1.32.4`;

        case 'config':
          if (rest[0] === 'current-context') return clusterState.context;
          return 'Usage: kubectl config current-context';

        case 'cluster-info':
          return `Kubernetes control plane is running at https://devops-lab.example:6443
CoreDNS is running at https://devops-lab.example:6443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy`;

        case 'get': {
          const kind = normalizeKind(rest[0] || '');
          if (kind === 'nodes') return formatNodes(clusterState.nodes);
          if (kind === 'pods') return formatPods(clusterState.pods);
          if (kind === 'deployments') return formatDeployments(clusterState.deployments);
          if (kind === 'services') return formatServices(clusterState.services);
          if (kind === 'configmaps') return formatConfigMaps(clusterState.configMaps);
          if (kind === 'events') return formatEvents(clusterState.events);
          if (kind === 'all') return formatAllResources(clusterState);
          return `error: the server does not have a resource type "${rest[0] || ''}"`;
        }

        case 'create':
          if (rest[0] === 'deployment') return createDeployment(rest);
          if (rest[0] === 'configmap') return createConfigMap(rest);
          return 'Usage: kubectl create [deployment|configmap]';

        case 'expose':
          if (rest[0] === 'deployment' || rest[0]?.startsWith('deployment/')) return exposeDeployment(rest);
          return 'Usage: kubectl expose deployment NAME --port=PORT';

        case 'scale':
          return scaleDeployment(rest);

        case 'set':
          if (rest[0] === 'image') return setImage(rest.slice(1));
          return 'Usage: kubectl set image deployment/NAME CONTAINER=IMAGE';

        case 'rollout': {
          const action = rest[0];
          const resource = rest[1];
          const deployment = resource ? findDeployment(resource) : null;
          const name = resource ? nameFromResource(resource) : '';
          if (!deployment) return `Error from server (NotFound): deployments.apps "${name}" not found`;
          if (action === 'status') {
            return `Waiting for deployment "${deployment.name}" rollout to finish: ${deployment.readyReplicas} of ${deployment.replicas} updated replicas are available...
deployment "${deployment.name}" successfully rolled out`;
          }
          if (action === 'history') {
            return `deployment.apps/${deployment.name}
REVISION  CHANGE-CAUSE
1         kubectl create deployment ${deployment.name} --image=nginx:1.27
${deployment.generation > 1 ? `${deployment.generation}         kubectl set image deployment/${deployment.name} nginx=${deployment.image}` : ''}`.trim();
          }
          return 'Usage: kubectl rollout [status|history] deployment/NAME';
        }

        case 'logs': {
          const target = rest[0];
          if (!target) return 'error: logs requires a Pod or workload name';
          if (target.startsWith('deployment/')) {
            const deployment = findDeployment(target);
            const pod = deployment ? clusterState.pods.find((item) => item.app === deployment.name) : null;
            if (!pod) return `Error from server (NotFound): deployments.apps "${nameFromResource(target)}" not found`;
            return pod.logs.join('\n');
          }
          const pod = findPod(target);
          if (!pod) return `Error from server (NotFound): pods "${target}" not found`;
          return pod.logs.join('\n');
        }

        case 'describe':
          return describeResource(rest);

        case 'exec': {
          const target = rest[0];
          const commandStart = rest.indexOf('--');
          const commandText = commandStart >= 0 ? rest.slice(commandStart + 1).join(' ') : rest.slice(1).join(' ');
          const deployment = target?.startsWith('deployment/') ? findDeployment(target) : null;
          const pod = deployment ? clusterState.pods.find((item) => item.app === deployment.name) : target ? findPod(target) : null;
          if (!pod) return `Error from server (NotFound): pods "${target || ''}" not found`;
          if (commandText === 'printenv') {
            return `KUBERNETES_SERVICE_HOST=10.96.0.1
KUBERNETES_SERVICE_PORT=443
HOSTNAME=${pod.name}
NGINX_VERSION=${pod.image.replace('nginx:', '')}`;
          }
          if (commandText === 'hostname') return pod.name;
          return `executed "${commandText}" in ${pod.name}`;
        }

        case 'delete':
          return deleteResource(rest);

        default:
          return `kubectl: unknown command "${command || ''}"`;
      }
    },
    [
      clusterState,
      createConfigMap,
      createDeployment,
      deleteResource,
      describeResource,
      exposeDeployment,
      findDeployment,
      findPod,
      scaleDeployment,
      setImage,
    ]
  );

  const executeCommand = useCallback(
    (rawInput: string) => {
      const input = rawInput.trim();
      if (!input) return;

      const inputLine: TerminalLine = {
        type: 'input',
        content: input,
        timestamp: new Date(),
      };

      let output = '';
      let outputType: TerminalLine['type'] = 'output';

      const args = splitCommand(input);
      const command = args[0];

      if (input === 'clear') {
        setTerminalHistory([]);
        setInputValue('');
        return;
      }

      if (command === 'help') {
        output = `Available commands:
  kubectl version --short
  kubectl config current-context
  kubectl cluster-info
  kubectl get nodes|pods|deployments|svc|events|all
  kubectl create deployment web --image=nginx:1.27
  kubectl expose deployment web --port=80 --target-port=80
  kubectl scale deployment/web --replicas=4
  kubectl rollout status deployment/web
  kubectl logs deployment/web
  kubectl describe pod web
  kubectl exec deployment/web -- printenv
  ls, ls -l, pwd, cat deployment.yaml, cat service.yaml, clear`;
      } else if (command === 'pwd') {
        output = '/home/devops/kubernetes-lab';
      } else if (command === 'ls') {
        output = args.includes('-l')
          ? `-rw-r--r--  1 devops  devops  334 deployment.yaml
-rw-r--r--  1 devops  devops  156 service.yaml`
          : 'deployment.yaml  service.yaml';
      } else if (input === 'cat deployment.yaml' || input === 'cat ./deployment.yaml') {
        output = SAMPLE_DEPLOYMENT;
      } else if (input === 'cat service.yaml' || input === 'cat ./service.yaml') {
        output = SAMPLE_SERVICE;
      } else {
        if (args[0] === 'kubectl') {
          output = executeKubectlCommand(args.slice(1));
        } else if (args[0] === 'k') {
          output = executeKubectlCommand(args.slice(1));
        } else {
          output = `command not found: ${args[0] || ''}`;
          outputType = 'error';
        }
      }

      if (output.toLowerCase().startsWith('error') || output.includes('unknown command')) {
        outputType = 'error';
      }

      const commandKey = `${currentLessonIndex}-${currentCommandIndex}`;
      const isExpected = currentCommand ? commandMatches(input, currentCommand.expectedCommand) : false;

      if (isExpected && !completedCommands.has(commandKey)) {
        setCompletedCommands((prev) => new Set(prev).add(commandKey));
        outputType = outputType === 'error' ? 'error' : 'success';

        setTimeout(() => {
          if (currentCommandIndex < currentLesson.commands.length - 1) {
            setCurrentCommandIndex((index) => index + 1);
          } else if (currentLessonIndex < LESSONS.length - 1) {
            setCurrentLessonIndex((index) => index + 1);
            setCurrentCommandIndex(0);
          }
          setShowHint(false);
        }, 700);
      }

      setTerminalHistory((prev) => [
        ...prev,
        inputLine,
        {
          type: outputType,
          content: output,
          timestamp: new Date(),
        },
        ...(isExpected && currentCommand
          ? [
              {
                type: 'success' as const,
                content: `✓ ${currentCommand.explanation}`,
                timestamp: new Date(),
              },
            ]
          : []),
      ]);
      setCommandHistory((prev) => [input, ...prev.filter((item) => item !== input)].slice(0, 20));
      setHistoryIndex(-1);
      setInputValue('');
    },
    [
      completedCommands,
      currentCommand,
      currentCommandIndex,
      currentLesson,
      currentLessonIndex,
      executeKubectlCommand,
    ]
  );

  const resetLab = useCallback(() => {
    setClusterState(createInitialState());
    setTerminalHistory([]);
    setInputValue('');
    setCurrentLessonIndex(0);
    setCurrentCommandIndex(0);
    setCompletedCommands(new Set());
    setShowHint(false);
    setCommandHistory([]);
    setHistoryIndex(-1);
    inputRef.current?.focus();
  }, []);

  const runCurrentCommand = useCallback(() => {
    if (!currentCommand) return;
    const command = Array.isArray(currentCommand.expectedCommand)
      ? currentCommand.expectedCommand[0]
      : currentCommand.expectedCommand;
    executeCommand(command);
  }, [currentCommand, executeCommand]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      executeCommand(inputValue);
    },
    [executeCommand, inputValue]
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.ctrlKey && event.key === 'c') {
      event.preventDefault();
      setTerminalHistory((prev) => [
        ...prev,
        {
          type: inputValue.trim() ? 'input' : 'output',
          content: inputValue.trim() ? `${inputValue}^C` : '^C',
          timestamp: new Date(),
        },
      ]);
      setInputValue('');
      setHistoryIndex(-1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
      if (nextIndex >= 0) {
        setHistoryIndex(nextIndex);
        setInputValue(commandHistory[nextIndex]);
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = Math.max(historyIndex - 1, -1);
      setHistoryIndex(nextIndex);
      setInputValue(nextIndex >= 0 ? commandHistory[nextIndex] : '');
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-md border bg-muted/20 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="rounded-md border border-primary/30 bg-primary/10 p-2 text-primary">
              <Boxes className="h-6 w-6" />
            </div>
            <div>
              <p className="font-mono text-xs text-muted-foreground">// kubectl lab</p>
              <h2 className="text-2xl font-bold md:text-3xl">Kubernetes Terminal Simulator</h2>
            </div>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Practice Kubernetes commands in a safe browser lab. Learn contexts, nodes, Pods,
            Deployments, Services, rollouts, logs, exec, events, ConfigMaps, and cleanup workflows.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">
                {completedCount}/{totalCommands}
              </span>
            </div>
            <Progress value={progressPercentage} />
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="Nodes" value={clusterState.nodes.length} />
              <Metric label="Pods" value={clusterState.pods.length} />
              <Metric label="Services" value={clusterState.services.length} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_310px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpenIcon />
                Lessons
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {LESSONS.map((lesson, lessonIndex) => {
                const lessonCompleted = lesson.commands.every((_, commandIndex) =>
                  completedCommands.has(`${lessonIndex}-${commandIndex}`)
                );
                const active = lessonIndex === currentLessonIndex;

                return (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => {
                      setCurrentLessonIndex(lessonIndex);
                      setCurrentCommandIndex(0);
                      setShowHint(false);
                      inputRef.current?.focus();
                    }}
                    className={cn(
                      'w-full rounded-md border p-2.5 text-left transition-colors',
                      active
                        ? 'border-primary/60 bg-primary/10'
                        : 'border-border hover:border-primary/40 hover:bg-muted/30'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn('rounded-md border p-1.5', active ? 'text-primary' : 'text-muted-foreground')}>
                        {lesson.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{lesson.title}</p>
                          {lessonCompleted && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{lesson.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Button size="sm" variant="outline" onClick={resetLab} className="w-full">
            <RotateCcw className="mr-1 h-4 w-4" />
            Reset lab
          </Button>
        </div>

        <div className="space-y-4">
          <Card className="border-primary/40">
            <CardContent className="space-y-2.5 p-3.5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      Lesson {currentLessonIndex + 1} / {LESSONS.length}
                    </Badge>
                    <Badge>
                      Step {currentCommandIndex + 1} / {currentLesson.commands.length}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium sm:text-base">{currentCommand?.instruction}</p>
                  {showHint && currentCommand && (
                    <p className="mt-2 rounded-md border border-primary/30 bg-primary/10 p-2 text-sm text-muted-foreground">
                      {currentCommand.hint}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowHint((value) => !value)}>
                    <Lightbulb className="mr-1 h-4 w-4" />
                    Hint
                  </Button>
                  <Button size="sm" onClick={runCurrentCommand}>
                    <Play className="mr-1 h-4 w-4" />
                    Run
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border bg-[#171717]">
            <CardHeader className="border-b border-border/60 bg-[#262626] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500" />
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                  </div>
                  <span className="ml-2 text-sm text-muted-foreground">kubectl</span>
                </div>
                <Badge variant="secondary" className="font-mono text-[11px]">
                  {clusterState.context}/{clusterState.namespace}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div
                ref={terminalRef}
                className="h-[580px] cursor-text overflow-y-auto p-5 font-mono text-sm leading-relaxed sm:text-[15px]"
                onClick={() => inputRef.current?.focus()}
              >
                {terminalHistory.length === 0 && (
                  <div className="mb-4 text-emerald-400">
                    <p>Welcome to the Kubernetes terminal lab.</p>
                    <p className="mt-2 text-muted-foreground">
                      Type "help", run "ls", or follow the current task above.
                    </p>
                  </div>
                )}
                {terminalHistory.map((line, index) => (
                  <div
                    key={`${line.timestamp.getTime()}-${index}`}
                    className={cn(
                      'mb-2 whitespace-pre-wrap break-words',
                      line.type === 'input' && 'text-slate-100',
                      line.type === 'output' && 'text-slate-300',
                      line.type === 'error' && 'text-red-400',
                      line.type === 'success' &&
                        'rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-300'
                    )}
                  >
                    {line.type === 'input' && <span className="text-emerald-400">$ </span>}
                    {line.content}
                  </div>
                ))}
                <form onSubmit={handleSubmit} className="flex items-center">
                  <span className="text-emerald-400">$</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    onKeyDown={handleKeyDown}
                    className="ml-2 min-w-0 flex-1 bg-transparent text-slate-100 caret-emerald-400 outline-none"
                    spellCheck={false}
                    autoComplete="off"
                    autoCapitalize="off"
                    placeholder="kubectl get pods"
                  />
                </form>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <ManifestCard title="deployment.yaml" content={SAMPLE_DEPLOYMENT} />
            <ManifestCard title="service.yaml" content={SAMPLE_SERVICE} />
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-5 w-5" />
                Cluster
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {clusterState.nodes.map((node) => (
                <div key={node.name} className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="font-medium">{node.name}</p>
                    <Badge variant={node.status === 'Ready' ? 'default' : 'secondary'}>{node.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>{node.role}</span>
                    <span>{node.version}</span>
                    <span>cpu {node.cpu}</span>
                    <span>mem {node.memory}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Boxes className="h-5 w-5" />
                Workloads
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              {webDeployment ? (
                <div className="rounded-md border border-primary/30 bg-primary/10 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">deployment/{webDeployment.name}</p>
                    <Badge variant="secondary">
                      {webDeployment.readyReplicas}/{webDeployment.replicas}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">image {webDeployment.image}</p>
                </div>
              ) : (
                <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                  No application Deployment yet.
                </p>
              )}

              <div className="space-y-2">
                {clusterState.pods.map((pod) => (
                  <div key={pod.name} className="rounded-md border p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-mono text-xs">{pod.name}</p>
                      <span className={cn('text-xs font-medium', statusColor(pod.status))}>{pod.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{pod.node}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-5 w-5" />
                Networking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {webService ? (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <p className="font-medium">service/{webService.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {webService.clusterIP}:{webService.port} {'->'} app=
                    {webService.selector.replace('app=', '')}
                  </p>
                </div>
              ) : (
                <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                  Expose a Deployment to create a stable Service endpoint.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CircleDot className="h-5 w-5" />
                Recent Events
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {clusterState.events.slice(0, 4).map((event, index) => (
                <div key={`${event.reason}-${index}`} className="rounded-md border p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{event.reason}</p>
                    <Badge variant={event.type === 'Normal' ? 'secondary' : 'destructive'}>
                      {event.type}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{event.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {completedCount === totalCommands && (
        <Card className="mt-4 border-emerald-500/40 bg-emerald-500/10">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="font-semibold">Lab complete</p>
                <p className="text-sm text-muted-foreground">
                  You practiced the core kubectl workflow from cluster inspection to cleanup.
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={resetLab}>
              Start over
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BookOpenIcon() {
  return <Code2 className="h-5 w-5" />;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ManifestCard({ title, content }: { title: string; content: string }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30 p-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <pre className="max-h-64 overflow-auto p-3 text-xs text-muted-foreground">
          <code>{content}</code>
        </pre>
      </CardContent>
    </Card>
  );
}
