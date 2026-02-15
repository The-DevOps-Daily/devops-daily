'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RefreshCw, Wifi, WifiOff, Shield, Zap, Activity, AlertTriangle, Info, Lock, ArrowRightLeft, Keyboard } from 'lucide-react';

/**
 * TCP vs UDP Visual Simulator
 * Designed for devops-daily.com
 * * Features:
 * - Particle-based network simulation
 * - TCP 3-Way Handshake visualization
 * - Visual representation of ACKs vs Fire-and-Forget
 * - Interactive Network Conditions (Latency, Loss, Jitter)
 */

// --- Constants & Config ---
const COLORS = {
  bg: '#0f172a', // Slate 900
  panel: '#1e293b', // Slate 800
  tcp: '#06b6d4', // Cyan 500
  udp: '#22c55e', // Green 500
  loss: '#ef4444', // Red 500
  ack: '#f59e0b', // Amber 500
  syn: '#d946ef', // Fuschia 500 (Handshake)
  text: '#f8fafc',
  textDim: '#94a3b8'
};

const MODES = {
  TCP: 'TCP',
  UDP: 'UDP'
};

const CONNECTION_STATES = {
  DISCONNECTED: 'DISCONNECTED',
  HANDSHAKE_SYN: 'HANDSHAKE_SYN',       // Client sends SYN
  HANDSHAKE_SYN_ACK: 'HANDSHAKE_SYN_ACK', // Server sends SYN-ACK
  HANDSHAKE_ACK: 'HANDSHAKE_ACK',       // Client sends ACK
  CONNECTED: 'CONNECTED'                // Data flow
};

// --- Helper Components ---

const Tooltip = ({ children, text }: { children: React.ReactNode; text: string }) => (
  <div className="group relative flex items-center">
    {children}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-black/90 text-xs text-white rounded shadow-lg z-50 pointer-events-none border border-slate-700">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/90"></div>
    </div>
  </div>
);

const StatCard = ({ label, value, color, icon: Icon, subtext }: { label: string; value: string | number; color: string; icon: React.ComponentType<{ size?: number; color?: string }>; subtext?: string }) => (
  <div className="bg-slate-800/80 backdrop-blur-sm p-3 rounded-lg border border-slate-700 flex flex-col items-center justify-center min-w-[100px] flex-1">
    <div className="flex items-center gap-2 mb-1">
      <Icon size={16} color={color} />
      <span className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider font-bold">{label}</span>
    </div>
    <span className="text-2xl font-mono font-bold" style={{ color }}>{value}</span>
    {subtext && <span className="text-[10px] text-slate-500">{subtext}</span>}
  </div>
);

// --- Main Application ---

