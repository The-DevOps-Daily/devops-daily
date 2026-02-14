'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Play,
  Pause,
  RotateCcw,
  Server,
  Database,
  Cloud,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Zap,
  HardDrive,
  Activity,
  XCircle,
  ArrowRight,
  RefreshCw,
  Settings,
} from 'lucide-react';

// Types
interface BackupSite {
  id: string;
  name: string;
  type: 'hot' | 'warm' | 'cold';
  status: 'active' | 'standby' | 'offline' | 'recovering';
  syncStatus: number; // 0-100%
  lastSync: number; // timestamp
  monthlyCost: number;
  recoveryTime: number; // minutes
}

interface DisasterScenario {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedSystems: string[];
  icon: React.ReactNode;
}

interface DRConfig {
  rtoMinutes: number; // Recovery Time Objective
  rpoMinutes: number; // Recovery Point Objective
  backupFrequency: number; // minutes
  replicationEnabled: boolean;
  autoFailover: boolean;
}

interface SimulationState {
  isRunning: boolean;
  currentPhase: 'normal' | 'disaster' | 'detection' | 'failover' | 'recovery' | 'restored';
  elapsedTime: number; // seconds since disaster
  dataLoss: number; // minutes of data lost
  downtime: number; // minutes of downtime
  activeScenario: DisasterScenario | null;
}

// Disaster scenarios
const SCENARIOS: DisasterScenario[] = [
  {
    id: 'datacenter-outage',
    name: 'Data Center Outage',
    description: 'Complete power failure at primary data center',
    severity: 'critical',
    affectedSystems: ['Web Servers', 'Database', 'Storage', 'Network'],
    icon: <Server className="w-5 h-5" />,
  },
  {
    id: 'ransomware',
    name: 'Ransomware Attack',
    description: 'Encryption of critical systems by malicious actors',
    severity: 'critical',
    affectedSystems: ['Database', 'File Storage', 'Application Servers'],
    icon: <Shield className="w-5 h-5" />,
  },
  {
    id: 'database-corruption',
    name: 'Database Corruption',
    description: 'Critical data corruption requiring restore from backup',
    severity: 'high',
    affectedSystems: ['Database', 'Application Data'],
    icon: <Database className="w-5 h-5" />,
  },
  {
    id: 'network-failure',
    name: 'Network Failure',
    description: 'Major network connectivity issues affecting all services',
    severity: 'high',
    affectedSystems: ['Network', 'Load Balancers', 'CDN'],
    icon: <Cloud className="w-5 h-5" />,
  },
  {
    id: 'hardware-failure',
    name: 'Hardware Failure',
    description: 'Critical server hardware malfunction',
    severity: 'medium',
    affectedSystems: ['Web Servers', 'Application Servers'],
    icon: <HardDrive className="w-5 h-5" />,
  },
];

// Backup site configurations
const BACKUP_SITES: Record<string, Omit<BackupSite, 'id' | 'status' | 'syncStatus' | 'lastSync'>> = {
  hot: {
    name: 'Hot Site',
    type: 'hot',
    monthlyCost: 15000,
    recoveryTime: 5,
  },
  warm: {
    name: 'Warm Site',
    type: 'warm',
    monthlyCost: 5000,
    recoveryTime: 60,
  },
  cold: {
    name: 'Cold Site',
    type: 'cold',
    monthlyCost: 1000,
    recoveryTime: 480,
  },
};

