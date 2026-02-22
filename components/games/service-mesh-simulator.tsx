'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Network, Play, Pause, RotateCcw, Lock, Shield, Check, X, RefreshCw, Info, ChevronRight, ChevronLeft } from 'lucide-react';

interface Tutorial {
  id: string;
  title: string;
  description: string;
  explanation: string;
  features: string[];
  visualizationType: 'basic' | 'mtls' | 'traffic-split' | 'circuit-breaker' | 'retry';
}

const TUTORIALS: Tutorial[] = [
    {
      id: 'intro',
      title: '1️⃣ What is a Service Mesh?',
      description: 'See how services normally talk to each other',
      explanation:
        "Without a service mesh, your services talk directly. It's like having a phone conversation without caller ID or security - you're not sure who's calling or if anyone is listening in.",
      features: ['Direct service-to-service communication', 'No built-in security or monitoring', 'Hard to control traffic'],
      visualizationType: 'basic',
    },
    {
      id: 'sidecar',
      title: '2️⃣ Enter the Sidecar Proxy',
      description: 'A tiny helper that sits next to each service',
      explanation:
        "A service mesh adds a 'sidecar proxy' next to every service. Think of it like a personal assistant for each service - it handles all phone calls (network traffic) on their behalf.",
      features: [
        'Sidecar proxy intercepts all traffic',
        'Your service code never changes',
        'The proxy handles security & reliability',
      ],
      visualizationType: 'basic',
    },
    {
      id: 'mtls',
      title: '3️⃣ Automatic Encryption (mTLS)',
      description: 'All traffic is encrypted - no code changes needed!',
      explanation:
        "The sidecars automatically encrypt all messages between services using mTLS (mutual TLS). It's like sealing every letter in an envelope with a tamper-proof seal. Both sender and receiver verify each other's identity.",
      features: [
       'Every request is encrypted',
        "Services verify each other's identity",
       'Zero code changes required',
      ],
      visualizationType: 'mtls',
    },
    {
      id: 'traffic-split',
      title: '4️⃣ Smart Traffic Routing',
      description: 'Test new versions safely by sending just 10% of traffic',
      explanation:
        "Want to test a new version? The mesh can send 90% of traffic to the old version and 10% to the new one. If the new version has bugs, only 10% of users are affected. This is called a 'canary deployment'.",
      features: [
        'Send small % of traffic to new version',
        'Test in production safely',
        'Roll back instantly if needed',
      ],
      visualizationType: 'traffic-split',
    },
    {
      id: 'retry',
      title: '5️⃣ Automatic Retries',
      description: 'Failed requests? The mesh retries them for you',
      explanation:
        "Networks are unreliable. The sidecar can automatically retry failed requests (with smart delays to avoid overwhelming the service). Your code doesn't need to handle retries - the mesh does it.",
      features: ['Auto-retry failed requests', 'Smart delays between retries', 'Prevents retry storms'],
      visualizationType: 'retry',
    },
    {
      id: 'circuit-breaker',
      title: '6️⃣ Circuit Breaker Protection',
      description: 'Stop hitting a failing service - give it time to recover',
      explanation:
        "If a service keeps failing, the circuit breaker 'trips' and stops sending requests to it temporarily. It's like a home circuit breaker - when there's a problem, it cuts the power to prevent damage. After a cooldown, it tries again.",
      features: [
        'Stops requests to failing services',
        'Gives services time to recover',
        'Prevents cascading failures',
      ],
      visualizationType: 'circuit-breaker',
    },
  ];

