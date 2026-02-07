'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Cloud,
  Server,
  Globe,
  ArrowRight,
  ArrowDown,
  Play,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Shield,
  Network,
  Router,
  Keyboard,
  Info,
  X,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

type ScenarioId = 'internet-to-public' | 'private-to-internet' | 'public-to-private' | 'broken-nat';

interface TrafficStep {
  id: number;
  title: string;
  location: ComponentId;
  explanation: string;
  isError?: boolean;
}

type ComponentId =
  | 'internet'
  | 'igw'
  | 'public-route-table'
  | 'public-subnet'
  | 'public-ec2'
  | 'nat-gateway'
  | 'private-route-table'
  | 'private-subnet'
  | 'private-ec2';

interface VpcComponent {
  id: ComponentId;
  name: string;
  shortName: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

interface Scenario {
  id: ScenarioId;
  title: string;
  description: string;
  steps: TrafficStep[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const VPC_COMPONENTS: Record<ComponentId, VpcComponent> = {
  internet: {
    id: 'internet',
    name: 'Internet',
    shortName: 'Internet',
    description: 'The public internet - where external users and services live',
    icon: Globe,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  igw: {
    id: 'igw',
    name: 'Internet Gateway',
    shortName: 'IGW',
    description: 'Allows communication between your VPC and the internet. Horizontally scaled and highly available.',
    icon: Router,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  'public-route-table': {
    id: 'public-route-table',
    name: 'Public Route Table',
    shortName: 'Route Table',
    description: 'Routes 0.0.0.0/0 (all internet traffic) to the Internet Gateway',
    icon: Network,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
  },
  'public-subnet': {
    id: 'public-subnet',
    name: 'Public Subnet',
    shortName: 'Public',
    description: 'Subnet with route to IGW. Resources can have public IPs. CIDR: 10.0.1.0/24',
    icon: Cloud,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  'public-ec2': {
    id: 'public-ec2',
    name: 'Public EC2 Instance',
    shortName: 'Web Server',
    description: 'EC2 instance in public subnet with public IP (e.g., web server, bastion host)',
    icon: Server,
    color: 'text-green-600',
    bgColor: 'bg-green-600/10',
  },
  'nat-gateway': {
    id: 'nat-gateway',
    name: 'NAT Gateway',
    shortName: 'NAT GW',
    description: 'Allows private subnet instances to access internet while blocking inbound connections. Placed in public subnet.',
    icon: Shield,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
  'private-route-table': {
    id: 'private-route-table',
    name: 'Private Route Table',
    shortName: 'Route Table',
    description: 'Routes 0.0.0.0/0 to NAT Gateway (not directly to internet)',
    icon: Network,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
  },
  'private-subnet': {
    id: 'private-subnet',
    name: 'Private Subnet',
    shortName: 'Private',
    description: 'No direct internet access. Protected from public internet. CIDR: 10.0.2.0/24',
    icon: Cloud,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  'private-ec2': {
    id: 'private-ec2',
    name: 'Private EC2 Instance',
    shortName: 'App Server',
    description: 'EC2 instance in private subnet (e.g., application server, database)',
    icon: Server,
    color: 'text-blue-600',
    bgColor: 'bg-blue-600/10',
  },
};

const SCENARIOS: Scenario[] = [
  {
    id: 'internet-to-public',
    title: 'Internet → Public EC2',
    description: 'How external users reach a public web server',
    steps: [
      {
        id: 1,
        title: 'User Request from Internet',
        location: 'internet',
        explanation: 'A user on the internet wants to access your web application. They type your domain name which resolves to your EC2\'s public IP address.',
      },
      {
        id: 2,
        title: 'Traffic Hits Internet Gateway',
        location: 'igw',
        explanation: 'The Internet Gateway receives the incoming traffic. It\'s the entry point to your VPC from the internet. IGW performs 1:1 NAT between public and private IPs.',
      },
      {
        id: 3,
        title: 'Route Table Lookup',
        location: 'public-route-table',
        explanation: 'The route table determines where to send the traffic. It sees the destination is 10.0.1.x (public subnet CIDR) and routes locally within the VPC.',
      },
      {
        id: 4,
        title: 'Traffic Enters Public Subnet',
        location: 'public-subnet',
        explanation: 'Traffic enters the public subnet (10.0.1.0/24). Security Groups and NACLs are evaluated to allow or deny the traffic.',
      },
      {
        id: 5,
        title: 'Reaches EC2 Instance',
        location: 'public-ec2',
        explanation: 'The web server receives the request! The Security Group must allow inbound traffic on the appropriate port (e.g., 80/443 for HTTP/HTTPS).',
      },
    ],
  },
  {
    id: 'private-to-internet',
    title: 'Private EC2 → Internet',
    description: 'How a private instance accesses the internet (e.g., for updates)',
    steps: [
      {
        id: 1,
        title: 'Private Instance Initiates Request',
        location: 'private-ec2',
        explanation: 'Your application server in the private subnet needs to download updates or call an external API. It has no public IP, only a private IP (10.0.2.x).',
      },
      {
        id: 2,
        title: 'Private Route Table Lookup',
        location: 'private-route-table',
        explanation: 'The route table checks the destination. For 0.0.0.0/0 (internet), it routes to the NAT Gateway instead of directly to IGW.',
      },
      {
        id: 3,
        title: 'Traffic Exits Private Subnet',
        location: 'private-subnet',
        explanation: 'Traffic leaves the private subnet heading toward the NAT Gateway in the public subnet.',
      },
      {
        id: 4,
        title: 'NAT Gateway Translates',
        location: 'nat-gateway',
        explanation: 'NAT Gateway replaces the private source IP with its own public IP. This allows the response to come back. It\'s like a post office forwarding address!',
      },
      {
        id: 5,
        title: 'Public Route Table',
        location: 'public-route-table',
        explanation: 'Traffic from NAT Gateway uses the public route table. For internet-bound traffic (0.0.0.0/0), it routes to the Internet Gateway.',
      },
      {
        id: 6,
        title: 'Through Internet Gateway',
        location: 'igw',
        explanation: 'The Internet Gateway sends the traffic to the internet. The source IP is now the NAT Gateway\'s public IP, hiding your private instance.',
      },
      {
        id: 7,
        title: 'Reaches the Internet',
        location: 'internet',
        explanation: 'Request reaches the external service! The response will follow the reverse path, with NAT Gateway translating back to your private instance.',
      },
    ],
  },
  {
    id: 'public-to-private',
    title: 'Public EC2 → Private EC2',
    description: 'How your web server talks to your app server',
    steps: [
      {
        id: 1,
        title: 'Web Server Sends Request',
        location: 'public-ec2',
        explanation: 'Your public web server needs data from the application server in the private subnet. It uses the private IP (10.0.2.x) as the destination.',
      },
      {
        id: 2,
        title: 'Route Table Lookup',
        location: 'public-route-table',
        explanation: 'The route table sees destination 10.0.2.x. This matches the VPC CIDR (10.0.0.0/16), so traffic stays local - no need to go through IGW or NAT.',
      },
      {
        id: 3,
        title: 'Traffic Crosses Subnets',
        location: 'private-subnet',
        explanation: 'Traffic moves directly between subnets within the VPC. This is internal routing - fast and free (no NAT Gateway charges).',
      },
      {
        id: 4,
        title: 'Reaches Private Instance',
        location: 'private-ec2',
        explanation: 'The app server receives the request. Security Groups must allow traffic from the web server\'s Security Group or IP range.',
      },
    ],
  },
  {
    id: 'broken-nat',
    title: 'Troubleshooting: No NAT Gateway',
    description: 'What happens when private instance can\'t reach internet',
    steps: [
      {
        id: 1,
        title: 'Private Instance Tries Internet',
        location: 'private-ec2',
        explanation: 'Your app server tries to download a package from the internet. It sends a request to an external IP address.',
      },
      {
        id: 2,
        title: 'Route Table Check',
        location: 'private-route-table',
        explanation: 'The route table looks for a route to 0.0.0.0/0 (internet). Without a NAT Gateway configured, there\'s no valid route!',
      },
      {
        id: 3,
        title: 'No Route Found!',
        location: 'private-subnet',
        explanation: 'Without a route to the NAT Gateway, the traffic has nowhere to go. The connection times out.',
        isError: true,
      },
      {
        id: 4,
        title: 'Connection Failed',
        location: 'private-ec2',
        explanation: '\u274c Connection timeout! Fix: Add a NAT Gateway in the public subnet and update the private route table to route 0.0.0.0/0 to the NAT Gateway.',
        isError: true,
      },
    ],
  },
];

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface TooltipProps {
  component: VpcComponent;
  isVisible: boolean;
  onClose: () => void;
}

function ComponentTooltip({ component, isVisible, onClose }: TooltipProps) {
  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute z-50 w-64 p-3 text-sm bg-popover border rounded-lg shadow-lg -top-2 left-full ml-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <component.icon className={cn('h-4 w-4', component.color)} />
          <span className="font-semibold">{component.name}</span>
        </div>
        <button onClick={onClose} className="p-0.5 hover:bg-muted rounded">
          <X className="h-3 w-3" />
        </button>
      </div>
      <p className="mt-2 text-muted-foreground">{component.description}</p>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AwsVpcSimulator() {
  // State
  const [selectedScenario, setSelectedScenario] = useState<ScenarioId>('internet-to-public');
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [tooltipComponent, setTooltipComponent] = useState<ComponentId | null>(null);

  const scenario = SCENARIOS.find((s) => s.id === selectedScenario)!;
  const steps = scenario.steps;
  const currentStep = currentStepIndex >= 0 ? steps[currentStepIndex] : null;
  const totalSteps = steps.length;

  // Handlers
  const startSimulation = useCallback(() => {
    setIsRunning(true);
    setIsComplete(false);
    setCurrentStepIndex(0);
  }, []);

  const handleStepForward = useCallback(() => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      setIsComplete(true);
      setIsRunning(false);
    }
  }, [currentStepIndex, totalSteps]);

  const handleStepBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
      setIsComplete(false);
      setIsRunning(true);
    }
  }, [currentStepIndex]);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setIsComplete(false);
    setCurrentStepIndex(-1);
  }, []);

  const handleScenarioChange = useCallback((id: ScenarioId) => {
    setSelectedScenario(id);
    setIsRunning(false);
    setIsComplete(false);
    setCurrentStepIndex(-1);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (!isRunning && !isComplete) {
            startSimulation();
          } else if (isComplete) {
            startSimulation();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (isRunning) handleStepForward();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (isRunning || isComplete) handleStepBack();
          break;
        case 'r':
        case 'R':
        case 'Escape':
          e.preventDefault();
          handleReset();
          break;
        case '1':
        case '2':
        case '3':
        case '4':
          e.preventDefault();
          const scenarioIndex = parseInt(e.key) - 1;
          if (scenarioIndex < SCENARIOS.length) {
            handleScenarioChange(SCENARIOS[scenarioIndex].id);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning, isComplete, startSimulation, handleStepForward, handleStepBack, handleReset, handleScenarioChange]);

  // Check if component is active in current step
  const isComponentActive = (componentId: ComponentId) => {
    return currentStep?.location === componentId;
  };

  // Check if component has been visited
  const isComponentVisited = (componentId: ComponentId) => {
    if (currentStepIndex < 0) return false;
    return steps.slice(0, currentStepIndex).some((s) => s.location === componentId);
  };

  // Render a VPC component box
  const renderComponent = (componentId: ComponentId, className?: string) => {
    const component = VPC_COMPONENTS[componentId];
    const Icon = component.icon;
    const isActive = isComponentActive(componentId);
    const isVisited = isComponentVisited(componentId);
    const isError = currentStep?.isError && isActive;

    return (
      <div className={cn('relative', className)}>
        <motion.div
          className={cn(
            'flex flex-col items-center justify-center rounded-lg border-2 p-2 sm:p-3 transition-all cursor-pointer',
            'min-w-[70px] sm:min-w-[90px]',
            isActive && !isError && 'border-blue-500 bg-blue-500/20 ring-2 ring-blue-500',
            isActive && isError && 'border-red-500 bg-red-500/20 ring-2 ring-red-500',
            isVisited && !isActive && 'border-green-500/50 bg-green-500/10',
            !isActive && !isVisited && 'border-muted-foreground/30 bg-muted/30'
          )}
          animate={isActive ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 1.5, repeat: isActive ? Infinity : 0 }}
          onClick={() => setTooltipComponent(tooltipComponent === componentId ? null : componentId)}
        >
          <Icon
            className={cn(
              'h-5 w-5 sm:h-6 sm:w-6',
              isActive && !isError && component.color,
              isActive && isError && 'text-red-500',
              isVisited && !isActive && 'text-green-500',
              !isActive && !isVisited && 'text-muted-foreground/50'
            )}
          />
          <span className="mt-1 text-[9px] sm:text-[10px] font-medium text-center leading-tight">
            {component.shortName}
          </span>
          {isVisited && !isActive && (
            <CheckCircle className="absolute -top-1 -right-1 h-3 w-3 text-green-500" />
          )}
          {isError && (
            <AlertTriangle className="absolute -top-1 -right-1 h-3 w-3 text-red-500" />
          )}
        </motion.div>
        <AnimatePresence>
          <ComponentTooltip
            component={component}
            isVisible={tooltipComponent === componentId}
            onClose={() => setTooltipComponent(null)}
          />
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <Card className="border-orange-500/20 bg-gradient-to-r from-orange-500/5 to-yellow-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Cloud className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500" />
            AWS VPC Networking Simulator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Learn how traffic flows through VPCs, subnets, and gateways. Click any component for details!
          </p>
        </CardContent>
      </Card>

      {/* Scenario Selection */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm sm:text-base">Select Scenario</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SCENARIOS.map((s, idx) => (
              <Button
                key={s.id}
                variant={selectedScenario === s.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleScenarioChange(s.id)}
                disabled={isRunning}
                className={cn(
                  'h-auto py-2 px-2 sm:px-3 text-[10px] sm:text-xs flex-col items-start text-left',
                  s.id === 'broken-nat' && selectedScenario !== s.id && 'border-red-500/30'
                )}
              >
                <span className="font-semibold">{idx + 1}. {s.title}</span>
                <span className="text-[9px] sm:text-[10px] opacity-70 line-clamp-1">{s.description}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {!isRunning && !isComplete && (
              <Button onClick={startSimulation} className="flex-1 sm:flex-none">
                <Play className="mr-2 h-4 w-4" />
                Start Simulation
              </Button>
            )}

            {isRunning && currentStepIndex < steps.length && (
              <>
                <Button onClick={handleStepForward} className="flex-1 sm:flex-none">
                  <ChevronRight className="mr-2 h-4 w-4" />
                  Next Step
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleStepBack}
                  disabled={currentStepIndex <= 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </>
            )}

            {isComplete && (
              <Button onClick={startSimulation} variant="outline" className="flex-1 sm:flex-none">
                <Play className="mr-2 h-4 w-4" />
                Run Again
              </Button>
            )}

            <Button variant="outline" size="icon" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>

            <div className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex">
              <Keyboard className="h-3 w-3" />
              <span>
                <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px] font-mono">Space</kbd> start,{' '}
                <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px] font-mono">→</kbd> next,{' '}
                <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px] font-mono">←</kbd> back,{' '}
                <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px] font-mono">1-4</kbd> scenario
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      {currentStepIndex >= 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">
                Step {Math.min(currentStepIndex + 1, totalSteps)} of {totalSteps}
              </span>
              {isComplete && (
                <span className={cn(
                  'flex items-center gap-1',
                  currentStep?.isError ? 'text-red-600' : 'text-green-600'
                )}>
                  {currentStep?.isError ? (
                    <><AlertTriangle className="h-3 w-3" /> Error</>
                  ) : (
                    <><CheckCircle className="h-3 w-3" /> Complete</>
                  )}
                </span>
              )}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full transition-all duration-300',
                  currentStep?.isError ? 'bg-red-500' : 'bg-orange-500'
                )}
                style={{ width: `${Math.min(((currentStepIndex + 1) / totalSteps) * 100, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* VPC Diagram */}
      <Card>
        <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-2">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Cloud className="h-4 w-4 text-orange-500" />
            VPC Architecture (10.0.0.0/16)
            <span className="text-xs font-normal text-muted-foreground ml-2">
              Click any component for details
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-6">
          <div className="relative">
            {/* Internet (outside VPC) */}
            <div className="flex justify-center mb-3">
              {renderComponent('internet')}
            </div>

            {/* Arrow down */}
            <div className="flex justify-center mb-3">
              <ArrowDown className={cn(
                'h-5 w-5',
                (isComponentActive('igw') || isComponentVisited('igw')) ? 'text-blue-500' : 'text-muted-foreground/30'
              )} />
            </div>

            {/* VPC Container */}
            <div className="border-2 border-orange-500/30 rounded-xl p-3 sm:p-4 bg-orange-500/5">
              <div className="text-[10px] sm:text-xs font-semibold text-orange-600 mb-3 flex items-center gap-1">
                <Cloud className="h-3 w-3" />
                VPC
              </div>

              {/* Internet Gateway */}
              <div className="flex justify-center mb-4">
                {renderComponent('igw')}
              </div>

              {/* Subnets Container */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Public Subnet */}
                <div className="border-2 border-green-500/30 rounded-lg p-2 sm:p-3 bg-green-500/5">
                  <div className="text-[9px] sm:text-[10px] font-semibold text-green-600 mb-2">
                    Public Subnet (10.0.1.0/24)
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    {renderComponent('public-route-table')}
                    <ArrowDown className={cn(
                      'h-4 w-4',
                      (isComponentActive('public-subnet') || isComponentVisited('public-subnet')) ? 'text-green-500' : 'text-muted-foreground/30'
                    )} />
                    <div className="flex items-center gap-2 sm:gap-3">
                      {renderComponent('public-ec2')}
                      {renderComponent('nat-gateway')}
                    </div>
                  </div>
                </div>

                {/* Private Subnet */}
                <div className="border-2 border-blue-500/30 rounded-lg p-2 sm:p-3 bg-blue-500/5">
                  <div className="text-[9px] sm:text-[10px] font-semibold text-blue-600 mb-2">
                    Private Subnet (10.0.2.0/24)
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    {renderComponent('private-route-table')}
                    <ArrowDown className={cn(
                      'h-4 w-4',
                      (isComponentActive('private-subnet') || isComponentVisited('private-subnet')) ? 'text-blue-500' : 'text-muted-foreground/30'
                    )} />
                    {renderComponent('private-ec2')}
                  </div>
                </div>
              </div>

              {/* Connection arrow between subnets (for public-to-private scenario) */}
              {selectedScenario === 'public-to-private' && (
                <div className="hidden sm:flex justify-center mt-2">
                  <ArrowRight className={cn(
                    'h-4 w-4',
                    currentStepIndex >= 2 ? 'text-green-500' : 'text-muted-foreground/30'
                  )} />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Step Explanation */}
      <AnimatePresence mode="wait">
        {currentStep && (
          <motion.div
            key={currentStep.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className={cn(
              'border-2',
              currentStep.isError ? 'border-red-500/50 bg-red-500/5' : 'border-blue-500/50 bg-blue-500/5'
            )}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  {currentStep.isError ? (
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  ) : (
                    <Info className="h-5 w-5 text-blue-500" />
                  )}
                  {currentStep.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {currentStep.explanation}
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Current:</span>
                  <span className={cn(
                    'px-2 py-0.5 rounded font-medium',
                    VPC_COMPONENTS[currentStep.location].bgColor,
                    VPC_COMPONENTS[currentStep.location].color
                  )}>
                    {VPC_COMPONENTS[currentStep.location].name}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Key Concepts (shown when not running) */}
      {!isRunning && !isComplete && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base">💡 Quick Reference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 text-xs sm:text-sm sm:grid-cols-2">
              <div className="flex items-start gap-2">
                <div className="p-1 rounded bg-purple-500/10">
                  <Router className="h-3 w-3 text-purple-500" />
                </div>
                <div>
                  <strong>Internet Gateway</strong>
                  <p className="text-muted-foreground">Entry/exit point for internet traffic</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="p-1 rounded bg-orange-500/10">
                  <Shield className="h-3 w-3 text-orange-500" />
                </div>
                <div>
                  <strong>NAT Gateway</strong>
                  <p className="text-muted-foreground">Lets private instances reach internet</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="p-1 rounded bg-green-500/10">
                  <Cloud className="h-3 w-3 text-green-500" />
                </div>
                <div>
                  <strong>Public Subnet</strong>
                  <p className="text-muted-foreground">Has route to IGW, instances get public IPs</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="p-1 rounded bg-blue-500/10">
                  <Cloud className="h-3 w-3 text-blue-500" />
                </div>
                <div>
                  <strong>Private Subnet</strong>
                  <p className="text-muted-foreground">No direct internet, uses NAT for outbound</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Route Tables Reference */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Network className="h-4 w-4 text-indigo-500" />
            Route Tables
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="text-xs sm:text-sm">
              <div className="font-semibold text-green-600 mb-2">Public Route Table</div>
              <div className="space-y-1 font-mono text-[10px] sm:text-xs bg-muted/50 p-2 rounded">
                <div className="flex justify-between">
                  <span>10.0.0.0/16</span>
                  <span className="text-muted-foreground">→ local</span>
                </div>
                <div className="flex justify-between">
                  <span>0.0.0.0/0</span>
                  <span className="text-purple-600">→ igw-xxxxx</span>
                </div>
              </div>
            </div>
            <div className="text-xs sm:text-sm">
              <div className="font-semibold text-blue-600 mb-2">Private Route Table</div>
              <div className="space-y-1 font-mono text-[10px] sm:text-xs bg-muted/50 p-2 rounded">
                <div className="flex justify-between">
                  <span>10.0.0.0/16</span>
                  <span className="text-muted-foreground">→ local</span>
                </div>
                <div className="flex justify-between">
                  <span>0.0.0.0/0</span>
                  <span className="text-orange-600">→ nat-xxxxx</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
