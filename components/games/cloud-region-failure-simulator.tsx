'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Cloud,
  Database,
  Flame,
  Gauge,
  Globe,
  Layers,
  Network,
  Play,
  RotateCcw,
  Server,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { SimulatorAdvisorCard, SimulatorControlSlider } from '@/components/games/simulator-primitives';
import { cn } from '@/lib/utils';

type ScenarioId = 'healthy' | 'az-outage' | 'db-failover' | 'retry-storm' | 'queue-backlog' | 'cache-outage';
type LayerId = 'edge' | 'app' | 'queue' | 'data';
type HealthTone = 'good' | 'warn' | 'bad';

interface Scenario {
  id: ScenarioId;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  failure: string;
  lesson: string;
  operatorMove: string;
  affectedAzs: number[];
  affectedLayers: LayerId[];
  tone: HealthTone;
}

interface Metrics {
  availability: number;
  latency: number;
  errorRate: number;
  queueDepth: number;
  cost: number;
  blastRadius: string;
  survivingAzs: number;
}

const SCENARIOS: Scenario[] = [
  {
    id: 'healthy',
    title: 'Healthy multi-AZ region',
    subtitle: 'Traffic is balanced and replicas are caught up',
    icon: ShieldCheck,
    failure: 'No active incident.',
    lesson:
      'A resilient region keeps traffic spread across availability zones and keeps stateful systems replicated before a failure happens.',
    operatorMove:
      'Keep replicas warm, probes strict, and capacity headroom high enough that one zone can fail without saturating the others.',
    affectedAzs: [],
    affectedLayers: [],
    tone: 'good',
  },
  {
    id: 'az-outage',
    title: 'Availability zone outage',
    subtitle: 'One zone disappears under live traffic',
    icon: Cloud,
    failure: 'AZ-b lost compute and network reachability.',
    lesson:
      'Multi-AZ only helps when the remaining zones have enough capacity and the load balancer stops routing to failed targets quickly.',
    operatorMove:
      'Drain failed targets, shift traffic to healthy AZs, and watch saturation rather than just instance count.',
    affectedAzs: [1],
    affectedLayers: ['edge', 'app', 'queue', 'data'],
    tone: 'bad',
  },
  {
    id: 'db-failover',
    title: 'Database primary failover',
    subtitle: 'Writes pause while a replica is promoted',
    icon: Database,
    failure: 'Primary database in AZ-a is unreachable.',
    lesson:
      'Failover is a control-plane event and a client behavior problem. Apps need retry budgets and connection refresh logic.',
    operatorMove:
      'Promote the healthiest replica, stop writes to the old primary, and reconnect clients to the new writer endpoint.',
    affectedAzs: [0],
    affectedLayers: ['data'],
    tone: 'warn',
  },
  {
    id: 'retry-storm',
    title: 'Retry storm',
    subtitle: 'Well-intended retries amplify load',
    icon: Zap,
    failure: 'Downstream latency causes clients to retry aggressively.',
    lesson:
      'Retries without backoff, jitter, and budgets can multiply traffic until healthy services become unhealthy too.',
    operatorMove:
      'Apply exponential backoff, cap retries, open circuit breakers, and shed non-critical work.',
    affectedAzs: [0, 1, 2],
    affectedLayers: ['edge', 'app'],
    tone: 'bad',
  },
  {
    id: 'queue-backlog',
    title: 'Queue backlog',
    subtitle: 'Async work absorbs traffic but hides delay',
    icon: Layers,
    failure: 'Workers cannot drain the queue as fast as producers enqueue jobs.',
    lesson:
      'Queues protect callers from immediate failure, but backlog becomes user-visible latency if consumers cannot catch up.',
    operatorMove:
      'Scale consumers, prioritize urgent queues, pause noisy producers, and alert on age of oldest message.',
    affectedAzs: [1, 2],
    affectedLayers: ['queue'],
    tone: 'warn',
  },
  {
    id: 'cache-outage',
    title: 'Cache outage',
    subtitle: 'A cache miss storm hits the database',
    icon: Flame,
    failure: 'Regional cache cluster is unavailable.',
    lesson:
      'A cache is not just a speed-up. When it fails, traffic can move abruptly to databases and shared APIs.',
    operatorMove:
      'Use request coalescing, stale reads where safe, rate limits, and DB protection before restoring cache traffic.',
    affectedAzs: [0, 1, 2],
    affectedLayers: ['app', 'data'],
    tone: 'warn',
  },
];