export default function ServiceMeshSimulator() {
 const [isPlaying, setIsPlaying] = useState(false);
 const [currentTutorial, setCurrentTutorial] = useState(0);
 const [requestAnimation, setRequestAnimation] = useState(0);

  // Keyboard navigation
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          if (currentTutorial > 0) {
            setCurrentTutorial(currentTutorial - 1);
            setIsPlaying(false);
          }
          break;
        case 'ArrowRight':
          if (currentTutorial < TUTORIALS.length - 1) {
            setCurrentTutorial(currentTutorial + 1);
            setIsPlaying(false);
          }
          break;
        case ' ':
        case 'Enter':
          e.preventDefault();
          setIsPlaying(!isPlaying);
          break;
        case 'r':
        case 'R':
          handleReset();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentTutorial, isPlaying]);


  const currentTutorialData = TUTORIALS[currentTutorial];

  // Animation effect
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setRequestAnimation((prev) => (prev + 1) % 100);
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Tutorial step progression
  useEffect(() => {
    setRequestAnimation(0);
  }, [currentTutorial]);

  const handleReset = () => {
    setIsPlaying(false);
    setRequestAnimation(0);
  };

  const handleNext = () => {
    if (currentTutorial < TUTORIALS.length - 1) {
      setCurrentTutorial(currentTutorial + 1);
      setIsPlaying(false);
    }
  };

  const handlePrevious = () => {
    if (currentTutorial > 0) {
      setCurrentTutorial(currentTutorial - 1);
      setIsPlaying(false);
    }
  };

  // Render visualization based on tutorial type
  const renderVisualization = () => {
    const progress = (requestAnimation % 100) / 100;

    switch (currentTutorialData.visualizationType) {
      case 'basic':
        return (
          <div className="relative w-full h-full flex flex-col md:flex-row items-center justify-center gap-8 p-8">
            {/* Service A */}
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 bg-blue-500/20 border-2 border-blue-500 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="font-bold">Service A</div>
                  <div className="text-xs opacity-70">Frontend</div>
                </div>
              </div>
              {currentTutorial >= 1 && (
                <div className="mt-3 flex items-center gap-1 text-sm text-purple-600">
                  <Shield className="w-4 h-4" />
                  <span className="font-semibold">Sidecar</span>
                </div>
              )}
            </div>

            {/* Arrow with animated dot */}
            <div className="relative flex items-center">
              <div className="w-32 h-0.5 bg-gray-300 dark:bg-gray-700" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[10px] border-l-gray-300 dark:border-l-gray-700" />
              {isPlaying && (
                <div
                  className="absolute w-4 h-4 bg-blue-500 rounded-full shadow-lg"
                  style={{ left: `${progress * 85}%`, transition: 'left 0.05s linear' }}
                />
              )}
            </div>

            {/* Service B */}
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 bg-green-500/20 border-2 border-green-500 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="font-bold">Service B</div>
                  <div className="text-xs opacity-70">API</div>
                </div>
              </div>
              {currentTutorial >= 1 && (
                <div className="mt-3 flex items-center gap-1 text-sm text-purple-600">
                  <Shield className="w-4 h-4" />
                  <span className="font-semibold">Sidecar</span>
                </div>
              )}
            </div>
          </div>
        );

      case 'mtls':
        return (
          <div className="relative w-full h-full flex flex-col md:flex-row items-center justify-center gap-8 p-8">
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 bg-blue-500/20 border-2 border-blue-500 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="font-bold">Service A</div>
                  <div className="text-xs opacity-70">Frontend</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-sm text-purple-600">
                <Shield className="w-4 h-4" />
                <span className="font-semibold">Sidecar</span>
              </div>
            </div>

            <div className="relative flex flex-col items-center">
              <div className="w-32 h-0.5 bg-gray-300 dark:bg-gray-700" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[10px] border-l-gray-300 dark:border-l-gray-700" />
              {isPlaying && (
                <div
                  className="absolute top-0 flex items-center gap-2"
                  style={{ left: `${progress * 85}%`, transition: 'left 0.05s linear' }}
                >
                  <Lock className="w-5 h-5 text-yellow-500" />
                  <div className="w-3 h-3 bg-blue-500 rounded-full shadow-lg" />
                </div>
              )}
              <div className="mt-6 text-sm text-yellow-600 font-semibold whitespace-nowrap flex items-center gap-1">
                <Lock className="w-4 h-4" />
                Encrypted with mTLS
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-32 h-32 bg-green-500/20 border-2 border-green-500 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="font-bold">Service B</div>
                  <div className="text-xs opacity-70">API</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-sm text-purple-600">
                <Shield className="w-4 h-4" />
                <span className="font-semibold">Sidecar</span>
              </div>
            </div>
          </div>
        );

      case 'traffic-split':
        return (
          <div className="relative w-full h-full flex flex-col md:flex-row items-center justify-center gap-8 p-8">
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 bg-blue-500/20 border-2 border-blue-500 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="font-bold">Service A</div>
                  <div className="text-xs opacity-70">Frontend</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-sm text-purple-600">
                <Shield className="w-4 h-4" />
                <span className="font-semibold">Sidecar</span>
              </div>
            </div>

           <div className="relative flex flex-col gap-12 mx-4">
             {/* Top path (90%) */}
             <div className="relative flex flex-col items-center">
                <div className="relative w-32 h-0.5 bg-green-400">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[10px] border-l-green-400" />
                </div>
               {isPlaying && Math.random() > 0.1 && (
                  <div
                    className="absolute top-0 w-3 h-3 bg-green-500 rounded-full shadow-lg"
                    style={{ left: `${progress * 85}%`, transition: 'left 0.05s linear' }}
                  />
                )}
                <div className="mt-2 text-sm text-green-600 font-semibold">
                  90% of traffic → old version
                </div>
              </div>

             {/* Bottom path (10%) */}
             <div className="relative flex flex-col items-center">
                <div className="relative w-32 h-0.5 bg-orange-400">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[10px] border-l-orange-400" />
                </div>
               {isPlaying && Math.random() < 0.1 && (
                  <div
                    className="absolute top-0 w-3 h-3 bg-orange-500 rounded-full shadow-lg"
                    style={{ left: `${progress * 85}%`, transition: 'left 0.05s linear' }}
                  />
                )}
                <div className="mt-2 text-sm text-orange-600 font-semibold">
                  10% of traffic → new version (testing)
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-12">
              <div className="flex flex-col items-center">
                <div className="w-32 h-32 bg-green-500/20 border-2 border-green-500 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <div className="font-bold">API v1</div>
                    <div className="text-xs opacity-70">Old Stable</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1 text-sm text-purple-600">
                  <Shield className="w-4 h-4" />
                  <span className="font-semibold">Sidecar</span>
                </div>
              </div>

              <div className="flex flex-col items-center">
                <div className="w-32 h-32 bg-orange-500/20 border-2 border-orange-500 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <div className="font-bold">API v2</div>
                    <div className="text-xs opacity-70">New Test</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1 text-sm text-purple-600">
                  <Shield className="w-4 h-4" />
                  <span className="font-semibold">Sidecar</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'retry':
        return (
          <div className="relative w-full h-full flex flex-col md:flex-row items-center justify-center gap-8 p-8">
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 bg-blue-500/20 border-2 border-blue-500 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="font-bold">Service A</div>
                  <div className="text-xs opacity-70">Frontend</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-sm text-purple-600">
                <Shield className="w-4 h-4" />
                <span className="font-semibold">Sidecar</span>
              </div>
            </div>

            <div className="relative flex flex-col items-center gap-4 mx-4">
             {/* First attempt */}
             <div className="relative flex flex-col items-center">
                <div className="relative w-32 h-0.5 bg-red-400">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[10px] border-l-red-400" />
                </div>
               {isPlaying && progress < 0.33 && (
                  <div
                    className="absolute top-0 w-3 h-3 bg-red-500 rounded-full shadow-lg"
                    style={{ left: `${(progress / 0.33) * 85}%`, transition: 'left 0.05s linear' }}
                  />
                )}
                <div className="absolute -right-6 top-0 flex items-center gap-1">
                  <X className="w-5 h-5 text-red-500" />
                </div>
                <div className="mt-2 text-sm text-red-600 font-semibold">1st attempt failed ❌</div>
              </div>

              {/* Retry indicator */}
              {isPlaying && progress > 0.33 && progress < 0.38 && (
                <div className="text-sm text-orange-600 font-semibold flex items-center gap-2 py-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Automatically retrying...
                </div>
              )}

             {/* Second attempt */}
             <div className="relative flex flex-col items-center">
                <div className="relative w-32 h-0.5 bg-green-400">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[10px] border-l-green-400" />
                </div>
               {isPlaying && progress >= 0.38 && (
                  <div
                    className="absolute top-0 w-3 h-3 bg-green-500 rounded-full shadow-lg"
                    style={{ left: `${((progress - 0.38) / 0.62) * 85}%`, transition: 'left 0.05s linear' }}
                  />
                )}
                <div className="absolute -right-6 top-0 flex items-center gap-1">
                  <Check className="w-5 h-5 text-green-500" />
                </div>
                <div className="mt-2 text-sm text-green-600 font-semibold">2nd attempt succeeded ✅</div>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-32 h-32 bg-green-500/20 border-2 border-green-500 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="font-bold">Service B</div>
                  <div className="text-xs opacity-70">API</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-sm text-purple-600">
                <Shield className="w-4 h-4" />
                <span className="font-semibold">Sidecar</span>
              </div>
            </div>
          </div>
        );

      case 'circuit-breaker':
        return (
          <div className="relative w-full h-full flex flex-col md:flex-row items-center justify-center gap-8 p-8">
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 bg-blue-500/20 border-2 border-blue-500 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="font-bold">Service A</div>
                  <div className="text-xs opacity-70">Frontend</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-sm text-purple-600">
                <Shield className="w-4 h-4" />
                <span className="font-semibold">Sidecar</span>
              </div>
            </div>

            <div className="relative flex flex-col items-center mx-4">
              <div className="w-32 h-0.5 bg-gray-400" />
              <div className="absolute left-1/2 top-0 transform -translate-x-1/2 -translate-y-1/2">
                <div className="w-12 h-16 bg-red-500/20 border-2 border-red-500 rounded flex items-center justify-center">
                  <X className="w-7 h-7 text-red-500" />
                </div>
                <div className="mt-1 text-xs text-red-600 font-bold text-center">OPEN</div>
              </div>
              {isPlaying && (
                <div
                  className="absolute top-0 w-3 h-3 bg-gray-500 rounded-full shadow-lg"
                  style={{
                    left: progress < 0.5 ? `${progress * 170}%` : '42%',
                    transition: 'left 0.05s linear',
                  }}
                />
              )}
              <div className="mt-20 text-sm text-red-600 font-semibold whitespace-nowrap flex items-center gap-1">
                ⚡ Request blocked by circuit breaker
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-32 h-32 bg-red-500/20 border-2 border-red-500 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="font-bold">Service B</div>
                  <div className="text-xs opacity-70">⚠️ Failing</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-sm text-purple-600">
                <Shield className="w-4 h-4" />
                <span className="font-semibold">Sidecar</span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-5xl">
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Network className="w-8 h-8 text-blue-500" />
            <div>
              <CardTitle className="text-2xl">Service Mesh Traffic Simulator</CardTitle>
              <CardDescription>Learn how service meshes work, step-by-step</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Tutorial Title */}
          <div className="space-y-2">
            <h3 className="text-xl font-bold">{currentTutorialData.title}</h3>
            <p className="text-sm text-muted-foreground">{currentTutorialData.description}</p>
          </div>

          {/* Visualization Area */}
          <div className="border rounded-lg bg-muted/10 min-h-[400px] flex items-center justify-center">
            {renderVisualization()}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setIsPlaying(!isPlaying)} size="default">
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Play Animation
                </>
              )}
            </Button>
            <Button onClick={handleReset} variant="outline" size="default">
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>

            <div className="flex-1" />

            <Button onClick={handlePrevious} disabled={currentTutorial === 0} variant="outline" size="default">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
            <Badge variant="outline" className="px-3 py-1">
              {currentTutorial + 1} / {TUTORIALS.length}
            </Badge>
            <Button onClick={handleNext} disabled={currentTutorial === TUTORIALS.length - 1} variant="outline" size="default">
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {/* Explanation Section */}
          <Alert>
            <Info className="w-4 h-4" />
            <AlertDescription>
              <div className="space-y-3">
                <p className="text-sm">{currentTutorialData.explanation}</p>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Key Benefits:</p>
                  <ul className="text-sm space-y-1 ml-4">
                    {currentTutorialData.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
           </AlertDescription>
         </Alert>

          {/* Keyboard Shortcuts */}
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p className="font-medium mb-2">Keyboard Shortcuts:</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span><kbd className="px-2 py-1 bg-background rounded text-xs">Space/Enter</kbd> Play/Pause</span>
              <span><kbd className="px-2 py-1 bg-background rounded text-xs">←/→</kbd> Navigate Steps</span>
              <span><kbd className="px-2 py-1 bg-background rounded text-xs">R</kbd> Reset</span>
            </div>
          </div>
       </CardContent>
     </Card>
    </div>
  );
}
