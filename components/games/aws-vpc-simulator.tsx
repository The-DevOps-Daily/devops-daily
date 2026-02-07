'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Cloud,
  Server,
  Globe,
  RotateCcw,
  CheckCircle,
  Shield,
  Network,
  Router,
  Keyboard,
  Info,
  X,
  AlertTriangle,
  Zap,
  PlayCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  category: 'gateway' | 'subnet' | 'compute' | 'routing';
  dependencies?: ComponentType[];
}

interface ValidationResult {
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  component?: ComponentType;
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
    category: 'gateway',
  },
  {
    type: 'nat-gateway',
    name: 'NAT Gateway',
    description: 'Allows private resources to access internet without being publicly accessible. Must be in a public subnet.',
    icon: Shield,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    category: 'gateway',
    dependencies: ['igw', 'public-subnet'],
  },
  {
    type: 'public-subnet',
    name: 'Public Subnet',
    description: 'A subnet with a route to the Internet Gateway. Resources here can have public IPs.',
    icon: Cloud,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    category: 'subnet',
    dependencies: ['igw'],
  },
  {
    type: 'private-subnet',
    name: 'Private Subnet',
    description: 'A subnet without direct internet access. Resources are protected from public exposure.',
    icon: Cloud,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    category: 'subnet',
  },
  {
    type: 'public-ec2',
    name: 'Public EC2 Instance',
    description: 'A compute instance in a public subnet. Can be accessed directly from the internet.',
    icon: Server,
    color: 'text-green-600',
    bgColor: 'bg-green-600/10',
    category: 'compute',
    dependencies: ['public-subnet'],
  },
  {
    type: 'private-ec2',
    name: 'Private EC2 Instance',
    description: 'A compute instance in a private subnet. Cannot be accessed directly from the internet.',
    icon: Server,
    color: 'text-red-600',
    bgColor: 'bg-red-600/10',
    category: 'compute',
    dependencies: ['private-subnet'],
  },
  {
    type: 'public-route-table',
    name: 'Public Route Table',
    description: 'Routes traffic to the Internet Gateway for public subnets (0.0.0.0/0 -> IGW).',
    icon: Network,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
    category: 'routing',
    dependencies: ['igw', 'public-subnet'],
  },
  {
    type: 'private-route-table',
    name: 'Private Route Table',
    description: 'Routes traffic to NAT Gateway for private subnets (0.0.0.0/0 -> NAT).',
    icon: Network,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    category: 'routing',
    dependencies: ['private-subnet'],
  },
];

