'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Globe,
  Server,
  Database,
  Clock,
  ArrowRight,
  Play,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Zap,
  HardDrive,
  Wifi,
  Keyboard,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

type RecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS';

interface DnsRecord {
  type: RecordType;
  value: string;
  ttl: number;
}

interface CacheEntry {
  value: string;
  ttl: number;
  expiresAt: number;
}

interface DnsStep {
  id: number;
  title: string;
  shortTitle: string;
  location: 'browser' | 'os' | 'resolver' | 'root' | 'tld' | 'authoritative';
  explanation: string;
  isCacheCheck: boolean;
  cacheHit?: boolean;
  latency: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DNS_DATABASE: Record<string, Record<RecordType, DnsRecord>> = {
  'example.com': {
    A: { type: 'A', value: '93.184.216.34', ttl: 3600 },
    AAAA: { type: 'AAAA', value: '2606:2800:220:1:248:1893:25c8:1946', ttl: 3600 },
    CNAME: { type: 'CNAME', value: 'www.example.com', ttl: 3600 },
    MX: { type: 'MX', value: 'mail.example.com (priority: 10)', ttl: 3600 },
    TXT: { type: 'TXT', value: 'v=spf1 include:_spf.example.com ~all', ttl: 3600 },
    NS: { type: 'NS', value: 'ns1.example.com, ns2.example.com', ttl: 86400 },
  },
  'google.com': {
    A: { type: 'A', value: '142.250.80.46', ttl: 300 },
    AAAA: { type: 'AAAA', value: '2607:f8b0:4004:800::200e', ttl: 300 },
    CNAME: { type: 'CNAME', value: 'www.google.com', ttl: 300 },
    MX: { type: 'MX', value: 'smtp.google.com (priority: 5)', ttl: 300 },
    TXT: { type: 'TXT', value: 'v=spf1 include:_spf.google.com ~all', ttl: 300 },
    NS: { type: 'NS', value: 'ns1.google.com, ns2.google.com', ttl: 21600 },
  },
  'github.com': {
    A: { type: 'A', value: '140.82.121.4', ttl: 60 },
    AAAA: { type: 'AAAA', value: '2606:50c0:8000::64', ttl: 60 },
    CNAME: { type: 'CNAME', value: 'github.github.io', ttl: 3600 },
    MX: { type: 'MX', value: 'alt1.aspmx.l.google.com (priority: 5)', ttl: 60 },
    TXT: { type: 'TXT', value: 'v=spf1 include:_spf.google.com ~all', ttl: 60 },
    NS: { type: 'NS', value: 'dns1.p08.nsone.net, dns2.p08.nsone.net', ttl: 900 },
  },
  'cloudflare.com': {
    A: { type: 'A', value: '104.16.132.229', ttl: 300 },
    AAAA: { type: 'AAAA', value: '2606:4700::6810:84e5', ttl: 300 },
    CNAME: { type: 'CNAME', value: 'www.cloudflare.com', ttl: 300 },
    MX: { type: 'MX', value: 'mailstream-east.mxrecord.io (priority: 10)', ttl: 300 },
    TXT: { type: 'TXT', value: 'v=spf1 include:_spf.cloudflare.com ~all', ttl: 300 },
    NS: { type: 'NS', value: 'ns3.cloudflare.com, ns4.cloudflare.com', ttl: 86400 },
  },
};

const RECORD_TYPES: { type: RecordType; label: string; description: string }[] = [
  { type: 'A', label: 'A', description: 'IPv4 Address' },
  { type: 'AAAA', label: 'AAAA', description: 'IPv6 Address' },
  { type: 'CNAME', label: 'CNAME', description: 'Alias' },
  { type: 'MX', label: 'MX', description: 'Mail Server' },
  { type: 'TXT', label: 'TXT', description: 'Text Record' },
  { type: 'NS', label: 'NS', description: 'Nameserver' },
];

const SAMPLE_DOMAINS = Object.keys(DNS_DATABASE);

const LOCATIONS_INFO: Record<
  DnsStep['location'],
  { name: string; icon: React.ElementType; color: string; description: string }
> = {
  browser: {
    name: 'Browser',
    icon: Globe,
    color: 'text-blue-500',
    description: 'Your web browser checks its internal DNS cache first',
  },
  os: {
    name: 'OS Cache',
    icon: HardDrive,
    color: 'text-purple-500',
    description: 'Operating system maintains a local DNS cache',
  },
  resolver: {
    name: 'DNS Resolver',
    icon: Wifi,
    color: 'text-indigo-500',
    description: 'Your ISP or DNS provider (like 8.8.8.8)',
  },
  root: {
    name: 'Root Server',
    icon: Server,
    color: 'text-slate-500',
    description: 'One of 13 root server clusters worldwide',
  },
  tld: {
    name: 'TLD Server',
    icon: Server,
    color: 'text-cyan-500',
    description: 'Manages .com, .org, .net domains',
  },
  authoritative: {
    name: 'Auth Server',
    icon: Database,
    color: 'text-green-500',
    description: 'Has the actual DNS record for this domain',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateSteps(
  domain: string,
  recordType: RecordType,
  browserCache: Map<string, CacheEntry>,
  osCache: Map<string, CacheEntry>,
  resolverCache: Map<string, CacheEntry>
): DnsStep[] {
  const cacheKey = `${domain}:${recordType}`;
  const now = Date.now();
  const steps: DnsStep[] = [];
  let stepId = 1;

  // Step 1: Browser cache check
  const browserEntry = browserCache.get(cacheKey);
  const browserHit = browserEntry && browserEntry.expiresAt > now;
  steps.push({
    id: stepId++,
    title: 'Check Browser Cache',
    shortTitle: 'Browser',
    location: 'browser',
    explanation: browserHit
      ? `Found ${domain} in browser cache! This is the fastest lookup because the data is already in your browser's memory.`
      : `${domain} not found in browser cache. The browser stores recent DNS lookups to avoid repeated queries.`,
    isCacheCheck: true,
    cacheHit: browserHit,
    latency: 1,
  });
  if (browserHit) return steps;

  // Step 2: OS cache check
  const osEntry = osCache.get(cacheKey);
  const osHit = osEntry && osEntry.expiresAt > now;
  steps.push({
    id: stepId++,
    title: 'Check OS Cache',
    shortTitle: 'OS',
    location: 'os',
    explanation: osHit
      ? `Found in OS cache! Your operating system caches DNS to speed up all applications.`
      : `Not in OS cache either. Now we need to ask an external DNS resolver.`,
    isCacheCheck: true,
    cacheHit: osHit,
    latency: 2,
  });
  if (osHit) return steps;

  // Step 3: Resolver cache check
  const resolverEntry = resolverCache.get(cacheKey);
  const resolverHit = resolverEntry && resolverEntry.expiresAt > now;
  steps.push({
    id: stepId++,
    title: 'Query DNS Resolver',
    shortTitle: 'Resolver',
    location: 'resolver',
    explanation: resolverHit
      ? `The DNS resolver (like Google's 8.8.8.8) had it cached. This saved us a full lookup!`
      : `Resolver doesn't have it cached. Now it will traverse the DNS hierarchy for us.`,
    isCacheCheck: true,
    cacheHit: resolverHit,
    latency: 15,
  });
  if (resolverHit) return steps;

  // Step 4: Root server
  const tld = domain.split('.').pop() || 'com';
  steps.push({
    id: stepId++,
    title: 'Ask Root DNS Server',
    shortTitle: 'Root',
    location: 'root',
    explanation: `The resolver asks one of 13 root server clusters: "Who handles .${tld} domains?" Root servers are the top of the DNS hierarchy.`,
    isCacheCheck: false,
    latency: 30,
  });

  // Step 5: TLD server
  steps.push({
    id: stepId++,
    title: `Query .${tld} TLD Server`,
    shortTitle: 'TLD',
    location: 'tld',
    explanation: `The TLD server for .${tld} responds: "${domain} is managed by these nameservers." TLD servers know which servers are authoritative for each domain.`,
    isCacheCheck: false,
    latency: 25,
  });

  // Step 6: Authoritative server
  const record = DNS_DATABASE[domain]?.[recordType];
  steps.push({
    id: stepId++,
    title: 'Query Authoritative Server',
    shortTitle: 'Auth',
    location: 'authoritative',
    explanation: record
      ? `Found it! The authoritative server has the actual ${recordType} record: ${record.value}`
      : `The authoritative server doesn't have a ${recordType} record for ${domain}.`,
    isCacheCheck: false,
    latency: 20,
  });

  return steps;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function DnsSimulator() {
  const [domain, setDomain] = useState('example.com');
  const [recordType, setRecordType] = useState<RecordType>('A');
  const [browserCache, setBrowserCache] = useState<Map<string, CacheEntry>>(new Map());
  const [osCache, setOsCache] = useState<Map<string, CacheEntry>>(new Map());
  const [resolverCache, setResolverCache] = useState<Map<string, CacheEntry>>(new Map());
  const [steps, setSteps] = useState<DnsStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [stats, setStats] = useState({ queries: 0, cacheHits: 0, totalTime: 0 });

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Don't intercept browser shortcuts (CMD+R, CTRL+R, etc.)
      if (e.metaKey || e.ctrlKey) return;

      // Space to start lookup
      if (e.key === ' ' && !isRunning && currentStepIndex === -1) {
        e.preventDefault();
        runLookup();
        return;
      }

      // Arrow keys for step navigation
      if (e.key === 'ArrowRight' && isRunning && currentStepIndex < steps.length) {
        e.preventDefault();
        handleStepForward();
      }
      if (e.key === 'ArrowLeft' && isRunning && currentStepIndex > 0) {
        e.preventDefault();
        handleStepBack();
      }

      // R to reset
      if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleReset();
      }

      // Escape to reset
      if (e.key === 'Escape') {
        e.preventDefault();
        handleReset();
      }
    },
    [isRunning, currentStepIndex, steps.length]
  );

  // Add keyboard event listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const runLookup = useCallback(() => {
    const newSteps = generateSteps(domain, recordType, browserCache, osCache, resolverCache);
    setSteps(newSteps);
    setCurrentStepIndex(0);
    setIsRunning(true);
    setIsComplete(false);
  }, [domain, recordType, browserCache, osCache, resolverCache]);

  // Complete lookup when reaching the end
  const completeLookup = useCallback(() => {
    setIsRunning(false);
    setIsComplete(true);

    const wasCacheHit = steps.some((s) => s.cacheHit);
    const totalLatency = steps.reduce((sum, s) => sum + s.latency, 0);

    setStats((prev) => ({
      queries: prev.queries + 1,
      cacheHits: wasCacheHit ? prev.cacheHits + 1 : prev.cacheHits,
      totalTime: prev.totalTime + totalLatency,
    }));

    // Cache the result
    if (!wasCacheHit) {
      const cacheKey = `${domain}:${recordType}`;
      const record = DNS_DATABASE[domain]?.[recordType];
      if (record) {
        const entry: CacheEntry = {
          value: record.value,
          ttl: record.ttl,
          expiresAt: Date.now() + record.ttl * 1000,
        };
        setBrowserCache((prev) => new Map(prev).set(cacheKey, entry));
        setOsCache((prev) => new Map(prev).set(cacheKey, entry));
        setResolverCache((prev) => new Map(prev).set(cacheKey, entry));
      }
    }
  }, [steps, domain, recordType]);

  const handleReset = () => {
    setSteps([]);
    setCurrentStepIndex(-1);
    setIsRunning(false);
    setIsComplete(false);
    setBrowserCache(new Map());
    setOsCache(new Map());
    setResolverCache(new Map());
    setStats({ queries: 0, cacheHits: 0, totalTime: 0 });
  };

  const handleStepForward = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else if (currentStepIndex === steps.length - 1) {
      // On last step, complete the lookup
      setCurrentStepIndex((prev) => prev + 1);
      completeLookup();
    }
  };

  const handleStepBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const record = DNS_DATABASE[domain]?.[recordType];
  const currentStep = steps[currentStepIndex];
  const totalSteps = steps.length;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Globe className="h-5 w-5 text-blue-500" />
            DNS Resolution Simulator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Watch step-by-step how your browser resolves domain names to IP addresses
          </p>
        </CardContent>
      </Card>

      {/* Configuration */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base">Domain</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_DOMAINS.map((d) => (
                <Button
                  key={d}
                  variant={domain === d ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDomain(d)}
                  disabled={isRunning}
                  className="text-xs sm:text-sm"
                >
                  {d}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base">Record Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {RECORD_TYPES.map((rt) => (
                <Button
                  key={rt.type}
                  variant={recordType === rt.type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRecordType(rt.type)}
                  disabled={isRunning}
                  className="text-xs sm:text-sm"
                >
                  <span>{rt.label}</span>
                  <span className="ml-1 hidden text-[10px] opacity-70 sm:inline">
                    ({rt.description})
                  </span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {!isRunning && !isComplete && (
              <Button onClick={runLookup} className="flex-1 sm:flex-none">
                <Play className="mr-2 h-4 w-4" />
                Start Lookup
              </Button>
            )}

            {isRunning && currentStepIndex < steps.length && (
              <>
                <Button
                  onClick={handleStepForward}
                  className="flex-1 sm:flex-none"
                >
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
              <Button onClick={runLookup} variant="outline" className="flex-1 sm:flex-none">
                <Play className="mr-2 h-4 w-4" />
                Run Again
              </Button>
            )}

            <Button variant="outline" size="icon" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>

            <div className="hidden text-sm text-muted-foreground sm:block">
              Query:{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                {recordType} {domain}
              </code>
            </div>

            <div className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex">
              <Keyboard className="h-3 w-3" />
              <span>
                <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px] font-mono">Space</kbd> start,{' '}
                <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px] font-mono">→</kbd> next,{' '}
                <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px] font-mono">←</kbd> back,{' '}
                <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px] font-mono">R</kbd> reset
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress indicator */}
      {steps.length > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">
                Step {Math.min(currentStepIndex + 1, totalSteps)} of {totalSteps}
              </span>
              {isComplete && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-3 w-3" /> Complete
                </span>
              )}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${Math.min(((currentStepIndex + 1) / totalSteps) * 100, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* DNS Hierarchy Visualization */}
      <Card>
        <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-2">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Server className="h-4 w-4 text-cyan-500" />
            DNS Resolution Path
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
          <div className="-mx-1 flex items-center justify-between gap-1 overflow-x-auto py-3 sm:mx-0 sm:justify-around sm:gap-4 sm:py-4">
            {Object.entries(LOCATIONS_INFO).map(([key, info], idx) => {
              const Icon = info.icon;
              const stepForNode = steps.find((s) => s.location === key);
              const stepIdx = steps.findIndex((s) => s.location === key);
              const isActive = stepIdx === currentStepIndex && isRunning;
              const isPast = stepIdx >= 0 && stepIdx < currentStepIndex;
              const isHit = stepForNode?.cacheHit;

              return (
                <React.Fragment key={key}>
                  <motion.div
                    className={cn(
                      'flex min-w-[44px] flex-col items-center rounded-lg p-1.5 transition-all sm:min-w-[80px] sm:p-3',
                      isActive && 'bg-blue-500/20 ring-2 ring-blue-500',
                      isPast && isHit && 'bg-green-500/10',
                      isPast && !isHit && 'bg-muted'
                    )}
                    animate={isActive ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 1.5, repeat: isActive ? Infinity : 0 }}
                  >
                    <Icon
                      className={cn(
                        'h-5 w-5 sm:h-7 sm:w-7',
                        isActive && info.color,
                        isPast && isHit && 'text-green-500',
                        isPast && !isHit && 'text-muted-foreground',
                        !isActive && !isPast && 'text-muted-foreground/50'
                      )}
                    />
                    <span className="mt-1 text-center text-[8px] font-medium leading-tight sm:mt-1.5 sm:text-xs">
                      {info.name}
                    </span>
                    {isPast && isHit && <CheckCircle className="mt-0.5 h-3 w-3 text-green-500 sm:mt-1 sm:h-3.5 sm:w-3.5" />}
                  </motion.div>
                  {idx < 5 && (
                    <ArrowRight className="h-3 w-3 flex-shrink-0 text-muted-foreground/40 sm:h-5 sm:w-5" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Current Step Explanation - The main focus */}
      <AnimatePresence mode="wait">
        {currentStep && currentStepIndex < steps.length && (
          <motion.div
            key={currentStep.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
          >
            <Card
              className={cn(
                'border-2',
                currentStep.cacheHit
                  ? 'border-green-500/50 bg-green-500/5'
                  : 'border-blue-500/50 bg-blue-500/5'
              )}
            >
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  {currentStep.cacheHit ? (
                    <Zap className="mt-0.5 h-6 w-6 flex-shrink-0 text-green-500" />
                  ) : (
                    <ArrowRight className="mt-0.5 h-6 w-6 flex-shrink-0 text-blue-500" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold sm:text-lg">{currentStep.title}</span>
                      <span className="text-xs text-muted-foreground">~{currentStep.latency}ms</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {currentStep.explanation}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Completion Card */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-2 border-green-500/50 bg-green-500/5">
              <CardContent className="pt-4">
                <div className="text-center">
                  <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                  <h3 className="mt-2 text-xl font-bold">DNS Lookup Complete!</h3>
                  <p className="mt-1 text-muted-foreground">
                    {record ? (
                      <>
                        <span className="font-medium text-foreground">{domain}</span> resolves to{' '}
                        <code className="rounded bg-slate-100 px-2 py-1 text-sm dark:bg-slate-800">
                          {record.value}
                        </code>
                      </>
                    ) : (
                      'No record found'
                    )}
                  </p>
                  <div className="mt-4 flex justify-center gap-4 text-sm">
                    <span>
                      Total time:{' '}
                      <strong>{steps.reduce((sum, s) => sum + s.latency, 0)}ms</strong>
                    </span>
                    {record && (
                      <span>
                        TTL: <strong>{record.ttl}s</strong>
                      </span>
                    )}
                  </div>
                  <Button onClick={handleReset} variant="outline" className="mt-4">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    New Lookup
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cache Status */}
      {(browserCache.size > 0 || osCache.size > 0 || resolverCache.size > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center gap-2 text-sm sm:text-base">
              <Database className="h-4 w-4 text-purple-500" />
              DNS Caches
              <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
                (run the same query again to see a cache hit!)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-xs text-muted-foreground sm:hidden">
              Run the same query again to see a cache hit!
            </p>
            <div className="grid grid-cols-3 gap-2 text-xs sm:text-sm">
              {[
                { name: 'Browser', cache: browserCache, color: 'blue' },
                { name: 'OS', cache: osCache, color: 'purple' },
                { name: 'Resolver', cache: resolverCache, color: 'indigo' },
              ].map(({ name, cache }) => (
                <div key={name} className="rounded-lg border bg-muted/30 p-1.5 sm:p-2">
                  <div className="mb-1 text-[10px] font-medium sm:text-xs">{name}</div>
                  {cache.size === 0 ? (
                    <span className="text-[10px] text-muted-foreground sm:text-xs">Empty</span>
                  ) : (
                    Array.from(cache.entries()).map(([key, entry]) => (
                      <div key={key} className="truncate text-[10px] text-muted-foreground sm:text-xs">
                        {key.split(':')[0]}
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      {stats.queries > 0 && (
        <Card>
          <CardContent className="p-3 sm:pt-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold sm:text-2xl">{stats.queries}</div>
                <div className="text-xs text-muted-foreground">Queries</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-500 sm:text-2xl">{stats.cacheHits}</div>
                <div className="text-xs text-muted-foreground">Cache Hits</div>
              </div>
              <div>
                <div className="text-lg font-bold sm:text-2xl">{stats.totalTime}ms</div>
                <div className="text-xs text-muted-foreground">Total Time</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Educational Footer */}
      <Card>
        <CardContent className="p-3 sm:pt-4">
          <h3 className="mb-2 text-sm font-semibold sm:mb-3 sm:text-base">💡 Key Takeaways</h3>
          <ul className="space-y-1.5 text-xs text-muted-foreground sm:space-y-2 sm:text-sm">
            <li>
              <strong className="text-foreground">DNS is hierarchical:</strong> Your query travels
              through multiple levels (browser → OS → resolver → root → TLD → authoritative).
            </li>
            <li>
              <strong className="text-foreground">Caching speeds things up:</strong> Each level can
              cache results. A cache hit avoids the full lookup chain.
            </li>
            <li>
              <strong className="text-foreground">TTL controls freshness:</strong> Records expire
              after their TTL. Lower TTL = fresher data, but more lookups.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