export default function BCDRSimulator() {
  // DR Configuration
  const [drConfig, setDRConfig] = useState<DRConfig>({
    rtoMinutes: 60,
    rpoMinutes: 15,
    backupFrequency: 60,
    replicationEnabled: false,
    autoFailover: false,
  });

  // Backup sites
  const [backupSites, setBackupSites] = useState<BackupSite[]>([
    {
      id: 'primary',
      name: 'Primary Site',
      type: 'hot',
      status: 'active',
      syncStatus: 100,
      lastSync: Date.now(),
      monthlyCost: 0,
      recoveryTime: 0,
    },
  ]);

  // Simulation state
  const [simulation, setSimulation] = useState<SimulationState>({
    isRunning: false,
    currentPhase: 'normal',
    elapsedTime: 0,
    dataLoss: 0,
    downtime: 0,
    activeScenario: null,
  });

  // Selected backup site type to add
  const [selectedSiteType, setSelectedSiteType] = useState<'hot' | 'warm' | 'cold'>('warm');

  // Calculate total monthly cost
  const totalMonthlyCost = backupSites.reduce((sum, site) => sum + site.monthlyCost, 0) +
    (drConfig.replicationEnabled ? 500 : 0) +
    (drConfig.autoFailover ? 300 : 0);

  // Calculate effective RTO based on configuration
  const effectiveRTO = useCallback(() => {
    const drSite = backupSites.find(s => s.id !== 'primary');
    if (!drSite) return Infinity;
    
    let rto = drSite.recoveryTime;
    if (drConfig.autoFailover) rto = Math.max(rto * 0.5, 2);
    if (drConfig.replicationEnabled) rto = Math.max(rto * 0.8, 2);
    
    return Math.round(rto);
  }, [backupSites, drConfig]);

  // Calculate effective RPO based on configuration
  const effectiveRPO = useCallback(() => {
    if (drConfig.replicationEnabled) return 1; // Near real-time
    return drConfig.backupFrequency;
  }, [drConfig]);

  // Add backup site
  const addBackupSite = () => {
    if (backupSites.length >= 3) return;
    
    const siteConfig = BACKUP_SITES[selectedSiteType];
    const newSite: BackupSite = {
      id: `dr-${Date.now()}`,
      ...siteConfig,
      status: 'standby',
      syncStatus: 0,
      lastSync: 0,
    };
    
    setBackupSites([...backupSites, newSite]);
  };

  // Remove backup site
  const removeBackupSite = (siteId: string) => {
    if (siteId === 'primary') return;
    setBackupSites(backupSites.filter(s => s.id !== siteId));
  };

  // Start disaster simulation
  const startSimulation = (scenario: DisasterScenario) => {
    setSimulation({
      isRunning: true,
      currentPhase: 'disaster',
      elapsedTime: 0,
      dataLoss: 0,
      downtime: 0,
      activeScenario: scenario,
    });

    // Mark primary as offline
    setBackupSites(sites =>
      sites.map(s =>
        s.id === 'primary' ? { ...s, status: 'offline' as const } : s
      )
    );
  };

  // Reset simulation
  const resetSimulation = () => {
    setSimulation({
      isRunning: false,
      currentPhase: 'normal',
      elapsedTime: 0,
      dataLoss: 0,
      downtime: 0,
      activeScenario: null,
    });

    setBackupSites(sites =>
      sites.map(s => ({
        ...s,
        status: s.id === 'primary' ? 'active' as const : 'standby' as const,
        syncStatus: s.id === 'primary' ? 100 : s.syncStatus,
      }))
    );
  };

  // Simulation tick
  useEffect(() => {
    if (!simulation.isRunning) return;

    const interval = setInterval(() => {
      setSimulation(prev => {
        const newElapsed = prev.elapsedTime + 1;
        const drSite = backupSites.find(s => s.id !== 'primary');
        const recoveryTimeSeconds = drSite ? effectiveRTO() * 60 : Infinity;
        
        let newPhase = prev.currentPhase;
        let newDowntime = prev.downtime;
        let newDataLoss = prev.dataLoss;

        // Phase transitions based on elapsed time
        if (prev.currentPhase === 'disaster' && newElapsed >= 10) {
          newPhase = 'detection';
        } else if (prev.currentPhase === 'detection' && newElapsed >= 30) {
          newPhase = drSite ? 'failover' : 'detection';
          if (drSite) {
            setBackupSites(sites =>
              sites.map(s =>
                s.id !== 'primary' ? { ...s, status: 'recovering' as const } : s
              )
            );
          }
        } else if (prev.currentPhase === 'failover' && newElapsed >= 30 + recoveryTimeSeconds) {
          newPhase = 'recovery';
          if (drSite) {
            setBackupSites(sites =>
              sites.map(s =>
                s.id !== 'primary' ? { ...s, status: 'active' as const } : s
              )
            );
          }
        } else if (prev.currentPhase === 'recovery' && newElapsed >= 60 + recoveryTimeSeconds) {
          newPhase = 'restored';
        }

        // Calculate downtime (until DR site is active)
        if (newPhase !== 'restored' && newPhase !== 'recovery') {
          newDowntime = Math.floor(newElapsed / 60);
        }

        // Calculate data loss based on RPO
        newDataLoss = effectiveRPO();

        return {
          ...prev,
          elapsedTime: newElapsed,
          currentPhase: newPhase,
          downtime: newDowntime,
          dataLoss: newDataLoss,
        };
      });
    }, 100); // Speed up simulation (100ms = 1 second)

    return () => clearInterval(interval);
  }, [simulation.isRunning, backupSites, effectiveRTO, effectiveRPO]);

  // Sync backup sites periodically
  useEffect(() => {
    if (simulation.isRunning) return;

    const interval = setInterval(() => {
      setBackupSites(sites =>
        sites.map(site => {
          if (site.id === 'primary') return site;
          
          const syncIncrement = drConfig.replicationEnabled ? 10 : 2;
          const newSync = Math.min(site.syncStatus + syncIncrement, 100);
          
          return {
            ...site,
            syncStatus: newSync,
            lastSync: newSync === 100 ? Date.now() : site.lastSync,
          };
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [simulation.isRunning, drConfig.replicationEnabled]);

  const getPhaseColor = (phase: SimulationState['currentPhase']) => {
    switch (phase) {
      case 'normal': return 'bg-green-500';
      case 'disaster': return 'bg-red-500';
      case 'detection': return 'bg-orange-500';
      case 'failover': return 'bg-yellow-500';
      case 'recovery': return 'bg-blue-500';
      case 'restored': return 'bg-green-500';
    }
  };

  const getPhaseText = (phase: SimulationState['currentPhase']) => {
    switch (phase) {
      case 'normal': return 'Systems Normal';
      case 'disaster': return 'Disaster Detected!';
      case 'detection': return 'Analyzing Impact...';
      case 'failover': return 'Failing Over to DR Site...';
      case 'recovery': return 'Services Recovering...';
      case 'restored': return 'Services Restored';
    }
  };

  const getSeverityColor = (severity: DisasterScenario['severity']) => {
    switch (severity) {
      case 'low': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'high': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'critical': return 'bg-red-500/10 text-red-500 border-red-500/20';
    }
  };

  const getSiteTypeColor = (type: BackupSite['type']) => {
    switch (type) {
      case 'hot': return 'text-red-500';
      case 'warm': return 'text-orange-500';
      case 'cold': return 'text-blue-500';
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold md:text-3xl">BCDR Simulator</h1>
        <p className="mt-2 text-muted-foreground">
          Business Continuity & Disaster Recovery Planning
        </p>
      </div>

      {/* Status Bar */}
      <Card className={`border-2 transition-colors ${simulation.isRunning ? 'border-red-500/50' : 'border-green-500/50'}`}>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${getPhaseColor(simulation.currentPhase)} animate-pulse`} />
              <span className="font-medium">{getPhaseText(simulation.currentPhase)}</span>
              {simulation.activeScenario && (
                <Badge variant="outline" className={getSeverityColor(simulation.activeScenario.severity)}>
                  {simulation.activeScenario.name}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4">
              {simulation.isRunning && (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4" />
                    <span>Elapsed: {Math.floor(simulation.elapsedTime / 60)}m {simulation.elapsedTime % 60}s</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-orange-500">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Downtime: {simulation.downtime}m</span>
                  </div>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={resetSimulation}
                disabled={!simulation.isRunning && simulation.currentPhase === 'normal'}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Configuration */}
        <div className="space-y-6 lg:col-span-1">
          {/* DR Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="w-5 h-5" />
                DR Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* RTO Setting */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Target RTO</span>
                  <span className="font-mono">{drConfig.rtoMinutes} min</span>
                </div>
                <Slider
                  value={[drConfig.rtoMinutes]}
                  onValueChange={([v]) => setDRConfig({ ...drConfig, rtoMinutes: v })}
                  min={5}
                  max={480}
                  step={5}
                  disabled={simulation.isRunning}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum acceptable downtime
                </p>
              </div>

              {/* RPO Setting */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Target RPO</span>
                  <span className="font-mono">{drConfig.rpoMinutes} min</span>
                </div>
                <Slider
                  value={[drConfig.rpoMinutes]}
                  onValueChange={([v]) => setDRConfig({ ...drConfig, rpoMinutes: v })}
                  min={1}
                  max={1440}
                  step={1}
                  disabled={simulation.isRunning}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum acceptable data loss
                </p>
              </div>

              {/* Backup Frequency */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Backup Frequency</span>
                  <span className="font-mono">{drConfig.backupFrequency} min</span>
                </div>
                <Slider
                  value={[drConfig.backupFrequency]}
                  onValueChange={([v]) => setDRConfig({ ...drConfig, backupFrequency: v })}
                  min={5}
                  max={1440}
                  step={5}
                  disabled={simulation.isRunning || drConfig.replicationEnabled}
                />
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm">Real-time Replication</span>
                  <button
                    onClick={() => setDRConfig({ ...drConfig, replicationEnabled: !drConfig.replicationEnabled })}
                    disabled={simulation.isRunning}
                    className={`w-12 h-6 rounded-full transition-colors ${drConfig.replicationEnabled ? 'bg-green-500' : 'bg-muted'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${drConfig.replicationEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm">Auto Failover</span>
                  <button
                    onClick={() => setDRConfig({ ...drConfig, autoFailover: !drConfig.autoFailover })}
                    disabled={simulation.isRunning}
                    className={`w-12 h-6 rounded-full transition-colors ${drConfig.autoFailover ? 'bg-green-500' : 'bg-muted'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${drConfig.autoFailover ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Cost Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="w-5 h-5" />
                Monthly Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                ${totalMonthlyCost.toLocaleString()}
              </div>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                {backupSites.filter(s => s.id !== 'primary').map(site => (
                  <div key={site.id} className="flex justify-between">
                    <span>{site.name}</span>
                    <span>${site.monthlyCost.toLocaleString()}</span>
                  </div>
                ))}
                {drConfig.replicationEnabled && (
                  <div className="flex justify-between">
                    <span>Replication</span>
                    <span>$500</span>
                  </div>
                )}
                {drConfig.autoFailover && (
                  <div className="flex justify-between">
                    <span>Auto Failover</span>
                    <span>$300</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center Column - Sites & Visualization */}
        <div className="space-y-6 lg:col-span-2">
          {/* Sites Grid */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Server className="w-5 h-5" />
                  Infrastructure
                </CardTitle>
                {backupSites.length < 3 && !simulation.isRunning && (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedSiteType}
                      onChange={(e) => setSelectedSiteType(e.target.value as 'hot' | 'warm' | 'cold')}
                      className="px-2 py-1 text-sm border rounded bg-background"
                    >
                      <option value="hot">Hot Site ($15k/mo)</option>
                      <option value="warm">Warm Site ($5k/mo)</option>
                      <option value="cold">Cold Site ($1k/mo)</option>
                    </select>
                    <Button size="sm" onClick={addBackupSite}>
                      Add DR Site
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {backupSites.map((site, index) => (
                  <div
                    key={site.id}
                    className={`p-4 border rounded-lg transition-all ${
                      site.status === 'active' ? 'border-green-500 bg-green-500/5' :
                      site.status === 'offline' ? 'border-red-500 bg-red-500/5' :
                      site.status === 'recovering' ? 'border-yellow-500 bg-yellow-500/5' :
                      'border-muted'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Server className={`w-5 h-5 ${getSiteTypeColor(site.type)}`} />
                          <span className="font-medium">{site.name}</span>
                        </div>
                        <Badge variant="outline" className="mt-1 text-xs capitalize">
                          {site.type} site
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {site.status === 'active' && <CheckCircle className="w-5 h-5 text-green-500" />}
                        {site.status === 'offline' && <XCircle className="w-5 h-5 text-red-500" />}
                        {site.status === 'standby' && <Clock className="w-5 h-5 text-muted-foreground" />}
                        {site.status === 'recovering' && <RefreshCw className="w-5 h-5 text-yellow-500 animate-spin" />}
                        {site.id !== 'primary' && !simulation.isRunning && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeBackupSite(site.id)}
                            className="w-6 h-6 p-0 text-muted-foreground hover:text-red-500"
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {site.id !== 'primary' && (
                      <div className="mt-3 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span>Sync Status</span>
                          <span>{site.syncStatus}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full transition-all bg-blue-500"
                            style={{ width: `${site.syncStatus}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Recovery Time</span>
                          <span>{site.recoveryTime} min</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Data flow visualization */}
              {backupSites.length > 1 && (
                <div className="flex items-center justify-center gap-4 mt-6">
                  <div className="text-center">
                    <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${
                      backupSites[0].status === 'active' ? 'bg-green-500/20' : 'bg-red-500/20'
                    }`}>
                      <Database className={`w-8 h-8 ${
                        backupSites[0].status === 'active' ? 'text-green-500' : 'text-red-500'
                      }`} />
                    </div>
                    <span className="text-xs">Primary</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ArrowRight className={`w-6 h-6 ${
                      drConfig.replicationEnabled ? 'text-green-500' : 'text-muted-foreground'
                    }`} />
                    <span className="text-xs text-muted-foreground">
                      {drConfig.replicationEnabled ? 'Real-time' : `Every ${drConfig.backupFrequency}m`}
                    </span>
                    <ArrowRight className={`w-6 h-6 ${
                      drConfig.replicationEnabled ? 'text-green-500' : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div className="text-center">
                    <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${
                      backupSites[1]?.status === 'active' ? 'bg-green-500/20' :
                      backupSites[1]?.status === 'recovering' ? 'bg-yellow-500/20' :
                      'bg-muted'
                    }`}>
                      <Database className={`w-8 h-8 ${
                        backupSites[1]?.status === 'active' ? 'text-green-500' :
                        backupSites[1]?.status === 'recovering' ? 'text-yellow-500' :
                        'text-muted-foreground'
                      }`} />
                    </div>
                    <span className="text-xs">DR Site</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Disaster Scenarios */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="w-5 h-5" />
                Simulate Disaster
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {SCENARIOS.map(scenario => (
                  <button
                    key={scenario.id}
                    onClick={() => startSimulation(scenario)}
                    disabled={simulation.isRunning || backupSites.length < 2}
                    className={`p-4 text-left border rounded-lg transition-all hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed ${
                      getSeverityColor(scenario.severity)
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {scenario.icon}
                      <span className="font-medium">{scenario.name}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {scenario.description}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {scenario.affectedSystems.slice(0, 3).map(sys => (
                        <Badge key={sys} variant="outline" className="text-xs">
                          {sys}
                        </Badge>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
              {backupSites.length < 2 && (
                <p className="mt-4 text-sm text-center text-muted-foreground">
                  Add a DR site to simulate disasters
                </p>
              )}
            </CardContent>
          </Card>

          {/* RTO/RPO Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="w-5 h-5" />
                RTO/RPO Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Recovery Time Objective (RTO)</span>
                    <Badge variant={effectiveRTO() <= drConfig.rtoMinutes ? 'default' : 'destructive'}>
                      {effectiveRTO() <= drConfig.rtoMinutes ? 'Met' : 'Not Met'}
                    </Badge>
                  </div>
                  <div className="flex items-end gap-4">
                    <div>
                      <div className="text-2xl font-bold">{effectiveRTO() === Infinity ? '∞' : effectiveRTO()}</div>
                      <div className="text-xs text-muted-foreground">Effective (min)</div>
                    </div>
                    <div className="text-muted-foreground">/</div>
                    <div>
                      <div className="text-2xl font-bold text-muted-foreground">{drConfig.rtoMinutes}</div>
                      <div className="text-xs text-muted-foreground">Target (min)</div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Recovery Point Objective (RPO)</span>
                    <Badge variant={effectiveRPO() <= drConfig.rpoMinutes ? 'default' : 'destructive'}>
                      {effectiveRPO() <= drConfig.rpoMinutes ? 'Met' : 'Not Met'}
                    </Badge>
                  </div>
                  <div className="flex items-end gap-4">
                    <div>
                      <div className="text-2xl font-bold">{effectiveRPO()}</div>
                      <div className="text-xs text-muted-foreground">Effective (min)</div>
                    </div>
                    <div className="text-muted-foreground">/</div>
                    <div>
                      <div className="text-2xl font-bold text-muted-foreground">{drConfig.rpoMinutes}</div>
                      <div className="text-xs text-muted-foreground">Target (min)</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="p-4 mt-6 border rounded-lg bg-muted/30">
                <h4 className="mb-2 text-sm font-medium">Recommendations</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {backupSites.length < 2 && (
                    <li className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      Add a DR site to enable disaster recovery
                    </li>
                  )}
                  {effectiveRTO() > drConfig.rtoMinutes && backupSites.length >= 2 && (
                    <li className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      Upgrade to a Hot Site or enable Auto Failover to meet RTO
                    </li>
                  )}
                  {effectiveRPO() > drConfig.rpoMinutes && (
                    <li className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      Enable real-time replication to meet RPO target
                    </li>
                  )}
                  {effectiveRTO() <= drConfig.rtoMinutes && effectiveRPO() <= drConfig.rpoMinutes && (
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Current configuration meets all DR objectives
                    </li>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
