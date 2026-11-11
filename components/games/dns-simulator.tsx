'use client';

import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Globe,
  Server,
  Database,
  ArrowRight,
  Play,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Zap,
  HardDrive,
  Wifi,
} from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import {
  SIM_CATEGORY,
  SIM_TONE,
  SimAnnouncer,
  SimBar,
  SimComplete,
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

// Every sample name is a zone apex, so none has a CNAME: the apex already holds
// SOA and NS records, and a CNAME cannot sit next to other data (RFC 1034).
const DNS_DATABASE: Record<string, Partial<Record<RecordType, DnsRecord>>> = {
  'example.com': {
    A: { type: 'A', value: '104.20.23.154, 172.66.147.243', ttl: 300 },
    AAAA: { type: 'AAAA', value: '2606:4700:10::6814:179a, 2606:4700:10::ac42:93f3', ttl: 300 },
    MX: { type: 'MX', value: '. (priority: 0, a null MX: this domain takes no mail)', ttl: 300 },
    TXT: { type: 'TXT', value: 'v=spf1 -all', ttl: 300 },
    NS: { type: 'NS', value: 'elliott.ns.cloudflare.com, hera.ns.cloudflare.com', ttl: 86400 },
  },
  'google.com': {
    A: { type: 'A', value: '142.250.80.46', ttl: 300 },
    AAAA: { type: 'AAAA', value: '2607:f8b0:4004:800::200e', ttl: 300 },
    MX: { type: 'MX', value: 'smtp.google.com (priority: 5)', ttl: 300 },
    TXT: { type: 'TXT', value: 'v=spf1 include:_spf.google.com ~all', ttl: 300 },
    NS: { type: 'NS', value: 'ns1.google.com, ns2.google.com', ttl: 21600 },
  },
  'github.com': {
    A: { type: 'A', value: '140.82.121.4', ttl: 60 },
    AAAA: { type: 'AAAA', value: '2606:50c0:8000::64', ttl: 60 },
    MX: { type: 'MX', value: 'alt1.aspmx.l.google.com (priority: 5)', ttl: 60 },
    TXT: { type: 'TXT', value: 'v=spf1 include:_spf.google.com ~all', ttl: 60 },
    NS: { type: 'NS', value: 'dns1.p08.nsone.net, dns2.p08.nsone.net', ttl: 900 },
  },
  'cloudflare.com': {
    A: { type: 'A', value: '104.16.132.229', ttl: 300 },
    AAAA: { type: 'AAAA', value: '2606:4700::6810:84e5', ttl: 300 },
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

// Chrome keeps an answer from the system resolver for one minute, because
// getaddrinfo returns no TTL. The OS cache and the resolver honour the TTL.
const BROWSER_CACHE_MAX_SECONDS = 60;

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
      : recordType === 'CNAME'
        ? `No CNAME for ${domain}. A zone apex already has SOA and NS records, and a CNAME cannot sit next to other records, so aliases live on names like www.${domain}.`
        : `The authoritative server doesn't have a ${recordType} record for ${domain}.`,
    isCacheCheck: false,
    latency: 20,
  });

  return steps;
}

interface DnsMissionState {
  domain: string;
  recordType: RecordType;
  steps: DnsStep[];
  isComplete: boolean;
}

const MISSIONS: Mission<DnsMissionState>[] = [
  {
    id: 'full-lookup',
    label: 'Resolve a name from scratch: resolver, root, TLD, then the authoritative server.',
    hint: 'Pick a domain nobody looked up yet and run the lookup to the end.',
    check: (state) =>
      state.isComplete &&
      ['root', 'tld', 'authoritative'].every((location) =>
        state.steps.some((step) => step.location === location)
      ),
  },
  {
    id: 'cache-hit',
    label: 'Look up the same name again and watch a cache answer.',
    hint: 'The second lookup never leaves your machine or the resolver.',
    check: (state) =>
      state.isComplete &&
      state.steps.some((step) => step.cacheHit) &&
      !state.steps.some((step) => step.location === 'root'),
  },
  {
    id: 'mx',
    label: "Find where a domain's mail goes: look up an MX record.",
    hint: 'Pick MX as the record type.',
    check: (state) =>
      state.isComplete &&
      state.recordType === 'MX' &&
      Boolean(DNS_DATABASE[state.domain]?.[state.recordType]),
  },
];

const LOCATION_CATEGORY: Record<DnsStep['location'], keyof typeof SIM_CATEGORY> = {
  browser: 'primary',
  os: 'neutral',
  resolver: 'sky',
  root: 'violet',
  tld: 'sky',
  authoritative: 'emerald',
};