export default function TcpVsUdpSimulator() {
  // State
  const [mode, setMode] = useState(MODES.TCP);
  const [isPlaying, setIsPlaying] = useState(false);
  const [packets, setPackets] = useState([]);
  const [stats, setStats] = useState({ sent: 0, received: 0, lost: 0, retransmits: 0 });
  const [logs, setLogs] = useState([]);
  const [connState, setConnState] = useState(CONNECTION_STATES.DISCONNECTED);
  const [educationalMessage, setEducationalMessage] = useState("");
  
  // Simulation Controls
  const [speed, setSpeed] = useState(50); // Speed of simulation tick
  const [packetLossChance, setPacketLossChance] = useState(0); // 0 to 100%
  const [jitter, setJitter] = useState(0); // Random movement noise
  
  // Refs
  const requestRef = useRef();
  const packetIdCounter = useRef(0);
  const tcpWindow = useRef(new Set()); // IDs of packets in flight for TCP
  const lastSpawnTime = useRef(0);
  const containerRef = useRef(null);

  // --- Logic Engines ---

  const logMessage = useCallback((msg: string, type = "info") => {
    setLogs(prev => {
      const newLogs = [{ id: Date.now() + Math.random(), text: msg, type }, ...prev];
      return newLogs.slice(0, 5); // Keep last 5
    });
  }, []);

  // Update educational text based on state
  useEffect(() => {
    if (!isPlaying && connState === CONNECTION_STATES.DISCONNECTED) {
        setEducationalMessage("Click 'Start' to begin. " + (mode === MODES.TCP ? "TCP will perform a handshake first." : "UDP will start streaming immediately."));
        return;
    }

    if (mode === MODES.UDP) {
        setEducationalMessage("UDP Mode: Packets are sent 'Fire and Forget'. No handshake, no delivery confirmation. Fast but unreliable.");
        return;
    }

    // TCP Messages
    switch (connState) {
        case CONNECTION_STATES.HANDSHAKE_SYN:
            setEducationalMessage("Step 1/3: Client sends SYN (Synchronize) to ask for a connection.");
            break;
        case CONNECTION_STATES.HANDSHAKE_SYN_ACK:
            setEducationalMessage("Step 2/3: Server replies with SYN-ACK (Synchronize + Acknowledge).");
            break;
        case CONNECTION_STATES.HANDSHAKE_ACK:
            setEducationalMessage("Step 3/3: Client sends final ACK. Connection is established!");
            break;
        case CONNECTION_STATES.CONNECTED:
            setEducationalMessage("Connection Established. Reliable Data Transfer in progress. Note the return receipts (ACKs).");
            break;
        default:
            break;
    }
  }, [connState, mode, isPlaying]);

  const spawnPacket = useCallback((typeOverride: string | null = null, statusOverride = "inflight") => {
    // Limits
    if (packets.length > 30) return; // Prevent overcrowding

    // TCP Window Control (Simple Stop-and-Wait / Small Window simulation)
    // Only apply window logic to DATA packets, not Handshake
    if (mode === MODES.TCP && !typeOverride && tcpWindow.current.size >= 3) return;

    packetIdCounter.current += 1;
    const id = packetIdCounter.current;
    
    let type = typeOverride || 'DATA';
    
    if (mode === MODES.TCP && type === 'DATA') {
      tcpWindow.current.add(id);
    }

    const newPacket = {
      id,
      x: 10, // Start Left
      y: 50, // Center Y
      type: type, // DATA, ACK, SYN, SYN-ACK
      status: statusOverride, 
      mode: mode,
      progress: type === 'SYN-ACK' ? 90 : 10, // SYN-ACK starts at right side
      retransmitted: false
    };

    setPackets(prev => [...prev, newPacket]);
    if (type === 'DATA') {
        setStats(prev => ({ ...prev, sent: prev.sent + 1 }));
    }
  }, [mode, packets.length]);

  const handleStartStop = () => {
      if (isPlaying) {
          setIsPlaying(false);
          // Don't reset connection state fully so we can resume data, 
          // but if we were handshaking, maybe pause? 
          // For simplicity, pause freezes everything in place.
      } else {
          setIsPlaying(true);
          // If we are disconnected, kick off the process
          if (connState === CONNECTION_STATES.DISCONNECTED) {
              if (mode === MODES.UDP) {
                  setConnState(CONNECTION_STATES.CONNECTED);
              } else {
                  // TCP Start Handshake
                  setConnState(CONNECTION_STATES.HANDSHAKE_SYN);
                  spawnPacket('SYN');
                  logMessage("Sending SYN...", 'syn');
              }
          }
      }
  };

  const updateSimulation = useCallback(() => {
    if (!isPlaying) return;

    setPackets(prevPackets => {
      let nextPackets = prevPackets.map(p => {
        // 1. Check for Loss (Random Event mid-flight)
        // Handshake packets are immune to loss in this basic educational demo to avoid frustration
        const isHandshake = ['SYN', 'SYN-ACK'].includes(p.type);
        
        if (!isHandshake && p.status === 'inflight' && p.progress > 20 && p.progress < 80) {
          const roll = Math.random() * 1000;
          if (roll < packetLossChance) {
             return { ...p, status: 'lost', progress: p.progress }; // Stop moving
          }
        }

        // 2. Movement Logic
        let moveSpeed = 0.5 + (speed / 100); 
        if (p.type === 'SYN' || p.type === 'SYN-ACK') moveSpeed *= 0.7; // Slow down handshake for visibility

        // Jitter
        let noiseY = 0;
        if (jitter > 0 && p.status === 'inflight') {
          noiseY = (Math.random() - 0.5) * (jitter / 10);
        }

        // Direction: DATA/SYN/ACK(final) go Right (1). SYN-ACK/ACK(return) go Left (-1).
        // Note: 'ACK' type is overloaded. 
        // In Handshake: Client->Server (Right). 
        // In Data Transfer: Server->Client (Left).
        let direction = 1; 
        if (p.type === 'SYN-ACK') direction = -1;
        if (p.type === 'ACK' && connState === CONNECTION_STATES.CONNECTED) direction = -1; // Data ACKs return
        if (p.type === 'ACK' && connState === CONNECTION_STATES.HANDSHAKE_ACK) direction = 1; // Handshake ACK goes forward

        let newProgress = p.progress + (moveSpeed * direction);
        let newY = p.y + noiseY;

        // Clamp Y
        if (newY < 30) newY = 30;
        if (newY > 70) newY = 70;

        // 3. Arrival Logic
        
        // --- Moving Right (Client -> Server) ---
        if (direction === 1 && p.status === 'inflight' && newProgress >= 90) {
            // Arrived at Server
            if (p.type === 'SYN') {
                logMessage("Server received SYN", 'syn');
                setConnState(CONNECTION_STATES.HANDSHAKE_SYN_ACK);
                // Trigger Server Response next tick (handled in effect or here? Let's do next tick via state)
                setTimeout(() => {
                    spawnPacket('SYN-ACK');
                    logMessage("Server sent SYN-ACK", 'syn');
                }, 500);
                return null;
            }
            else if (p.type === 'ACK' && connState === CONNECTION_STATES.HANDSHAKE_ACK) {
                logMessage("Server received ACK. Connection ESTABLISHED!", 'success');
                setConnState(CONNECTION_STATES.CONNECTED);
                return null;
            }
            else if (p.type === 'DATA') {
                if (p.mode === MODES.TCP) {
                    // TCP: Convert to ACK (Return receipt)
                    return { 
                    ...p, 
                    type: 'ACK', 
                    progress: 90, 
                    status: 'inflight',
                    y: newY 
                    };
                } else {
                    // UDP: Done
                    setStats(s => ({ ...s, received: s.received + 1 }));
                    return null; 
                }
            }
        }

        // --- Moving Left (Server -> Client) ---
        if (direction === -1 && p.status === 'inflight' && newProgress <= 10) {
            // Arrived at Client
            if (p.type === 'SYN-ACK') {
                logMessage("Client received SYN-ACK", 'syn');
                setConnState(CONNECTION_STATES.HANDSHAKE_ACK);
                setTimeout(() => {
                    spawnPacket('ACK'); // Final handshake ACK
                    logMessage("Client sent ACK", 'syn');
                }, 500);
                return null;
            }
            else if (p.type === 'ACK') {
                // Data ACK
                setStats(s => ({ ...s, received: s.received + 1 })); 
                tcpWindow.current.delete(p.id); 
                return null; 
            }
        }

        // Remove lost packets
        if (p.status === 'lost') {
            if (Math.random() > 0.95) return null;
            return p;
        }

        return { ...p, progress: newProgress, y: newY };

      }).filter(Boolean);

      return nextPackets;
    });

  }, [isPlaying, packetLossChance, speed, jitter, connState, mode, spawnPacket, logMessage]);

  // Game Loop
  useEffect(() => {
    let lastTime = performance.now();
    
    const animate = (time) => {
      const delta = time - lastTime;
      
      if (delta > 20) { 
        updateSimulation();
        
        // Spawn Control
        // Only spawn DATA if Connected
        if (connState === CONNECTION_STATES.CONNECTED && isPlaying) {
             const spawnRate = mode === MODES.UDP ? (1000 - (speed * 8)) : 600; 
             if (time - lastSpawnTime.current > Math.max(100, spawnRate)) {
               spawnPacket('DATA');
               lastSpawnTime.current = time;
             }
        }

        // TCP Retransmission Watcher (Simplified)
        if (mode === MODES.TCP && isPlaying && connState === CONNECTION_STATES.CONNECTED) {
             setPackets(prev => {
                 const lostPackets = prev.filter(p => p.status === 'lost' && !p.retransmitted && p.type === 'DATA');
                 if (lostPackets.length > 0) {
                     const lostP = lostPackets[0];
                     if (Math.random() > 0.92) { // Slightly slower retransmit check
                        logMessage(`Packet #${lostP.id} Lost. Retrying...`, 'error');
                        setStats(s => ({ ...s, retransmits: s.retransmits + 1 }));
                        
                        const remaining = prev.filter(p => p !== lostP);
                        return [...remaining, {
                             ...lostP,
                             status: 'inflight',
                             progress: 10,
                             retransmitted: true,
                             y: 50 
                        }];
                     }
                 }
                 return prev;
             })
        }

        lastTime = time;
      }
      requestRef.current = requestAnimationFrame(animate);
    };

    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    }

    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying, updateSimulation, mode, speed, spawnPacket, logMessage, connState]);

  // Reset
  const handleReset = () => {
    setPackets([]);
    setStats({ sent: 0, received: 0, lost: 0, retransmits: 0 });
    tcpWindow.current.clear();
    setLogs([]);
    setConnState(CONNECTION_STATES.DISCONNECTED);
    setIsPlaying(false);
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    handleReset();
    logMessage(`Switched to ${newMode} Protocol`);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Space to toggle play/pause
      if (e.key === ' ') {
        e.preventDefault();
        handleStartStop();
      }

      // R to reset
      if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleReset();
      }

      // M to toggle mode
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleModeChange(mode === MODES.TCP ? MODES.UDP : MODES.TCP);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, handleStartStop, handleReset, handleModeChange]);

  // --- Renderers ---

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans selection:bg-cyan-500/30">
      <div className="max-w-6xl mx-auto p-4 md:p-6 flex flex-col gap-6">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-700 pb-4">
          <div>
            <h1 className="text-3xl font-bold bg-linear-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
              Protocol Simulator
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
              Visualize the 3-Way Handshake and Reliability mechanisms.
            </p>
          </div>
          
          {/* Mode Switcher */}
          <div className="bg-slate-200 dark:bg-slate-800 p-1 rounded-lg flex gap-1">
            <button
              onClick={() => handleModeChange(MODES.TCP)}
              className={`px-4 py-2 rounded-md font-bold text-sm transition-all flex items-center gap-2 ${
                mode === MODES.TCP 
                  ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(8,145,178,0.5)]' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Shield size={16} /> TCP
            </button>
            <button
              onClick={() => handleModeChange(MODES.UDP)}
              className={`px-4 py-2 rounded-md font-bold text-sm transition-all flex items-center gap-2 ${
                mode === MODES.UDP 
                  ? 'bg-green-600 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)]' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Zap size={16} /> UDP
            </button>
          </div>
        </header>

        {/* Educational Banner */}
        <div className={`p-4 rounded-lg border flex items-start gap-3 transition-colors duration-500 ${
            mode === MODES.TCP ? 'bg-cyan-950/30 border-cyan-800' : 'bg-green-950/30 border-green-800'
        }`}>
            <div className={`p-2 rounded-full ${mode === MODES.TCP ? 'bg-cyan-500/20 text-cyan-400' : 'bg-green-500/20 text-green-400'}`}>
                <Info size={20} />
            </div>
            <div>
                <h3 className="font-bold text-sm uppercase tracking-wide mb-1">
                    {mode} Concept: {connState === CONNECTION_STATES.DISCONNECTED ? 'Idle' : connState.replace('HANDSHAKE_', 'Handshake: ')}
                </h3>
                <p className="text-sm text-slate-300">
                    {educationalMessage}
                </p>
            </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard 
            label="Sent" 
            value={stats.sent} 
            color={mode === MODES.TCP ? COLORS.tcp : COLORS.udp} 
            icon={Activity} 
          />
          <StatCard 
            label="Received" 
            value={stats.received} 
            color="#fff" 
            icon={Wifi} 
          />
          <StatCard 
            label="Loss Rate" 
            value={`${stats.sent > 0 ? ((stats.lost / stats.sent) * 100).toFixed(1) : 0}%`} 
            color={COLORS.loss} 
            icon={WifiOff} 
          />
          {mode === MODES.TCP && (
            <StatCard 
              label="Retries" 
              value={stats.retransmits} 
              color={COLORS.ack} 
              icon={RefreshCw} 
              subtext="Reliability Cost"
            />
          )}
          {mode === MODES.UDP && (
            <StatCard 
              label="Efficiency" 
              value="Max" 
              color={COLORS.udp} 
              icon={Zap} 
              subtext="No Overhead"
            />
          )}
        </div>

        {/* Main Simulation Canvas */}
        <div 
          className="relative w-full h-96 bg-slate-100 dark:bg-slate-950 rounded-xl border-2 border-slate-300 dark:border-slate-800 overflow-hidden shadow-2xl"
          ref={containerRef}
        >
          {/* Background Grid */}
          <div className="absolute inset-0 opacity-20" 
               style={{ 
                 backgroundImage: 'linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)', 
                 backgroundSize: '20px 20px' 
               }}>
          </div>

          {/* Connection Status Indicator */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
              <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 border ${
                  connState === CONNECTION_STATES.CONNECTED 
                    ? 'bg-green-500/20 text-green-400 border-green-500/50' 
                    : connState !== CONNECTION_STATES.DISCONNECTED
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                        : 'bg-slate-800 text-slate-500 border-slate-700'
              }`}>
                  {connState === CONNECTION_STATES.CONNECTED ? <Lock size={12} /> : <ArrowRightLeft size={12} />}
                  {connState.replace(/_/g, ' ')}
              </div>
          </div>

          {/* Client (Sender) */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center z-10">
            <div className={`w-16 h-16 rounded-lg flex items-center justify-center border-2 shadow-[0_0_20px_rgba(0,0,0,0.5)] transition-colors duration-300 ${
                mode === MODES.TCP ? 'border-cyan-500 bg-cyan-900/20' : 'border-green-500 bg-green-900/20'
            }`}>
              <div className="text-xs font-bold text-center">CLIENT<br/>(Sender)</div>
            </div>
          </div>

          {/* Server (Receiver) */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center z-10">
            <div className={`w-16 h-16 rounded-lg border-2 flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.5)] transition-colors duration-300 ${
                connState === CONNECTION_STATES.CONNECTED ? 'border-slate-900 dark:border-white bg-slate-100 dark:bg-slate-800' : 'border-slate-400 dark:border-slate-600 bg-slate-200 dark:bg-slate-900'
            }`}>
               <div className="text-xs font-bold text-center text-slate-700 dark:text-slate-400">SERVER<br/>(Receiver)</div>
            </div>
          </div>

          {/* Connection Line */}
          <div className="absolute top-1/2 left-20 right-20 h-1 bg-slate-800 -translate-y-1/2 rounded-full overflow-hidden">
             {/* Flow Animation */}
             <div className={`w-full h-full bg-linear-to-r from-transparent via-slate-700 to-transparent ${connState === CONNECTION_STATES.CONNECTED ? 'animate-pulse' : 'opacity-0'}`} />
          </div>

          {/* Packets Rendering */}
          {packets.map(p => {
             // Determine Color
             let bg = mode === MODES.TCP ? COLORS.tcp : COLORS.udp;
             if (p.type === 'ACK') bg = COLORS.ack; // Data ACK
             if (['SYN', 'SYN-ACK'].includes(p.type)) bg = COLORS.syn; // Handshake
             if (p.type === 'ACK' && connState !== CONNECTION_STATES.CONNECTED) bg = COLORS.syn; // Handshake ACK
             if (p.status === 'lost') bg = COLORS.loss;

             // Shape
             const isHandshake = ['SYN', 'SYN-ACK'].includes(p.type) || (p.type === 'ACK' && connState !== CONNECTION_STATES.CONNECTED);

             return (
               <div
                 key={p.id}
                 className="absolute flex items-center justify-center transition-transform"
                 style={{
                   left: `${p.progress}%`,
                   top: `${p.y}%`,
                   transform: `translate(-50%, -50%) ${p.status === 'lost' ? 'scale(1.5)' : 'scale(1)'}`,
                   opacity: p.status === 'lost' ? 0 : 1,
                   transition: p.status === 'lost' ? 'all 0.3s ease-out' : 'none',
                 }}
               >
                 <div 
                    className="shadow-lg flex items-center justify-center text-[8px] font-bold text-white overflow-hidden"
                    style={{
                        backgroundColor: bg,
                        width: isHandshake ? '32px' : '16px',
                        height: isHandshake ? '20px' : '16px',
                        borderRadius: isHandshake ? '4px' : (p.type === 'ACK' ? '50%' : '2px'),
                        boxShadow: `0 0 10px ${bg}`
                    }}
                 >
                    {isHandshake ? p.type : ''}
                    {p.status === 'lost' && 'X'}
                 </div>
               </div>
             );
          })}

          {/* Start Overlay */}
          {!isPlaying && packets.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] z-30">
              <div className="text-center">
                <p className="text-slate-700 dark:text-slate-300 mb-2">Ready to simulate</p>
                <button 
                  onClick={handleStartStop}
                  className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-2 rounded-full font-bold hover:scale-105 transition-transform flex items-center gap-2 mx-auto"
                >
                  <Play size={18} fill="currentColor" /> Start Traffic
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Controls Panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Playback Controls */}
            <div className="bg-slate-200 dark:bg-slate-800 rounded-xl p-4 border border-slate-300 dark:border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Simulation Control</h3>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleStartStop}
                            className={`p-2 rounded-full ${isPlaying ? 'bg-amber-500/20 text-amber-500' : 'bg-green-500/20 text-green-500'} hover:bg-white/10 transition-colors`}
                        >
                            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                        </button>
                        <button 
                            onClick={handleReset}
                            className="p-2 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-400 dark:hover:bg-slate-600 transition-colors"
                        >
                            <RefreshCw size={20} />
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                     {/* Speed Slider */}
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span>Traffic Speed</span>
                            <span className="text-cyan-400">{speed}%</span>
                        </div>
                        <input 
                            type="range" min="10" max="100" value={speed} 
                            onChange={(e) => setSpeed(Number(e.target.value))}
                            className="w-full h-2 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                    </div>
                </div>
            </div>

            {/* Chaos Controls */}
            <div className="bg-slate-200 dark:bg-slate-800 rounded-xl p-4 border border-slate-300 dark:border-slate-700 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
                    <AlertTriangle size={100} />
                </div>
                <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <AlertTriangle size={16} /> Network Conditions
                </h3>
                
                <div className="space-y-4 relative z-10">
                    {/* Loss Slider */}
                    <div>
                         <div className="flex justify-between text-xs mb-1">
                            <span className="flex items-center gap-1">Packet Loss <Tooltip text="Randomly destroys packets in transit."><Info size={12} className="text-slate-500"/></Tooltip></span>
                            <span className="text-red-400">{packetLossChance / 10}%</span>
                        </div>
                        <input 
                            type="range" min="0" max="50" value={packetLossChance} 
                            onChange={(e) => setPacketLossChance(Number(e.target.value))}
                            className="w-full h-2 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                        />
                    </div>

                    {/* Jitter Slider */}
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="flex items-center gap-1">Jitter (Instability) <Tooltip text="Adds random variance to packet timing and path."><Info size={12} className="text-slate-500"/></Tooltip></span>
                            <span className="text-amber-400">{jitter}%</span>
                        </div>
                        <input 
                            type="range" min="0" max="100" value={jitter} 
                            onChange={(e) => setJitter(Number(e.target.value))}
                            className="w-full h-2 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                    </div>
                </div>
            </div>
        </div>

        {/* Live Logs */}
        <div className="bg-black/50 rounded-lg p-4 font-mono text-xs h-32 overflow-hidden border border-slate-800">
             <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-1">
                 <span className="text-slate-500">SYSTEM LOG</span>
                 <span className="text-slate-600">LIVE</span>
             </div>
             <div className="flex flex-col-reverse gap-1">
                {logs.length === 0 && <span className="text-slate-700 italic">Waiting for traffic...</span>}
                {logs.map(log => (
                    <div key={log.id} className={`${log.type === 'error' ? 'text-red-400' : log.type === 'syn' ? 'text-fuchsia-400' : 'text-slate-300'} animate-in fade-in slide-in-from-left-4`}>
                        <span className="text-slate-600 mr-2">[{new Date(log.id).toLocaleTimeString().split(' ')[0]}]</span>
                        {log.text}
                    </div>
                ))}
             </div>
        </div>

        {/* Educational Footer */}
        <div className="text-center mt-4">
             <p className="text-slate-600 dark:text-slate-500 text-sm">
                 Experiment by increasing "Packet Loss" to see how TCP retries vs UDP just loses data.
             </p>
             {/* Keyboard shortcuts hint */}
             <p className="hidden sm:flex items-center justify-center gap-2 text-xs opacity-70 mt-2">
               <Keyboard className="h-3 w-3" />
               <span>Space play/pause · M toggle mode · R reset</span>
             </p>
        </div>

      </div>
    </div>
  );
}
