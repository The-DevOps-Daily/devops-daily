'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Cloud,
  Server,
  Shield,
  Network,
  Router,
  Info,
  PlayCircle,
  ChevronRight,
  ChevronLeft,
  Play,
} from 'lucide-react';
import { MotionConfig } from 'framer-motion';
import {
  SIM_CATEGORY,
  SimAnnouncer,
  SimBar,
  SimComplete,
  SimFeedback,
  SimFrame,
  SimMissionList,
  SimPhoneBar,
  SimResetButton,
  SimStage,
  useMissions,
  type Mission,
} from '@/components/games/sim';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ===========================================================================

type ComponentType =
  | 'igw'
  | 'nat-gateway'
  | 'public-subnet'
  | 'private-subnet'
  | 'public-ec2'
  | 'private-ec2'
  | 'public-route-table'
  | 'private-route-table';

interface VpcComponentDef {
  type: ComponentType;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  category: 'core' | 'public' | 'private';
  dependencies?: ComponentType[];
}

interface ValidationResult {
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  component?: ComponentType;
}

type TrafficScenario = 'internet-to-public' | 'private-to-internet' | 'public-to-private';

interface TrafficStep {
  id: number;
  title: string;
  location: string;
  explanation: string;
  highlight: ComponentType[];
}

interface TrafficScenarioDef {
  id: TrafficScenario;
  name: string;
  description: string;
  requiredComponents: ComponentType[];
}

const TRAFFIC_SCENARIOS: TrafficScenarioDef[] = [
  {
    id: 'internet-to-public',
    name: 'Internet → Public EC2',
    description: 'How traffic flows from the internet to a public-facing web server',
    requiredComponents: ['igw', 'public-subnet', 'public-ec2', 'public-route-table'],
  },
  {
    id: 'private-to-internet',
    name: 'Private EC2 → Internet',
    description: 'How a private database server fetches updates from the internet',
    requiredComponents: [
      'igw',
      'nat-gateway',
      'public-subnet',
      'public-route-table',
      'private-subnet',
      'private-ec2',
      'private-route-table',
    ],
  },
  {
    id: 'public-to-private',
    name: 'Public EC2 → Private EC2',
    description: 'How a web server communicates with a private database',
    requiredComponents: ['public-subnet', 'private-subnet', 'public-ec2', 'private-ec2'],
  },
];