const COMPONENT_MAP = Object.fromEntries(
  AVAILABLE_COMPONENTS.map((c) => [c.type, c])
) as Record<ComponentType, VpcComponentDef>;

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
      message: 'Consider adding a Public Route Table to properly route traffic in your public subnet.',
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
      activeComponents.has('igw') && activeComponents.has('public-subnet') && activeComponents.has('public-ec2');
    const hasPrivateArch = activeComponents.has('private-subnet') && activeComponents.has('private-ec2');
    const hasNat = activeComponents.has('nat-gateway');

    if (hasPublicArch && hasPrivateArch && hasNat) {
      results.push({
        type: 'success',
        message: 'Complete VPC architecture! Public web tier + private database tier with NAT for outbound access.',
      });
    } else if (hasPublicArch) {
      results.push({
        type: 'success',
        message: 'Valid public-facing architecture. Your EC2 can receive traffic from the internet.',
      });
    } else if (hasPrivateArch && hasNat) {
      results.push({
        type: 'success',
        message: 'Valid private architecture with NAT. Resources can access internet without being exposed.',
      });
    }
  }

  return results;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function AwsVpcSimulator() {
  const [activeComponents, setActiveComponents] = useState<Set<ComponentType>>(new Set());
  const [selectedInfo, setSelectedInfo] = useState<ComponentType | null>(null);
  const [showTestPanel, setShowTestPanel] = useState(false);

  const validation = useMemo(() => validateConfiguration(activeComponents), [activeComponents]);

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
  }, []);

  const loadPreset = useCallback((preset: 'public' | 'private' | 'full') => {
    const presets: Record<string, ComponentType[]> = {
      public: ['igw', 'public-subnet', 'public-route-table', 'public-ec2'],
      private: ['igw', 'public-subnet', 'nat-gateway', 'private-subnet', 'private-route-table', 'private-ec2'],
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // Don't intercept browser refresh shortcut (Ctrl+R / Cmd+R)
      if ((e.key === 'r' || e.key === 'R') && (e.ctrlKey || e.metaKey)) return;

      switch (e.key) {
        case 'r':
        case 'R':
          e.preventDefault();
          reset();
          break;
        case '1':
          e.preventDefault();
          loadPreset('public');
          break;
        case '2':
          e.preventDefault();
          loadPreset('private');
          break;
        case '3':
          e.preventDefault();
          loadPreset('full');
          break;
        case 't':
        case 'T':
          e.preventDefault();
          setShowTestPanel((p) => !p);
          break;
        case 'Escape':
          e.preventDefault();
          setSelectedInfo(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reset, loadPreset]);

  // Group components by category
  const groupedComponents = useMemo(() => {
    const groups: Record<string, VpcComponentDef[]> = {
      gateway: [],
      subnet: [],
      compute: [],
      routing: [],
    };
    AVAILABLE_COMPONENTS.forEach((c) => groups[c.category].push(c));
    return groups;
  }, []);

  const renderComponentButton = (comp: VpcComponentDef) => {
    const isActive = activeComponents.has(comp.type);
    const Icon = comp.icon;
    const hasError = validation.some((v) => v.type === 'error' && v.component === comp.type);
    const hasWarning = validation.some((v) => v.type === 'warning' && v.component === comp.type);

    return (
      <motion.button
        key={comp.type}
        onClick={() => toggleComponent(comp.type)}
        className={cn(
          'relative flex items-center gap-2 rounded-lg border-2 p-2 text-left transition-all sm:p-3',
          isActive
            ? hasError
              ? 'border-red-500 bg-red-500/20'
              : hasWarning
                ? 'border-yellow-500 bg-yellow-500/20'
                : 'border-green-500 bg-green-500/20'
            : 'border bg-muted/50 hover:border-primary/50 hover:bg-muted'
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className={cn('rounded-md p-1.5', isActive ? comp.bgColor : 'bg-muted/50')}>
          <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5', isActive ? comp.color : 'text-muted-foreground')} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={cn('text-xs font-medium sm:text-sm', isActive ? 'text-foreground' : 'text-muted-foreground')}>
              {comp.name}
            </span>
            {isActive && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                {hasError ? (
                  <AlertTriangle className="h-3 w-3 text-red-400" />
                ) : hasWarning ? (
                  <AlertTriangle className="h-3 w-3 text-yellow-400" />
                ) : (
                  <CheckCircle className="h-3 w-3 text-green-400" />
                )}
              </motion.span>
            )}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedInfo(selectedInfo === comp.type ? null : comp.type);
          }}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Info className="h-3 w-3 sm:h-4 sm:w-4" />
        </button>
      </motion.button>
    );
  };

  return (
    <Card className="mx-auto w-full max-w-4xl border ">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg text-foreground sm:text-xl">
            <Cloud className="h-5 w-5 text-orange-400 sm:h-6 sm:w-6" />
            AWS VPC Builder
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTestPanel(!showTestPanel)}
              className={cn(
                'border text-muted-foreground hover:bg-muted',
                showTestPanel && 'bg-muted'
              )}
            >
              <Zap className="mr-1 h-3 w-3" />
              Test
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              className="border text-muted-foreground hover:bg-muted"
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Reset
            </Button>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Build your VPC by adding components. The simulator will tell you if something is misconfigured.
        </p>
      </CardHeader>

      <CardContent className="space-y-4 sm:space-y-5">
        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Quick start:</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadPreset('public')}
            className="h-6 px-2 text-xs text-muted-foreground hover:bg-muted"
          >
            <PlayCircle className="mr-1 h-3 w-3" />
            Public Web Server
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadPreset('private')}
            className="h-6 px-2 text-xs text-muted-foreground hover:bg-muted"
          >
            <PlayCircle className="mr-1 h-3 w-3" />
            Private with NAT
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadPreset('full')}
            className="h-6 px-2 text-xs text-muted-foreground hover:bg-muted"
          >
            <PlayCircle className="mr-1 h-3 w-3" />
            Full Architecture
          </Button>
        </div>

        {/* Component Palette */}
        <div className="space-y-3">
          {Object.entries(groupedComponents).map(([category, components]) => (
            <div key={category}>
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {category === 'gateway' && 'Gateways'}
                {category === 'subnet' && 'Subnets'}
                {category === 'compute' && 'Compute'}
                {category === 'routing' && 'Routing'}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {components.map(renderComponentButton)}
              </div>
            </div>
          ))}
        </div>

        {/* Component Info Panel */}
        <AnimatePresence>
          {selectedInfo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-lg border border bg-muted p-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {React.createElement(COMPONENT_MAP[selectedInfo].icon, {
                      className: cn('h-4 w-4', COMPONENT_MAP[selectedInfo].color),
                    })}
                    <span className="font-medium text-foreground">{COMPONENT_MAP[selectedInfo].name}</span>
                  </div>
                  <button onClick={() => setSelectedInfo(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{COMPONENT_MAP[selectedInfo].description}</p>
                {COMPONENT_MAP[selectedInfo].dependencies && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium">Requires:</span>{' '}
                    {COMPONENT_MAP[selectedInfo].dependencies!.map((d) => COMPONENT_MAP[d].name).join(', ')}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Validation Feedback */}
        <div className="rounded-lg border border bg-muted/50 p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Configuration Status</div>
          {activeComponents.size === 0 ? (
            <p className="text-sm text-muted-foreground">Add components to build your VPC architecture.</p>
          ) : validation.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add more components to create a functional architecture.</p>
          ) : (
            <div className="space-y-2">
              {validation.map((v, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    'flex items-start gap-2 rounded-md p-2 text-sm',
                    v.type === 'error' && 'bg-red-500/10 text-red-700 dark:text-red-300',
                    v.type === 'warning' && 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
                    v.type === 'info' && 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
                    v.type === 'success' && 'bg-green-500/10 text-green-700 dark:text-green-300'
                  )}
                >
                  {v.type === 'error' && <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
                  {v.type === 'warning' && <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
                  {v.type === 'info' && <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />}
                  {v.type === 'success' && <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
                  <span>{v.message}</span>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Visual Architecture Diagram */}
        <AnimatePresence>
          {activeComponents.size > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-lg border border bg-muted/30 p-3 sm:p-4">
                <div className="mb-3 text-xs font-medium text-muted-foreground">Your VPC Architecture</div>

                {/* Internet */}
                <div className="mb-3 flex justify-center">
                  <div className="flex items-center gap-2 rounded-full bg-blue-500/20 px-3 py-1">
                    <Globe className="h-4 w-4 text-blue-400" />
                    <span className="text-xs text-blue-700 dark:text-blue-300">Internet</span>
                  </div>
                </div>

                {/* IGW */}
                {activeComponents.has('igw') && (
                  <>
                    <div className="mb-1 flex justify-center">
                      <div className="h-4 w-0.5 bg-border" />
                    </div>
                    <div className="mb-3 flex justify-center">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-2 rounded-lg border border-purple-500/50 bg-purple-500/20 px-3 py-2"
                      >
                        <Router className="h-4 w-4 text-purple-400" />
                        <span className="text-xs text-purple-700 dark:text-purple-300">Internet Gateway</span>
                      </motion.div>
                    </div>
                  </>
                )}

                {/* VPC Container */}
                <div className="rounded-lg border-2 border-dashed border p-3">
                  <div className="mb-3 text-center text-[10px] text-muted-foreground">VPC (10.0.0.0/16)</div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {/* Public Subnet */}
                    {activeComponents.has('public-subnet') && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-lg border border-green-700 bg-green-900/20 p-2"
                      >
                        <div className="mb-2 text-center text-[10px] font-medium text-green-700 dark:text-green-400">Public Subnet</div>
                        <div className="flex flex-wrap justify-center gap-2">
                          {activeComponents.has('public-route-table') && (
                            <div className="flex items-center gap-1 rounded bg-indigo-500/20 px-2 py-1">
                              <Network className="h-3 w-3 text-indigo-400" />
                              <span className="text-[10px] text-indigo-700 dark:text-indigo-300">Route Table</span>
                            </div>
                          )}
                          {activeComponents.has('public-ec2') && (
                            <div className="flex items-center gap-1 rounded bg-green-600/20 px-2 py-1">
                              <Server className="h-3 w-3 text-green-400" />
                              <span className="text-[10px] text-green-700 dark:text-green-300">EC2</span>
                            </div>
                          )}
                          {activeComponents.has('nat-gateway') && (
                            <div className="flex items-center gap-1 rounded bg-orange-500/20 px-2 py-1">
                              <Shield className="h-3 w-3 text-orange-400" />
                              <span className="text-[10px] text-orange-700 dark:text-orange-300">NAT GW</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* Private Subnet */}
                    {activeComponents.has('private-subnet') && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-lg border border-red-700 bg-red-900/20 p-2"
                      >
                        <div className="mb-2 text-center text-[10px] font-medium text-red-700 dark:text-red-400">Private Subnet</div>
                        <div className="flex flex-wrap justify-center gap-2">
                          {activeComponents.has('private-route-table') && (
                            <div className="flex items-center gap-1 rounded bg-amber-500/20 px-2 py-1">
                              <Network className="h-3 w-3 text-amber-400" />
                              <span className="text-[10px] text-amber-700 dark:text-amber-300">Route Table</span>
                            </div>
                          )}
                          {activeComponents.has('private-ec2') && (
                            <div className="flex items-center gap-1 rounded bg-red-600/20 px-2 py-1">
                              <Server className="h-3 w-3 text-red-400" />
                              <span className="text-[10px] text-red-700 dark:text-red-300">EC2</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {!activeComponents.has('public-subnet') && !activeComponents.has('private-subnet') && (
                      <div className="col-span-full py-4 text-center text-xs text-muted-foreground">
                        Add subnets to see the architecture
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Test Panel */}
        <AnimatePresence>
          {showTestPanel && activeComponents.size > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-lg border border bg-muted/50 p-3">
                <div className="mb-2 text-xs font-medium text-muted-foreground">Connectivity Tests</div>
                <div className="space-y-2 text-sm">
                  {/* Test: Internet to Public EC2 */}
                  <div className="flex items-center justify-between rounded bg-muted p-2">
                    <span className="text-muted-foreground">Internet to Public EC2</span>
                    {activeComponents.has('igw') &&
                    activeComponents.has('public-subnet') &&
                    activeComponents.has('public-ec2') ? (
                      <span className="flex items-center gap-1 text-green-400">
                        <CheckCircle className="h-4 w-4" /> Works
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-400">
                        <X className="h-4 w-4" /> Blocked
                      </span>
                    )}
                  </div>
                  {/* Test: Private EC2 to Internet */}
                  <div className="flex items-center justify-between rounded bg-muted p-2">
                    <span className="text-muted-foreground">Private EC2 to Internet</span>
                    {activeComponents.has('igw') &&
                    activeComponents.has('nat-gateway') &&
                    activeComponents.has('private-subnet') &&
                    activeComponents.has('private-ec2') ? (
                      <span className="flex items-center gap-1 text-green-400">
                        <CheckCircle className="h-4 w-4" /> Works
                      </span>
                    ) : activeComponents.has('private-ec2') ? (
                      <span className="flex items-center gap-1 text-red-400">
                        <X className="h-4 w-4" /> Blocked
                      </span>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </div>
                  {/* Test: Internet to Private EC2 */}
                  <div className="flex items-center justify-between rounded bg-muted p-2">
                    <span className="text-muted-foreground">Internet to Private EC2</span>
                    {activeComponents.has('private-ec2') ? (
                      <span className="flex items-center gap-1 text-green-400">
                        <Shield className="h-4 w-4" /> Protected
                      </span>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Keyboard Hints */}
        <div className="hidden items-center justify-center gap-4 text-xs text-muted-foreground sm:flex">
          <Keyboard className="h-3 w-3" />
          <span>
            <kbd className="rounded bg-muted px-1">1-3</kbd> presets
          </span>
          <span>
            <kbd className="rounded bg-muted px-1">T</kbd> test
          </span>
          <span>
            <kbd className="rounded bg-muted px-1">R</kbd> reset
          </span>
        </div>

        {/* Educational Summary */}
        <div className="rounded-lg border border bg-muted/30 p-3">
          <h3 className="mb-2 text-sm font-semibold text-foreground">Key Concepts</h3>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>
              <strong className="text-green-400">Public Subnet</strong>: Has route to Internet Gateway - resources can
              have public IPs
            </li>
            <li>
              <strong className="text-red-400">Private Subnet</strong>: No direct internet route - resources are
              protected
            </li>
            <li>
              <strong className="text-orange-400">NAT Gateway</strong>: Lets private resources reach internet without
              being exposed
            </li>
            <li>
              <strong className="text-purple-400">Internet Gateway</strong>: The door between your VPC and the internet
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