const LAYERS: Array<{ id: LayerId; title: string; icon: LucideIcon; description: string }> = [
  { id: 'edge', title: 'Edge', icon: Globe, description: 'DNS, CDN, WAF, and load balancer entry.' },
  { id: 'app', title: 'App tier', icon: Server, description: 'Stateless services that scale horizontally.' },
  { id: 'queue', title: 'Async queue', icon: Layers, description: 'Buffers jobs and decouples producers from workers.' },
  { id: 'data', title: 'Data tier', icon: Database, description: 'Primary, replicas, cache, and durability boundary.' },
];

function getScenario(id: ScenarioId) {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? SCENARIOS[0]!;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function computeMetrics(scenario: Scenario, traffic: number, failoverAutomation: boolean): Metrics {
  const trafficPressure = traffic / 100;
  const failedAzs = scenario.affectedAzs.length;
  const survivingAzs = Math.max(3 - failedAzs, 1);
  const failoverPenalty = scenario.id === 'db-failover' && !failoverAutomation ? 16 : 4;
  const retryPenalty = scenario.id === 'retry-storm' ? 24 + trafficPressure * 18 : 0;
  const queuePenalty = scenario.id === 'queue-backlog' ? 9 + trafficPressure * 12 : 0;
  const cachePenalty = scenario.id === 'cache-outage' ? 8 + trafficPressure * 10 : 0;
  const azPenalty = scenario.id === 'az-outage' ? 18 + trafficPressure * 14 : 0;

  const errorRate = clamp(
    retryPenalty * 0.12 + queuePenalty * 0.08 + cachePenalty * 0.12 + azPenalty * 0.12 + failoverPenalty * 0.08,
    0.2,
    18
  );
  const latency = Math.round(
    45 +
      trafficPressure * 90 +
      retryPenalty * 5 +
      queuePenalty * 8 +
      cachePenalty * 7 +
      azPenalty * 6 +
      (scenario.id === 'db-failover' ? failoverPenalty * 11 : 0)
  );
  const availability = clamp(99.99 - errorRate * 0.55 - failedAzs * 0.8, 82, 99.99);
  const queueDepth = Math.round(
    scenario.id === 'queue-backlog'
      ? 22000 + traffic * 820
      : scenario.id === 'retry-storm'
        ? 9000 + traffic * 240
        : scenario.id === 'az-outage'
          ? 6000 + traffic * 180
          : 900 + traffic * 22
  );
  const cost = Math.round(100 + trafficPressure * 62 + (scenario.id === 'retry-storm' ? 48 : 0) + (scenario.id === 'az-outage' ? 34 : 0));

  return {
    availability,
    latency,
    errorRate,
    queueDepth,
    cost,
    blastRadius: failedAzs === 0 ? 'contained' : failedAzs === 1 ? 'one AZ' : 'regional',
    survivingAzs,
  };
}

function toneClass(tone: HealthTone) {
  if (tone === 'good') return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (tone === 'warn') return 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  return 'border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300';
}

export default function CloudRegionFailureSimulator() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('healthy');
  const [traffic, setTraffic] = useState(62);
  const [failoverAutomation, setFailoverAutomation] = useState(true);
  const [selectedLayer, setSelectedLayer] = useState<LayerId>('app');

  const scenario = getScenario(scenarioId);
  const metrics = useMemo(
    () => computeMetrics(scenario, traffic, failoverAutomation),
    [failoverAutomation, scenario, traffic]
  );

  const reset = () => {
    setScenarioId('healthy');
    setTraffic(62);
    setFailoverAutomation(true);
    setSelectedLayer('app');
  };

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-md border bg-muted/20 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="rounded-md border border-primary/30 bg-primary/10 p-2 text-primary">
              <Cloud className="h-6 w-6" />
            </div>
            <div>
              <p className="font-mono text-xs text-muted-foreground">// resilience lab</p>
              <h2 className="text-2xl font-bold md:text-3xl">3D Cloud Region Failure Simulator</h2>
            </div>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Explore a live multi-AZ region in 3D. Trigger outages, watch traffic reroute, inspect
            blast radius, and learn how queues, replicas, failover, and retry budgets keep systems alive.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Regional availability</span>
              <span className="font-mono text-sm text-muted-foreground">{metrics.availability.toFixed(2)}%</span>
            </div>
            <Progress value={metrics.availability} />
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="AZs alive" value={`${metrics.survivingAzs}/3`} />
              <Metric label="p95 latency" value={`${metrics.latency}ms`} />
              <Metric label="errors" value={`${metrics.errorRate.toFixed(1)}%`} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-5 w-5" />
                Failure Modes
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
                    onClick={() => setScenarioId(candidate.id)}
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
                <Gauge className="h-5 w-5" />
                Traffic & Automation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0">
              <SimulatorControlSlider
                label="Traffic pressure"
                value={traffic}
                min={20}
                max={100}
                step={5}
                suffix="%"
                onChange={setTraffic}
              />
              <Button
                type="button"
                variant={failoverAutomation ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFailoverAutomation((enabled) => !enabled)}
                className="w-full justify-start"
              >
                <Zap className="mr-2 h-4 w-4" />
                {failoverAutomation ? 'Automation enabled' : 'Manual failover mode'}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={reset} className="w-full">
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset region
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-md border bg-[#07111f]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/30 px-4 py-3">
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge className={cn('border', toneClass(scenario.tone))}>{scenario.title}</Badge>
                  <Badge variant="secondary">traffic {traffic}%</Badge>
                  <Badge variant="outline">blast radius: {metrics.blastRadius}</Badge>
                </div>
                <p className="text-sm text-slate-300">{scenario.failure}</p>
              </div>
              <Button size="sm" onClick={() => setScenarioId(scenario.id === 'healthy' ? 'az-outage' : 'healthy')}>
                <Play className="mr-2 h-4 w-4" />
                {scenario.id === 'healthy' ? 'Trigger incident' : 'Recover'}
              </Button>
            </div>
            <CloudRegionScene
              scenario={scenario}
              traffic={traffic}
              failoverAutomation={failoverAutomation}
              selectedLayer={selectedLayer}
            />
          </div>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowRight className="h-5 w-5" />
                Incident readout
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 pt-0 md:grid-cols-2">
              <SimulatorAdvisorCard title="What is happening" icon={Network} tone={scenario.tone === 'bad' ? 'bad' : 'primary'}>
                {scenario.lesson}
              </SimulatorAdvisorCard>
              <SimulatorAdvisorCard title="Best operator move" icon={ShieldCheck} tone={scenario.tone === 'bad' ? 'warn' : 'primary'}>
                {scenario.operatorMove}
              </SimulatorAdvisorCard>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-5 w-5" />
                Live Signals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              <Signal label="Availability" value={`${metrics.availability.toFixed(2)}%`} tone={metrics.availability > 99 ? 'good' : metrics.availability > 95 ? 'warn' : 'bad'} />
              <Signal label="p95 latency" value={`${metrics.latency}ms`} tone={metrics.latency < 180 ? 'good' : metrics.latency < 450 ? 'warn' : 'bad'} />
              <Signal label="Error rate" value={`${metrics.errorRate.toFixed(1)}%`} tone={metrics.errorRate < 2 ? 'good' : metrics.errorRate < 8 ? 'warn' : 'bad'} />
              <Signal label="Queue depth" value={metrics.queueDepth.toLocaleString()} tone={metrics.queueDepth < 10000 ? 'good' : metrics.queueDepth < 40000 ? 'warn' : 'bad'} />
              <Signal label="Cost index" value={`${metrics.cost}`} tone={metrics.cost < 150 ? 'good' : metrics.cost < 205 ? 'warn' : 'bad'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Network className="h-5 w-5" />
                Layer Focus
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {LAYERS.map((layer) => {
                const Icon = layer.icon;
                const active = selectedLayer === layer.id;
                const affected = scenario.affectedLayers.includes(layer.id);

                return (
                  <button
                    key={layer.id}
                    type="button"
                    onClick={() => setSelectedLayer(layer.id)}
                    className={cn(
                      'w-full rounded-md border p-2.5 text-left transition-colors',
                      active ? 'border-primary/60 bg-primary/10' : 'border-border hover:bg-muted/30',
                      affected && 'border-amber-500/40'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className={cn('mt-0.5 h-4 w-4', affected ? 'text-amber-500' : 'text-muted-foreground')} />
                      <div>
                        <p className="text-sm font-medium">{layer.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{layer.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
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

function Signal({ label, value, tone }: { label: string; value: string; tone: HealthTone }) {
  return (
    <div className={cn('rounded-md border p-3', toneClass(tone))}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{label}</p>
        <p className="font-mono text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

function CloudRegionScene({
  scenario,
  traffic,
  failoverAutomation,
  selectedLayer,
}: {
  scenario: Scenario;
  traffic: number;
  failoverAutomation: boolean;
  selectedLayer: LayerId;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const scenarioRef = useRef({ scenario, traffic, failoverAutomation, selectedLayer });

  useEffect(() => {
    scenarioRef.current = { scenario, traffic, failoverAutomation, selectedLayer };
  }, [failoverAutomation, scenario, selectedLayer, traffic]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || useFallback) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07111f');
    scene.fog = new THREE.Fog('#07111f', 19, 42);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(9.5, 8.2, 12.5);
    camera.lookAt(0, 0, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      if (!window.WebGLRenderingContext) throw new Error('WebGL is not available');
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setUseFallback(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = 'block h-full w-full cursor-grab';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    const onContextLost = (event: Event) => {
      event.preventDefault();
      setUseFallback(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight('#dbeafe', 0.78);
    scene.add(ambient);

    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(5, 10, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);

    const rim = new THREE.PointLight('#f5a524', 3.2, 32);
    rim.position.set(-8, 5, 7);
    scene.add(rim);

    const coolFill = new THREE.PointLight('#38bdf8', 2.4, 30);
    coolFill.position.set(7, 4, -7);
    scene.add(coolFill);

    const root = new THREE.Group();
    scene.add(root);

    const materials: THREE.Material[] = [];
    const dynamicMaterials: THREE.Material[] = [];
    const dynamicTextures: THREE.Texture[] = [];
    const meshes: THREE.Object3D[] = [];
    const particles: Array<{ mesh: THREE.Mesh; path: THREE.Vector3[]; speed: number; offset: number }> = [];

    const makeMaterial = (color: string, emissive = '#000000', opacity = 1) => {
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity: emissive === '#000000' ? 0 : 0.35,
        roughness: 0.48,
        metalness: 0.16,
        transparent: opacity < 1,
        opacity,
      });
      materials.push(material);
      return material;
    };

    const makeDynamicMaterial = (color: string, opacity = 1) => {
      const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
      dynamicMaterials.push(material);
      return material;
    };

    const roundedRect = (
      context: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number
    ) => {
      context.beginPath();
      context.moveTo(x + radius, y);
      context.lineTo(x + width - radius, y);
      context.quadraticCurveTo(x + width, y, x + width, y + radius);
      context.lineTo(x + width, y + height - radius);
      context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      context.lineTo(x + radius, y + height);
      context.quadraticCurveTo(x, y + height, x, y + height - radius);
      context.lineTo(x, y + radius);
      context.quadraticCurveTo(x, y, x + radius, y);
      context.closePath();
    };

    const addLabel = (
      text: string,
      position: [number, number, number],
      background = '#111827',
      foreground = '#f8fafc'
    ) => {
      const canvas = document.createElement('canvas');
      canvas.width = 384;
      canvas.height = 112;
      const context = canvas.getContext('2d');
      if (!context) return;

      context.clearRect(0, 0, canvas.width, canvas.height);
      roundedRect(context, 10, 14, 364, 74, 18);
      context.fillStyle = background;
      context.fill();
      context.strokeStyle = '#f5a524';
      context.lineWidth = 4;
      context.stroke();
      context.font = '700 34px Inter, Arial, sans-serif';
      context.fillStyle = foreground;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, 192, 52);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      dynamicTextures.push(texture);
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
      dynamicMaterials.push(material);
      const sprite = new THREE.Sprite(material);
      sprite.position.set(position[0], position[1], position[2]);
      sprite.scale.set(2.25, 0.66, 1);
      root.add(sprite);
      meshes.push(sprite);
    };

    const baseMaterial = makeMaterial('#101827');
    const healthyMaterial = makeMaterial('#0f766e', '#064e3b');
    const appMaterial = makeMaterial('#2563eb', '#172554');
    const queueMaterial = makeMaterial('#7c3aed', '#3b0764');
    const dataMaterial = makeMaterial('#22c55e', '#14532d');
    const warnMaterial = makeMaterial('#f59e0b', '#78350f');
    const badMaterial = makeMaterial('#ef4444', '#7f1d1d');
    const edgeMaterial = makeMaterial('#38bdf8', '#075985');
    const mutedMaterial = makeMaterial('#334155', '#020617', 0.72);
    const selectedMaterial = makeMaterial('#e0f2fe', '#38bdf8');
    const inboundParticleMaterial = makeMaterial('#38bdf8', '#0ea5e9');
    const internalParticleMaterial = makeMaterial('#22c55e', '#15803d');

    const addMesh = (mesh: THREE.Mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
      meshes.push(mesh);
      return mesh;
    };

    const addBox = (
      position: [number, number, number],
      size: [number, number, number],
      material: THREE.Material,
      name?: string
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
      mesh.position.set(position[0], position[1], position[2]);
      if (name) mesh.name = name;
      const edgeMaterial = makeDynamicMaterial('#e5e7eb', 0.22);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), edgeMaterial);
      mesh.add(edges);
      return addMesh(mesh);
    };

    const addCylinder = (
      position: [number, number, number],
      radius: number,
      height: number,
      material: THREE.Material,
      name?: string
    ) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 32), material);
      mesh.position.set(position[0], position[1], position[2]);
      if (name) mesh.name = name;
      return addMesh(mesh);
    };

    const addLine = (points: THREE.Vector3[], color: string, opacity = 0.9) => {
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = makeDynamicMaterial(color, opacity);
      const line = new THREE.Line(geometry, material);
      root.add(line);
      meshes.push(line);
      return line;
    };

    const rebuild = () => {
      while (root.children.length) {
        const child = root.children.pop();
        if (!child) break;
        child.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
        });
      }
      dynamicTextures.splice(0).forEach((texture) => texture.dispose());
      dynamicMaterials.splice(0).forEach((material) => material.dispose());
      meshes.length = 0;
      particles.length = 0;

      const { scenario: current, traffic: currentTraffic, selectedLayer: focus } = scenarioRef.current;
      const failedAzs = new Set(current.affectedAzs);
      const affectedLayers = new Set(current.affectedLayers);
      const azX = [-6.2, 0, 6.2];
      const azNames = ['AZ-a', 'AZ-b', 'AZ-c'];

      addBox([0, -0.18, 0], [17.8, 0.16, 12.4], baseMaterial);
      addBox([0, -0.06, 5.2], [13.8, 0.12, 1.05], mutedMaterial);
      addLabel('Internet traffic', [0, 2.35, 5.5], '#082f49', '#e0f2fe');

      const internet = addCylinder([0, 1.2, 5.5], 0.72, 0.38, edgeMaterial, 'internet');
      internet.rotation.x = Math.PI / 2;
      addBox([0, 0.75, 3.9], [2.5, 0.64, 0.8], edgeMaterial, 'load-balancer');
      addLabel('Load balancer', [0, 1.72, 3.85], '#18181b', '#fef3c7');

      azX.forEach((x, index) => {
        const failed = failedAzs.has(index);
        const platform = addBox([x, 0, 0], [4.75, 0.18, 8.45], failed ? badMaterial : mutedMaterial, `az-${index}`);
        platform.position.y = failed ? -0.04 : 0;
        addLabel(
          failed ? `${azNames[index]} down` : azNames[index]!,
          [x, 1.05, 3.62],
          failed ? '#7f1d1d' : '#0f172a'
        );

        addBox([x, 0.32, 2.8], [3.35, 0.3, 0.4], failed ? badMaterial : edgeMaterial, `edge-${index}`);
        if (focus === 'edge') {
          addBox([x, 0.78, 2.8], [3.62, 0.1, 0.58], selectedMaterial, `edge-highlight-${index}`);
        }

        for (let i = 0; i < 4; i += 1) {
          const row = i < 2 ? 0 : 1;
          const col = i % 2;
          const hot = current.id === 'retry-storm';
          const material = failed
            ? badMaterial
            : affectedLayers.has('app')
              ? hot
                ? badMaterial
                : warnMaterial
              : focus === 'app'
                ? selectedMaterial
                : appMaterial;
          addBox([x - 0.88 + col * 1.76, 0.72, 1.1 - row * 0.88], [1.1, 0.9, 0.55], material, `app-${index}-${i}`);
        }
        addLabel('app', [x, 1.74, 0.72], affectedLayers.has('app') ? '#7c2d12' : '#111827');

        const queueMaterialForAz = failed
          ? badMaterial
          : affectedLayers.has('queue')
            ? warnMaterial
            : focus === 'queue'
              ? selectedMaterial
              : queueMaterial;
        addBox([x - 1.15, 0.55, -1.15], [1.2, 0.78, 0.85], queueMaterialForAz, `queue-${index}`);
        addBox([x + 1.15, 0.55, -1.15], [1.2, 0.78, 0.85], queueMaterialForAz, `workers-${index}`);
        addLabel('queue', [x, 1.45, -1.12], affectedLayers.has('queue') ? '#7c2d12' : '#111827');

        const dbMaterial = failed
          ? badMaterial
          : affectedLayers.has('data')
            ? warnMaterial
            : focus === 'data'
              ? selectedMaterial
              : dataMaterial;
        const isPrimary = index === (current.id === 'db-failover' && scenarioRef.current.failoverAutomation ? 2 : 0);
        const db = addCylinder([x, 0.72, -3.08], 0.54, 0.95, dbMaterial, `db-${index}`);
        db.rotation.x = Math.PI / 2;
        if (isPrimary) {
          addBox([x, 1.42, -3.08], [1.18, 0.16, 0.2], warnMaterial, `primary-${index}`);
        }
        addLabel(
          isPrimary ? 'primary DB' : 'replica DB',
          [x, 1.78, -3.08],
          affectedLayers.has('data') ? '#7c2d12' : '#111827'
        );

        const cacheMaterial =
          current.id === 'cache-outage' ? badMaterial : focus === 'data' ? selectedMaterial : healthyMaterial;
        addBox([x + 1.45, 0.46, -2.45], [0.8, 0.62, 0.58], cacheMaterial, `cache-${index}`);
      });

      const lineColor = current.tone === 'bad' ? '#ef4444' : current.tone === 'warn' ? '#f59e0b' : '#38bdf8';
      const paths = [
        [new THREE.Vector3(0, 1.2, 5.5), new THREE.Vector3(0, 0.8, 3.95), new THREE.Vector3(-6.2, 1.1, 2.8), new THREE.Vector3(-6.2, 1.0, 1.1)],
        [new THREE.Vector3(0, 1.2, 5.5), new THREE.Vector3(0, 0.8, 3.95), new THREE.Vector3(0, 1.1, 2.8), new THREE.Vector3(0, 1.0, 1.1)],
        [new THREE.Vector3(0, 1.2, 5.5), new THREE.Vector3(0, 0.8, 3.95), new THREE.Vector3(6.2, 1.1, 2.8), new THREE.Vector3(6.2, 1.0, 1.1)],
        [new THREE.Vector3(-6.2, 0.9, 0.3), new THREE.Vector3(-6.2, 0.9, -1.15), new THREE.Vector3(-6.2, 0.9, -3.08)],
        [new THREE.Vector3(0, 0.9, 0.3), new THREE.Vector3(0, 0.9, -1.15), new THREE.Vector3(0, 0.9, -3.08)],
        [new THREE.Vector3(6.2, 0.9, 0.3), new THREE.Vector3(6.2, 0.9, -1.15), new THREE.Vector3(6.2, 0.9, -3.08)],
      ];

      paths.forEach((path, pathIndex) => {
        addLine(path, lineColor, pathIndex < 3 ? 0.9 : 0.54);
        const particleCount = Math.max(2, Math.round(currentTraffic / 18));
        for (let i = 0; i < particleCount; i += 1) {
          const material = pathIndex < 3 ? inboundParticleMaterial : internalParticleMaterial;
          const particle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), material);
          particle.castShadow = false;
          root.add(particle);
          particles.push({
            mesh: particle,
            path,
            speed: 0.0015 + currentTraffic / 82000 + (scenarioRef.current.scenario.id === 'retry-storm' ? 0.0015 : 0),
            offset: (i / particleCount + pathIndex * 0.11) % 1,
          });
        }
      });
    };

    rebuild();

    let animationFrame = 0;
    let lastScenarioKey = '';
    let orbit = 0;
    let dragging = false;
    let lastX = 0;

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      const nextWidth = Math.max(rect.width, 320);
      const nextHeight = Math.max(rect.height, 500);
      renderer.setSize(nextWidth, nextHeight, true);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
    };

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      renderer.domElement.classList.add('cursor-grabbing');
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      orbit += (event.clientX - lastX) * 0.006;
      lastX = event.clientX;
    };
    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      renderer.domElement.classList.remove('cursor-grabbing');
      renderer.domElement.releasePointerCapture(event.pointerId);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const clock = new THREE.Clock();
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const key = `${scenarioRef.current.scenario.id}-${scenarioRef.current.traffic}-${scenarioRef.current.failoverAutomation}-${scenarioRef.current.selectedLayer}`;
      if (key !== lastScenarioKey) {
        lastScenarioKey = key;
        rebuild();
      }

      const radius = 16.2;
      const autoOrbit = 0.54 + orbit + elapsed * 0.018;
      camera.position.x = Math.sin(autoOrbit) * radius;
      camera.position.z = Math.cos(autoOrbit) * radius;
      camera.position.y = 8.3 + Math.sin(elapsed * 0.32) * 0.16;
      camera.lookAt(0, 0.35, 0);

      particles.forEach((particle) => {
        particle.offset = (particle.offset + particle.speed * 16) % 1;
        const scaled = particle.offset * (particle.path.length - 1);
        const index = Math.floor(scaled);
        const nextIndex = Math.min(index + 1, particle.path.length - 1);
        const localT = scaled - index;
        particle.mesh.position.copy(particle.path[index]!).lerp(particle.path[nextIndex]!, localT);
        const pulse = 0.85 + Math.sin(elapsed * 8 + particle.offset * 12) * 0.18;
        particle.mesh.scale.setScalar(pulse);
      });

      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.dispose();
      dynamicTextures.forEach((texture) => texture.dispose());
      dynamicMaterials.forEach((material) => material.dispose());
      materials.forEach((material) => material.dispose());
      meshes.forEach((object) => {
        object.traverse((meshObject) => {
          const mesh = meshObject as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
        });
      });
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [useFallback]);

  if (useFallback) {
    return (
      <CloudRegionFallbackMap
        scenario={scenario}
        traffic={traffic}
        failoverAutomation={failoverAutomation}
        selectedLayer={selectedLayer}
      />
    );
  }

  return (
    <div
      className="relative h-[640px] min-h-[540px] w-full overflow-hidden bg-[#07111f]"
      aria-label="3D cloud region failure simulator"
    >
      <div ref={mountRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-xs text-slate-300 backdrop-blur">
        Live region map
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-md border border-sky-400/35 bg-sky-400/10 px-2 py-1 text-sky-100">
          blue: ingress traffic
        </span>
        <span className="rounded-md border border-emerald-400/35 bg-emerald-400/10 px-2 py-1 text-emerald-100">
          green: data path
        </span>
        <span className="rounded-md border border-amber-400/35 bg-amber-400/10 px-2 py-1 text-amber-100">
          amber: degraded
        </span>
        <span className="rounded-md border border-red-400/35 bg-red-400/10 px-2 py-1 text-red-100">
          red: failed
        </span>
      </div>
    </div>
  );
}

function CloudRegionFallbackMap({
  scenario,
  traffic,
  failoverAutomation,
  selectedLayer,
}: {
  scenario: Scenario;
  traffic: number;
  failoverAutomation: boolean;
  selectedLayer: LayerId;
}) {
  const azNames = ['AZ-a', 'AZ-b', 'AZ-c'];
  const primaryIndex = scenario.id === 'db-failover' && failoverAutomation ? 2 : 0;

  return (
    <div className="relative min-h-[640px] overflow-hidden bg-[#07111f] p-4 text-slate-100">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:42px_42px]" />
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 900 560" preserveAspectRatio="none" aria-hidden="true">
        <path d="M450 76C326 104 205 160 166 244" fill="none" stroke="#38bdf8" strokeWidth="5" strokeLinecap="round" />
        <path d="M450 76C456 124 456 172 450 244" fill="none" stroke={scenario.tone === 'bad' ? '#ef4444' : '#38bdf8'} strokeWidth="5" strokeLinecap="round" />
        <path d="M450 76C582 110 701 164 734 244" fill="none" stroke={scenario.tone === 'warn' ? '#f59e0b' : '#38bdf8'} strokeWidth="5" strokeLinecap="round" />
        <path d="M164 392C308 474 590 472 736 392" fill="none" stroke="#22c55e" strokeWidth="6" strokeLinecap="round" />
      </svg>

      <div className="relative z-10 mx-auto flex h-full min-h-[600px] max-w-5xl flex-col">
        <div className="mx-auto mb-8 rounded-md border border-primary/45 bg-black/45 px-4 py-2 text-sm font-semibold text-primary shadow-lg">
          Load balancer - {traffic}% traffic pressure
        </div>

        <div className="grid flex-1 items-center gap-4 md:grid-cols-3">
          {azNames.map((name, index) => {
            const failed = scenario.affectedAzs.includes(index);
            const overloaded = !failed && scenario.tone !== 'good' && scenario.affectedLayers.length > 0;
            const layerTone = failed ? 'bad' : overloaded ? 'warn' : 'good';

            return (
              <div
                key={name}
                className={cn(
                  'relative rounded-md border p-4 shadow-2xl backdrop-blur',
                  layerTone === 'bad' && 'border-red-400/70 bg-red-950/50',
                  layerTone === 'warn' && 'border-amber-400/70 bg-amber-950/45',
                  layerTone === 'good' && 'border-emerald-400/45 bg-emerald-950/35'
                )}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold">{name}</p>
                    <p className="text-xs text-slate-300">
                      {failed ? 'unreachable' : overloaded ? 'absorbing failover' : 'healthy'}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'h-3 w-3 rounded-full',
                      layerTone === 'bad' ? 'bg-red-400' : layerTone === 'warn' ? 'bg-amber-400' : 'bg-emerald-400'
                    )}
                  />
                </div>

                <div className="space-y-3">
                  <FallbackLayer
                    label="edge"
                    active={selectedLayer === 'edge'}
                    affected={failed || scenario.affectedLayers.includes('edge')}
                  />
                  <FallbackLayer
                    label="app services"
                    active={selectedLayer === 'app'}
                    affected={failed || scenario.affectedLayers.includes('app')}
                  />
                  <FallbackLayer
                    label="queue + workers"
                    active={selectedLayer === 'queue'}
                    affected={failed || scenario.affectedLayers.includes('queue')}
                  />
                  <FallbackLayer
                    label={primaryIndex === index ? 'primary database' : 'replica database'}
                    active={selectedLayer === 'data'}
                    affected={failed || scenario.affectedLayers.includes('data')}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-md border border-white/10 bg-black/35 p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge className={cn('border', toneClass(scenario.tone))}>{scenario.title}</Badge>
          </div>
          <p className="text-sm leading-relaxed text-slate-300">{scenario.lesson}</p>
        </div>
      </div>
    </div>
  );
}

function FallbackLayer({ label, active, affected }: { label: string; active: boolean; affected: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-md border px-3 py-2 text-sm',
        active ? 'border-primary/70 bg-primary/15 text-primary' : 'border-white/10 bg-black/25 text-slate-200',
        affected && !active && 'border-amber-400/45 bg-amber-400/10 text-amber-100'
      )}
    >
      <span>{label}</span>
      <span className={cn('h-2 w-2 rounded-full', affected ? 'bg-amber-400' : 'bg-emerald-400')} />
    </div>
  );
}