function generateTrafficSteps(scenario: TrafficScenario): TrafficStep[] {
  switch (scenario) {
    case 'internet-to-public':
      return [
        {
          id: 1,
          title: 'Request from Internet',
          location: 'Internet',
          explanation:
            "A user from the internet sends a request to your EC2 instance's public IP address.",
          highlight: [],
        },
        {
          id: 2,
          title: 'Internet Gateway',
          location: 'VPC Edge',
          explanation:
            'The request arrives at the Internet Gateway, which is the entry/exit point for all internet traffic in your VPC.',
          highlight: ['igw'],
        },
        {
          id: 3,
          title: 'Route Table Lookup',
          location: 'Public Subnet',
          explanation:
            "The public route table sends 0.0.0.0/0 to the Internet Gateway, which is what makes the subnet public. The gateway maps the public IP to the instance's private IP, and the local route delivers it.",
          highlight: ['public-route-table'],
        },
        {
          id: 4,
          title: 'Arrives at EC2',
          location: 'Public Subnet',
          explanation:
            'The traffic reaches your EC2 instance in the public subnet. Security groups will filter if the traffic is allowed.',
          highlight: ['public-ec2', 'public-subnet'],
        },
      ];
    case 'private-to-internet':
      return [
        {
          id: 1,
          title: 'Private EC2 Request',
          location: 'Private Subnet',
          explanation:
            'Your private EC2 instance (e.g., a database) needs to download updates from the internet.',
          highlight: ['private-ec2', 'private-subnet'],
        },
        {
          id: 2,
          title: 'Route Table Lookup',
          location: 'Private Subnet',
          explanation:
            'The private route table has a rule: 0.0.0.0/0 → NAT Gateway. This routes all internet-bound traffic to the NAT.',
          highlight: ['private-route-table'],
        },
        {
          id: 3,
          title: 'NAT Gateway Translation',
          location: 'Public Subnet',
          explanation:
            'The NAT Gateway translates the private IP to its own Elastic IP, hiding the private EC2. It lives in the public subnet, whose route table sends 0.0.0.0/0 to the Internet Gateway.',
          highlight: ['nat-gateway', 'public-subnet', 'public-route-table'],
        },
        {
          id: 4,
          title: 'To Internet Gateway',
          location: 'VPC Edge',
          explanation:
            "The request (now from NAT's public IP) exits through the Internet Gateway to reach the internet.",
          highlight: ['igw'],
        },
        {
          id: 5,
          title: 'Response Returns',
          location: 'VPC',
          explanation:
            'The response comes back to NAT Gateway, which translates it back and forwards to the private EC2.',
          highlight: ['igw', 'nat-gateway', 'private-ec2'],
        },
      ];
    case 'public-to-private':
      return [
        {
          id: 1,
          title: 'Web Server Request',
          location: 'Public Subnet',
          explanation:
            'Your web server in the public subnet needs to query the database in the private subnet.',
          highlight: ['public-ec2', 'public-subnet'],
        },
        {
          id: 2,
          title: 'Internal VPC Routing',
          location: 'VPC',
          explanation:
            'Traffic within the VPC (10.0.0.0/16) stays local. The route table knows how to reach other subnets directly.',
          highlight: ['public-route-table'],
        },
        {
          id: 3,
          title: 'Arrives at Private EC2',
          location: 'Private Subnet',
          explanation:
            'The request reaches your private database. No NAT or IGW needed for internal VPC traffic!',
          highlight: ['private-ec2', 'private-subnet'],
        },
        {
          id: 4,
          title: 'Response Sent Back',
          location: 'Private Subnet',
          explanation:
            'The database responds directly to the web server via the internal VPC network.',
          highlight: ['private-ec2', 'public-ec2'],
        },
      ];
    default:
      return [];
  }
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AVAILABLE_COMPONENTS: VpcComponentDef[] = [
  {
    type: 'igw',
    name: 'Internet Gateway',
    description: 'Enables internet access for your VPC. Required for any public-facing resources.',
    icon: Router,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    category: 'core',
  },
  {
    type: 'nat-gateway',
    name: 'NAT Gateway',
    description:
      'Allows private resources to access internet without being publicly accessible. Must be in a public subnet.',
    icon: Shield,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    category: 'private',
    dependencies: ['igw', 'public-subnet'],
  },
  {
    type: 'public-subnet',
    name: 'Public Subnet',
    description:
      'A subnet with a route to the Internet Gateway. Resources here can have public IPs.',
    icon: Cloud,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    category: 'public',
    dependencies: ['igw'],
  },
  {
    type: 'private-subnet',
    name: 'Private Subnet',
    description:
      'A subnet without direct internet access. Resources are protected from public exposure.',
    icon: Cloud,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    category: 'private',
  },
  {
    type: 'public-ec2',
    name: 'Public EC2 Instance',
    description:
      'A compute instance in a public subnet. Can be accessed directly from the internet.',
    icon: Server,
    color: 'text-green-600',
    bgColor: 'bg-green-600/10',
    category: 'public',
    dependencies: ['public-subnet'],
  },
  {
    type: 'private-ec2',
    name: 'Private EC2 Instance',
    description:
      'A compute instance in a private subnet. Cannot be accessed directly from the internet.',
    icon: Server,
    color: 'text-red-600',
    bgColor: 'bg-red-600/10',
    category: 'private',
    dependencies: ['private-subnet'],
  },
  {
    type: 'public-route-table',
    name: 'Public Route Table',
    description: 'Routes traffic to the Internet Gateway for public subnets (0.0.0.0/0 -> IGW).',
    icon: Network,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
    category: 'public',
    dependencies: ['igw', 'public-subnet'],
  },
  {
    type: 'private-route-table',
    name: 'Private Route Table',
    description: 'Routes traffic to NAT Gateway for private subnets (0.0.0.0/0 -> NAT).',
    icon: Network,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    category: 'private',
    dependencies: ['private-subnet'],
  },
];

const COMPONENT_MAP = Object.fromEntries(AVAILABLE_COMPONENTS.map((c) => [c.type, c])) as Record<
  ComponentType,
  VpcComponentDef
>;

// ============================================================================
// VALIDATION LOGIC
// ============================================================================

function validateConfiguration(activeComponents: Set<ComponentType>): ValidationResult[] {
  const results: ValidationResult[] = [];
  const active = Array.from(activeComponents);

  // Check for missing dependencies
  for (const compType of active) {
    const comp = COMPONENT_MAP[compType];
    if (comp.dependencies) {
      for (const dep of comp.dependencies) {
        if (!activeComponents.has(dep)) {
          results.push({
            type: 'error',
            message: `${comp.name} requires ${COMPONENT_MAP[dep].name} to function.`,
            component: compType,
          });
        }
      }
    }
  }

  // Check for unused components
  if (activeComponents.has('igw') && !activeComponents.has('public-subnet')) {
    results.push({
      type: 'warning',
      message: 'Internet Gateway is not useful without a Public Subnet.',
      component: 'igw',
    });
  }

  if (activeComponents.has('nat-gateway') && !activeComponents.has('private-subnet')) {
    results.push({
      type: 'warning',
      message: 'NAT Gateway is not useful without a Private Subnet.',
      component: 'nat-gateway',
    });
  }

  if (
    activeComponents.has('private-subnet') &&
    !activeComponents.has('nat-gateway') &&
    activeComponents.has('private-ec2')
  ) {
    results.push({
      type: 'warning',
      message: 'Private EC2 cannot access the internet without a NAT Gateway.',
      component: 'private-ec2',
    });
  }

  if (activeComponents.has('public-subnet') && !activeComponents.has('public-route-table')) {
    results.push({
      type: 'info',
      message:
        'Consider adding a Public Route Table to properly route traffic in your public subnet.',
      component: 'public-subnet',
    });
  }

  if (
    activeComponents.has('private-subnet') &&
    activeComponents.has('nat-gateway') &&
    !activeComponents.has('private-route-table')
  ) {
    results.push({
      type: 'info',
      message: 'Consider adding a Private Route Table to route traffic through NAT Gateway.',
      component: 'private-subnet',
    });
  }

  // Success cases
  if (results.length === 0 && active.length > 0) {
    const hasPublicArch =
      activeComponents.has('igw') &&
      activeComponents.has('public-subnet') &&
      activeComponents.has('public-ec2');
    const hasPrivateArch =
      activeComponents.has('private-subnet') && activeComponents.has('private-ec2');
    const hasNat = activeComponents.has('nat-gateway');

    if (hasPublicArch && hasPrivateArch && hasNat) {
      results.push({
        type: 'success',
        message:
          'Complete VPC architecture! Public web tier + private database tier with NAT for outbound access.',
      });
    } else if (hasPublicArch) {
      results.push({
        type: 'success',
        message:
          'Valid public-facing architecture. Your EC2 can receive traffic from the internet.',
      });
    } else if (hasPrivateArch && hasNat) {
      results.push({
        type: 'success',
        message:
          'Valid private architecture with NAT. Resources can access internet without being exposed.',
      });
    }
  }

  return results;
}

interface RunResult {
  scenario: TrafficScenario;
  passed: boolean;
  message: string;
}

interface VpcMissionState {
  runResults: RunResult[];
}

const VPC_MISSIONS: Mission<VpcMissionState>[] = [
  {
    id: 'public-web',
    label: 'Let the internet reach a web server in a public subnet.',
    hint: 'Press Public Web Server (an internet gateway, a public subnet, a route table sending 0.0.0.0/0 to the gateway and an EC2), then Run and Next to the last step.',
    check: (state) =>
      state.runResults.some((result) => result.scenario === 'internet-to-public' && result.passed),
  },
  {
    id: 'private-out',
    label: 'Let a server in a private subnet download updates, without being reachable.',
    hint: 'Press Private with NAT, pick Private EC2 → Internet, then Run and Next to the end. The NAT sits in a public subnet that routes to the internet gateway.',
    check: (state) =>
      state.runResults.some((result) => result.scenario === 'private-to-internet' && result.passed),
  },
  {
    id: 'public-to-private',
    label: 'Let the web server talk to a private app server.',
    hint: 'Press Full Architecture, pick Public EC2 → Private EC2, then Run and Next to the end. The local route connects every subnet in a VPC.',
    check: (state) =>
      state.runResults.some((result) => result.scenario === 'public-to-private' && result.passed),
  },
  {
    id: 'broken',
    label: 'Run a scenario with a piece missing and read why it fails.',
    hint: 'Press Private with NAT, click NAT Gateway to remove it, pick Private EC2 → Internet and press Run to read why it is blocked.',
    check: (state) => state.runResults.some((result) => !result.passed && Boolean(result.message)),
  },
];

export default function AwsVpcSimulator() {
  const [activeComponents, setActiveComponents] = useState<Set<ComponentType>>(new Set());
  const [selectedInfo, setSelectedInfo] = useState<ComponentType | null>(null);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<TrafficScenario | null>(null);
  const [trafficSteps, setTrafficSteps] = useState<TrafficStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [isSimulating, setIsSimulating] = useState(false);

  const validation = useMemo(() => validateConfiguration(activeComponents), [activeComponents]);

  const isHighlighted = useCallback(
    (type: ComponentType) => {
      if (!isSimulating || currentStepIndex < 0) return false;
      const step = trafficSteps[currentStepIndex];
      return step?.highlight?.includes(type) ?? false;
    },
    [isSimulating, currentStepIndex, trafficSteps]
  );

  const toggleComponent = useCallback((type: ComponentType) => {
    setActiveComponents((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setActiveComponents(new Set());
    setSelectedInfo(null);
    setShowTestPanel(false);
    setSelectedScenario(null);
    setTrafficSteps([]);
    setCurrentStepIndex(-1);
    setIsSimulating(false);
  }, []);

  const startSimulation = useCallback((scenario: TrafficScenario) => {
    const scenarioDef = TRAFFIC_SCENARIOS.find((s) => s.id === scenario);
    if (!scenarioDef) return;
    setActiveComponents(new Set(scenarioDef.requiredComponents));
    setSelectedScenario(scenario);
    const steps = generateTrafficSteps(scenario);
    setTrafficSteps(steps);
    setCurrentStepIndex(0);
    setIsSimulating(true);
  }, []);

  void startSimulation;

  const stopSimulation = useCallback(() => {
    setSelectedScenario(null);
    setTrafficSteps([]);
    setCurrentStepIndex(-1);
    setIsSimulating(false);
  }, []);

  const stepForward = useCallback(() => {
    if (currentStepIndex < trafficSteps.length - 1) {
      setCurrentStepIndex((i) => i + 1);
    }
  }, [currentStepIndex, trafficSteps.length]);

  const stepBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((i) => i - 1);
    }
  }, [currentStepIndex]);

  const loadPreset = useCallback((preset: 'public' | 'private' | 'full') => {
    const presets: Record<string, ComponentType[]> = {
      public: ['igw', 'public-subnet', 'public-route-table', 'public-ec2'],
      private: [
        'igw',
        'public-subnet',
        'public-route-table',
        'nat-gateway',
        'private-subnet',
        'private-route-table',
        'private-ec2',
      ],
      full: [
        'igw',
        'public-subnet',
        'public-route-table',
        'public-ec2',
        'nat-gateway',
        'private-subnet',
        'private-route-table',
        'private-ec2',
      ],
    };
    setActiveComponents(new Set(presets[preset]));
  }, []);

  // Group components by category
  const groupedComponents = useMemo(() => {
    const groups: Record<string, VpcComponentDef[]> = {
      core: [],
      public: [],
      private: [],
    };
    AVAILABLE_COMPONENTS.forEach((c) => groups[c.category].push(c));
    return groups;
  }, []);

  const [runResults, setRunResults] = useState<RunResult[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [tab, setTab] = useState('diagram');
  const missionState = useMemo(() => ({ runResults }), [runResults]);
  const missions = useMissions(VPC_MISSIONS, missionState);
  const scenario = TRAFFIC_SCENARIOS.find((item) => item.id === selectedScenario) ?? null;
  const currentStep = trafficSteps[currentStepIndex] ?? null;

  const startOver = useCallback(() => {
    reset();
    setRunResults([]);
    setDismissed(false);
    missions.reset();
  }, [missions, reset]);

  const runScenario = useCallback(() => {
    if (!selectedScenario) return;
    const scenarioDef = TRAFFIC_SCENARIOS.find((item) => item.id === selectedScenario);
    if (!scenarioDef) return;
    const missing = scenarioDef.requiredComponents.filter(
      (component) => !activeComponents.has(component)
    );
    if (missing.length > 0) {
      const message = `Blocked: add ${missing.map((component) => COMPONENT_MAP[component].name).join(', ')}.`;
      setTrafficSteps([]);
      setCurrentStepIndex(-1);
      setIsSimulating(false);
      setRunResults((results) => [
        ...results,
        { scenario: selectedScenario, passed: false, message },
      ]);
      return;
    }
    setTrafficSteps(generateTrafficSteps(selectedScenario));
    setCurrentStepIndex(0);
    setIsSimulating(true);
  }, [activeComponents, selectedScenario]);

  const finishTraffic = useCallback(() => {
    if (!selectedScenario) return;
    setIsSimulating(false);
    setRunResults((results) => [
      ...results,
      {
        scenario: selectedScenario,
        passed: true,
        message: `${scenario?.name ?? 'Traffic'} completed.`,
      },
    ]);
  }, [scenario?.name, selectedScenario]);

  const nextTraffic = useCallback(() => {
    if (currentStepIndex === trafficSteps.length - 1) {
      finishTraffic();
      return;
    }
    stepForward();
  }, [currentStepIndex, finishTraffic, stepForward, trafficSteps.length]);

  const feedback = runResults.at(-1);
  const componentGroups = Object.entries(groupedComponents).map(([category, components]) => (
    <section key={category} className="space-y-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {category} layer
      </h3>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {components.map((component) => {
          const Icon = component.icon;
          const active = activeComponents.has(component.type);
          return (
            <div key={component.type} className="flex gap-1.5">
              <Button
                type="button"
                variant={active ? 'default' : 'outline'}
                className="h-10 min-w-0 flex-1 justify-start text-left text-xs"
                aria-pressed={active}
                onClick={() => toggleComponent(component.type)}
              >
                <Icon className="mr-1.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{component.name}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 w-10 shrink-0 px-0"
                aria-label={`About ${component.name}`}
                onClick={() =>
                  setSelectedInfo(selectedInfo === component.type ? null : component.type)
                }
              >
                <Info className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  ));

  const trafficControls = (phone = false) => (
    <>
      <Button
        type="button"
        size="sm"
        className={cn('h-10', phone && 'flex-1')}
        onClick={runScenario}
        disabled={!selectedScenario || isSimulating}
      >
        <Play className="mr-1.5 h-4 w-4" aria-hidden="true" /> Run
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10"
        aria-label="Previous traffic step"
        onClick={stepBack}
        disabled={!isSimulating || currentStepIndex <= 0}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10"
        onClick={nextTraffic}
        disabled={!isSimulating}
      >
        {currentStepIndex === trafficSteps.length - 1 ? 'Finish' : 'Next'}
        <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
      </Button>
    </>
  );

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar>
        <SimBar
          title="AWS VPC Simulator"
          icon={Network}
          lead={
            <div
              role="group"
              aria-label="Traffic scenario"
              className="flex w-full flex-wrap gap-1 sm:w-auto"
            >
              {TRAFFIC_SCENARIOS.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  variant={selectedScenario === item.id ? 'default' : 'outline'}
                  size="sm"
                  className="h-10 text-xs lg:h-8"
                  aria-pressed={selectedScenario === item.id}
                  onClick={() => {
                    stopSimulation();
                    setSelectedScenario(item.id);
                  }}
                >
                  {item.name}
                </Button>
              ))}
            </div>
          }
          tools={<SimResetButton onReset={startOver} />}
          steps={
            isSimulating
              ? trafficSteps.map((step, index) => ({
                  title: step.title,
                  status:
                    index < currentStepIndex
                      ? 'done'
                      : index === currentStepIndex
                        ? 'started'
                        : 'todo',
                }))
              : undefined
          }
          current={Math.max(currentStepIndex, 0)}
          onStep={(index) => {
            if (isSimulating && index <= currentStepIndex) setCurrentStepIndex(index);
          }}
          stepNoun="Traffic step"
          stepsLabel="Traffic steps"
          progress={{ current: missions.done, total: missions.total }}
          heading={
            isSimulating && currentStep ? currentStep.title : (scenario?.name ?? 'Build a route')
          }
          actions={<div className="hidden gap-1 lg:flex">{trafficControls()}</div>}
          goal={
            missions.current ? (
              <>
                {missions.current.label}{' '}
                <span className="text-muted-foreground">{missions.current.hint}</span>
              </>
            ) : (
              'All four routes are mapped. Try another configuration.'
            )
          }
        />
        <SimAnnouncer
          message={
            feedback
              ? feedback.message
              : currentStep
                ? `Traffic step ${currentStep.id}: ${currentStep.title}.`
                : 'Choose a traffic scenario, then build its route.'
          }
        />

        {missions.complete && !dismissed ? (
          <SimComplete
            title="VPC routes mapped"
            summary="You routed public traffic, private outbound traffic, internal VPC traffic, and diagnosed a missing dependency."
            stats={[
              { label: 'Missions', value: `${missions.done}/${missions.total}` },
              { label: 'Routes run', value: runResults.filter((result) => result.passed).length },
              { label: 'Components', value: activeComponents.size },
            ]}
            actions={
              <Button type="button" variant="outline" onClick={() => setDismissed(true)}>
                Keep exploring
              </Button>
            }
            onPlayAgain={startOver}
            playAgainLabel="Start over"
          />
        ) : (
          <SimStage
            columns="lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
            minHeight="min-h-[22rem]"
            tab={tab}
            onTabChange={(value) => {
              if (value === 'diagram' || value === 'details') setTab(value);
            }}
            tabsLabel="VPC simulator panels"
            panels={[
              {
                id: 'diagram',
                label: 'VPC diagram',
                content: (
                  <section
                    data-testing={showTestPanel ? 'open' : undefined}
                    className="space-y-2 rounded-lg border bg-card p-3"
                    aria-label="VPC architecture diagram"
                  >
                    <svg
                      viewBox="0 0 390 280"
                      className="mx-auto block w-full max-w-[440px]"
                      role="img"
                      aria-label="VPC traffic diagram"
                    >
                      <rect
                        x="18"
                        y="24"
                        width="354"
                        height="232"
                        rx="12"
                        className="fill-muted stroke-border"
                      />
                      <text x="34" y="48" className="fill-foreground text-xs font-semibold">
                        VPC 10.0.0.0/16
                      </text>
                      <rect
                        x="36"
                        y="66"
                        width="145"
                        height="160"
                        rx="10"
                        className={cn(
                          'stroke-2',
                          activeComponents.has('public-subnet')
                            ? SIM_CATEGORY.sky.svg
                            : 'fill-muted stroke-border'
                        )}
                      />
                      <text x="48" y="90" className="fill-foreground text-xs font-semibold">
                        Public subnet
                      </text>
                      <rect
                        x="208"
                        y="66"
                        width="145"
                        height="160"
                        rx="10"
                        className={cn(
                          'stroke-2',
                          activeComponents.has('private-subnet')
                            ? SIM_CATEGORY.violet.svg
                            : 'fill-muted stroke-border'
                        )}
                      />
                      <text x="220" y="90" className="fill-foreground text-xs font-semibold">
                        Private subnet
                      </text>
                      {activeComponents.has('public-ec2') && (
                        <text x="55" y="142" className="fill-foreground text-xs">
                          EC2 web
                        </text>
                      )}
                      {activeComponents.has('public-route-table') && (
                        <text x="55" y="170" className="fill-muted-foreground text-xs">
                          route: IGW
                        </text>
                      )}
                      {activeComponents.has('nat-gateway') && (
                        <text x="55" y="198" className="fill-foreground text-xs">
                          NAT gateway
                        </text>
                      )}
                      {activeComponents.has('private-ec2') && (
                        <text x="228" y="142" className="fill-foreground text-xs">
                          EC2 app
                        </text>
                      )}
                      {activeComponents.has('private-route-table') && (
                        <text x="228" y="170" className="fill-muted-foreground text-xs">
                          route: NAT
                        </text>
                      )}
                      {activeComponents.has('igw') && (
                        <text x="150" y="246" className="fill-foreground text-xs">
                          Internet gateway
                        </text>
                      )}
                      {isHighlighted('igw') && (
                        <circle
                          cx="195"
                          cy="237"
                          r="15"
                          className="fill-primary/20 stroke-primary"
                        />
                      )}
                    </svg>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10"
                        onClick={() => loadPreset('public')}
                      >
                        <PlayCircle className="mr-1 h-4 w-4" aria-hidden="true" />
                        Public Web Server
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10"
                        onClick={() => loadPreset('private')}
                      >
                        <PlayCircle className="mr-1 h-4 w-4" aria-hidden="true" />
                        Private with NAT
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10"
                        onClick={() => loadPreset('full')}
                      >
                        <PlayCircle className="mr-1 h-4 w-4" aria-hidden="true" />
                        Full Architecture
                      </Button>
                    </div>
                    <div className="rounded-md border bg-muted/50 p-2 text-sm">
                      {currentStep ? (
                        <>
                          <strong>{currentStep.location}:</strong> {currentStep.explanation}
                        </>
                      ) : (
                        'Select a scenario, assemble its components, then run the route.'
                      )}
                    </div>
                  </section>
                ),
              },
              {
                id: 'details',
                label: 'Components',
                content: (
                  <div className="space-y-2">
                    <section className="space-y-2 rounded-lg border bg-card p-3">
                      {componentGroups}
                    </section>
                    {selectedInfo && (
                      <SimFeedback
                        tone="info"
                        label={COMPONENT_MAP[selectedInfo].name}
                        onDismiss={() => setSelectedInfo(null)}
                      >
                        {COMPONENT_MAP[selectedInfo].description}
                      </SimFeedback>
                    )}
                    {feedback && (
                      <SimFeedback
                        tone={feedback.passed ? 'success' : 'danger'}
                        label={feedback.passed ? 'Route completed' : 'Route blocked'}
                      >
                        {feedback.message}
                      </SimFeedback>
                    )}
                    {validation.length > 0 && (
                      <SimFeedback tone="warning" label="Configuration note">
                        {validation[0].message}
                      </SimFeedback>
                    )}
                    <SimMissionList missions={missions.missions} />
                    <details className="rounded-lg border bg-card p-3">
                      <summary className="cursor-pointer text-sm font-medium">
                        How routing works
                      </summary>
                      <p className="mt-2 text-sm text-muted-foreground">
                        A public subnet sends its default route to an internet gateway. A private
                        subnet sends outbound traffic to a NAT gateway in the public subnet, while
                        the VPC local route connects its subnets.
                      </p>
                    </details>
                  </div>
                ),
              },
            ]}
          />
        )}
        <SimPhoneBar>{trafficControls(true)}</SimPhoneBar>
      </SimFrame>
    </MotionConfig>
  );
}