type Tab = 'path' | 'details';

// ============================================================================
// COMPONENT
// ============================================================================

export default function DnsSimulator() {
  const [tab, setTab] = useState<Tab>('path');
  const [dismissed, setDismissed] = useState(false);
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

  const missionState = useMemo(
    () => ({ domain, recordType, steps, isComplete }),
    [domain, recordType, steps, isComplete]
  );
  const missions = useMissions(MISSIONS, missionState);

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

    // Each layer stores the answer on its way back, so the layers above the
    // one that answered are filled. A cached answer keeps its remaining TTL.
    const cacheKey = `${domain}:${recordType}`;
    const answeredBy = steps.find((s) => s.cacheHit)?.location;
    if (answeredBy === 'browser') return;
    const now = Date.now();
    let entry: CacheEntry | undefined;
    if (answeredBy === 'os') entry = osCache.get(cacheKey);
    else if (answeredBy === 'resolver') entry = resolverCache.get(cacheKey);
    else {
      const record = DNS_DATABASE[domain]?.[recordType];
      if (record)
        entry = { value: record.value, ttl: record.ttl, expiresAt: now + record.ttl * 1000 };
    }
    if (!entry) return;
    const fresh = entry;
    setBrowserCache((prev) =>
      new Map(prev).set(cacheKey, {
        ...fresh,
        expiresAt: Math.min(fresh.expiresAt, now + BROWSER_CACHE_MAX_SECONDS * 1000),
      })
    );
    if (answeredBy !== 'os') setOsCache((prev) => new Map(prev).set(cacheKey, fresh));
    if (!answeredBy) setResolverCache((prev) => new Map(prev).set(cacheKey, fresh));
  }, [steps, domain, recordType, osCache, resolverCache]);

  // Start a new query but keep what the caches have learned.
  const handleNewLookup = () => {
    setSteps([]);
    setCurrentStepIndex(-1);
    setIsRunning(false);
    setIsComplete(false);
  };

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

  const startOver = () => {
    handleReset();
    missions.reset();
    setDismissed(false);
  };
  const announcement = currentStep
    ? `${currentStep.title}: ${currentStep.cacheHit ? 'cache answered' : 'query in progress'}.`
    : isComplete
      ? 'DNS lookup complete.'
      : 'Choose a record type and run a DNS lookup.';

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame phoneBar>
        <SimBar
          title="DNS Simulator"
          icon={Globe}
          lead={
            <>
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                Domain
                <select
                  aria-label="Domain"
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                  disabled={isRunning}
                  className="h-10 rounded-md border border-input bg-background px-2 text-sm text-foreground lg:h-8"
                >
                  {SAMPLE_DOMAINS.map((sampleDomain) => (
                    <option key={sampleDomain} value={sampleDomain}>
                      {sampleDomain}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                Record type
                <select
                  aria-label="Record type"
                  value={recordType}
                  onChange={(event) => setRecordType(event.target.value as RecordType)}
                  disabled={isRunning}
                  className="h-10 rounded-md border border-input bg-background px-2 text-sm text-foreground lg:h-8"
                >
                  {RECORD_TYPES.map((type) => (
                    <option key={type.type} value={type.type}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          }
          tools={<SimResetButton onReset={startOver} />}
          steps={steps.map((step, index) => ({
            title: step.shortTitle,
            status:
              isComplete || index < currentStepIndex
                ? 'done'
                : index === currentStepIndex
                  ? 'started'
                  : 'todo',
          }))}
          current={Math.max(0, Math.min(currentStepIndex, totalSteps - 1))}
          onStep={(index) => {
            if (isRunning && index <= currentStepIndex) setCurrentStepIndex(index);
          }}
          stepsLabel="DNS lookup steps"
          progress={{ current: missions.done, total: missions.total }}
          heading={
            isComplete
              ? `Lookup complete: ${recordType} ${domain}`
              : currentStep
                ? currentStep.title
                : `Ready: ${recordType} ${domain}`
          }
          actions={
            <div className="hidden items-center gap-1.5 lg:flex">
              {!isRunning && !isComplete && (
                <Button type="button" className="h-8" onClick={runLookup}>
                  <Play className="h-4 w-4" aria-hidden="true" />
                  Run lookup
                </Button>
              )}
              {isRunning && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8"
                    onClick={handleStepBack}
                    disabled={currentStepIndex <= 0}
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    Prev
                  </Button>
                  <Button type="button" className="h-8" onClick={handleStepForward}>
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    Step
                  </Button>
                </>
              )}
              {isComplete && (
                <Button type="button" variant="outline" className="h-8" onClick={handleNewLookup}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  New lookup
                </Button>
              )}
            </div>
          }
          goal={
            missions.complete ? (
              'All three missions are complete. Keep exploring DNS records and caches.'
            ) : (
              <>
                {missions.current?.label}{' '}
                <span className="text-muted-foreground">{missions.current?.hint}</span>
              </>
            )
          }
        />

        <SimAnnouncer message={announcement} />

        {missions.complete && !dismissed ? (
          <SimComplete
            title="DNS missions complete"
            summary="You traced a fresh DNS lookup through the hierarchy, saw a cached reply, and found a mail server with an MX record."
            stats={[
              { label: 'Missions', value: `${missions.done}/${missions.total}` },
              { label: 'Lookups', value: stats.queries },
              { label: 'Cache hits', value: stats.cacheHits },
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
            columns="lg:grid-cols-[minmax(0,1.45fr)_minmax(17rem,0.8fr)]"
            minHeight="min-h-[24rem]"
            tab={tab}
            onTabChange={(next) => {
              if (next === 'path' || next === 'details') setTab(next);
            }}
            tabsLabel="DNS simulator panels"
            panels={[
              {
                id: 'path',
                label: 'Resolution path',
                className: 'space-y-2',
                content: (
                  <>
                    <section className="rounded-lg border bg-card p-3">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="flex items-center gap-2 text-sm font-semibold">
                          <Server className="h-4 w-4 text-primary" aria-hidden="true" />
                          Resolution path
                        </h3>
                        {steps.length > 0 && (
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            Step {Math.min(currentStepIndex + 1, totalSteps)}/{totalSteps}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                        {Object.entries(LOCATIONS_INFO).map(([key, info]) => {
                          const location = key as DnsStep['location'];
                          const Icon = info.icon;
                          const stepForNode = steps.find((step) => step.location === location);
                          const stepIdx = steps.findIndex((step) => step.location === location);
                          const isActive = stepIdx === currentStepIndex && isRunning;
                          const isPast = stepIdx >= 0 && stepIdx < currentStepIndex;
                          const isHit = stepForNode?.cacheHit;
                          const category = SIM_CATEGORY[LOCATION_CATEGORY[location]];

                          return (
                            <motion.div
                              key={location}
                              className={cn(
                                'flex min-w-0 flex-col items-center rounded-lg border p-2 text-center',
                                category.fill,
                                category.border,
                                isActive && cn(SIM_TONE.info.surface, 'ring-2 ring-primary'),
                                isPast && isHit && SIM_TONE.success.surface,
                                isPast && !isHit && 'bg-muted'
                              )}
                              animate={isActive ? { scale: 1.03 } : { scale: 1 }}
                              transition={{ duration: 0.2 }}
                            >
                              <Icon
                                className={cn(
                                  'h-5 w-5',
                                  isHit ? SIM_TONE.success.iconClass : 'text-foreground',
                                  !isActive && !isPast && 'text-muted-foreground'
                                )}
                                aria-hidden="true"
                              />
                              <span className="mt-1 text-xs font-medium leading-tight">
                                {info.name}
                              </span>
                              {isHit && (
                                <span className="mt-1 flex items-center gap-1 text-xs text-correct-foreground">
                                  <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                  Cache hit
                                </span>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </section>

                    <AnimatePresence mode="wait">
                      {currentStep && currentStepIndex < steps.length && (
                        <motion.section
                          key={currentStep.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.2 }}
                          className={cn(
                            'rounded-lg border p-3',
                            currentStep.cacheHit ? SIM_TONE.success.surface : SIM_TONE.info.surface
                          )}
                        >
                          <div className="flex items-start gap-3">
                            {currentStep.cacheHit ? (
                              <Zap
                                className={cn(
                                  'mt-0.5 h-5 w-5 shrink-0',
                                  SIM_TONE.success.iconClass
                                )}
                                aria-hidden="true"
                              />
                            ) : (
                              <ArrowRight
                                className={cn('mt-0.5 h-5 w-5 shrink-0', SIM_TONE.info.iconClass)}
                                aria-hidden="true"
                              />
                            )}
                            <div>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <h3 className="text-sm font-semibold">{currentStep.title}</h3>
                                <span className="font-mono text-xs text-muted-foreground">
                                  ~{currentStep.latency}ms
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {currentStep.explanation}
                              </p>
                            </div>
                          </div>
                        </motion.section>
                      )}
                    </AnimatePresence>

                    {isComplete && (
                      <section className="rounded-lg border bg-card p-3">
                        <div className="flex items-start gap-2">
                          <CheckCircle
                            className={cn('mt-0.5 h-5 w-5 shrink-0', SIM_TONE.success.iconClass)}
                            aria-hidden="true"
                          />
                          <div>
                            <h3 className="text-sm font-semibold">Lookup complete</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {record ? `${domain} returned ${record.value}.` : 'No record found.'}
                            </p>
                          </div>
                        </div>
                      </section>
                    )}
                  </>
                ),
              },
              {
                id: 'details',
                label: 'Details',
                className: 'space-y-2',
                content: (
                  <>
                    <SimMissionList missions={missions.missions} />
                    <section className="rounded-lg border bg-card p-3">
                      <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <Database className="h-4 w-4 text-primary" aria-hidden="true" />
                        DNS caches
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Run the same query again to see the closest cache answer.
                      </p>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {[
                          { name: 'Browser', cache: browserCache, flush: setBrowserCache },
                          { name: 'OS', cache: osCache, flush: setOsCache },
                          { name: 'Resolver', cache: resolverCache, flush: setResolverCache },
                        ].map(({ name, cache, flush }) => (
                          <div key={name} className="min-w-0 rounded-md border bg-muted/50 p-2">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium">{name}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => flush(new Map())}
                                disabled={isRunning || cache.size === 0}
                                className="h-10 justify-start px-1 text-xs lg:h-8"
                              >
                                Flush
                              </Button>
                            </div>
                            {cache.size === 0 ? (
                              <span className="text-xs text-muted-foreground">Empty</span>
                            ) : (
                              Array.from(cache.entries()).map(([key]) => (
                                <div key={key} className="truncate text-xs text-muted-foreground">
                                  {key}
                                </div>
                              ))
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                    <section className="rounded-lg border bg-card p-3">
                      <h3 className="text-sm font-semibold">Lookup stats</h3>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="font-mono text-lg font-semibold tabular-nums">
                            {stats.queries}
                          </div>
                          <div className="text-xs text-muted-foreground">Queries</div>
                        </div>
                        <div>
                          <div className="font-mono text-lg font-semibold tabular-nums text-correct-foreground">
                            {stats.cacheHits}
                          </div>
                          <div className="text-xs text-muted-foreground">Cache hits</div>
                        </div>
                        <div>
                          <div className="font-mono text-lg font-semibold tabular-nums">
                            {stats.totalTime}ms
                          </div>
                          <div className="text-xs text-muted-foreground">Elapsed</div>
                        </div>
                      </div>
                    </section>
                    <section className="rounded-lg border bg-card p-3">
                      <h3 className="text-sm font-semibold">Record reference</h3>
                      <dl className="mt-2 space-y-1.5 text-sm">
                        {RECORD_TYPES.map((type) => (
                          <div
                            key={type.type}
                            className="flex items-baseline justify-between gap-2"
                          >
                            <dt className="font-mono font-medium">{type.label}</dt>
                            <dd className="text-xs text-muted-foreground">{type.description}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                    <details className="rounded-lg border bg-card p-3">
                      <summary className="cursor-pointer text-sm font-medium">
                        How DNS resolution works
                      </summary>
                      <p className="mt-2 text-sm text-muted-foreground">
                        A browser checks its own cache, the operating system, and a resolver first.
                        On a miss, the resolver asks root and TLD servers for a referral before
                        asking the authoritative server. TTLs control how long each answer is kept.
                      </p>
                    </details>
                  </>
                ),
              },
            ]}
          />
        )}

        <SimPhoneBar>
          {!isRunning && !isComplete && (
            <Button type="button" className="h-10 flex-1" onClick={runLookup}>
              <Play className="h-4 w-4" aria-hidden="true" />
              Run lookup
            </Button>
          )}
          {isRunning && (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={handleStepBack}
                disabled={currentStepIndex <= 0}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Prev
              </Button>
              <Button type="button" className="h-10 flex-1" onClick={handleStepForward}>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                Step
              </Button>
            </>
          )}
          {isComplete && (
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1"
              onClick={handleNewLookup}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              New lookup
            </Button>
          )}
        </SimPhoneBar>
      </SimFrame>
    </MotionConfig>
  );
}
