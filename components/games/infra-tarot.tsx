'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Share2,
  RotateCcw,
  Sparkles,
  Zap,
  AlertTriangle,
  DollarSign,
  CloudLightning,
  GitMerge,
  ServerCrash,
  Timer,
  Shield,
  Database,
  Network,
  HardDrive,
  Activity,
  Gauge,
  Settings,
  Lock,
  Wifi,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TarotCard {
  id: string;
  name: string;
  icon: React.ReactNode;
  meaning: string;
  description: string;
  color: string;
  gradient: string;
}

const TAROT_CARDS: TarotCard[] = [
  {
    id: 'outage',
    name: 'The Outage',
    icon: <ServerCrash className="h-8 w-8" />,
    meaning: 'Unexpected downtime approaches',
    description:
      'A critical service disruption looms in your infrastructure future. Prepare your incident response.',
    color: 'text-red-600',
    gradient: 'from-red-500 to-red-700',
  },
  {
    id: 'sidecar',
    name: 'The Sidecar',
    icon: <GitMerge className="h-8 w-8" />,
    meaning: 'Microservices harmony awaits',
    description: 'A companion service will bring balance to your application architecture.',
    color: 'text-blue-600',
    gradient: 'from-blue-500 to-blue-700',
  },
  {
    id: 'budget-cut',
    name: 'The Budget Cut',
    icon: <DollarSign className="h-8 w-8" />,
    meaning: 'Financial optimization required',
    description:
      'Resource constraints will force innovative solutions and cost-effective thinking.',
    color: 'text-yellow-600',
    gradient: 'from-yellow-500 to-orange-600',
  },
  {
    id: 'autoscaler',
    name: 'The Autoscaler',
    icon: <Activity className="h-8 w-8" />,
    meaning: 'Dynamic scaling energy flows',
    description:
      'Your infrastructure will adapt and grow automatically, bringing elasticity to your systems.',
    color: 'text-green-600',
    gradient: 'from-green-500 to-emerald-600',
  },
  {
    id: 'security-breach',
    name: 'The Security Breach',
    icon: <Shield className="h-8 w-8" />,
    meaning: 'Vigilance and protection needed',
    description:
      'A security challenge will test your defenses and strengthen your security posture.',
    color: 'text-purple-600',
    gradient: 'from-purple-500 to-purple-700',
  },
  {
    id: 'database-lock',
    name: 'The Database Lock',
    icon: <Database className="h-8 w-8" />,
    meaning: 'Data conflicts arise',
    description:
      'Concurrent operations will challenge your transaction management and require careful coordination.',
    color: 'text-indigo-600',
    gradient: 'from-indigo-500 to-indigo-700',
  },
  {
    id: 'network-partition',
    name: 'The Network Partition',
    icon: <Network className="h-8 w-8" />,
    meaning: 'Connectivity challenges ahead',
    description: 'Network splits will test your distributed systems design and fault tolerance.',
    color: 'text-cyan-600',
    gradient: 'from-cyan-500 to-cyan-700',
  },
  {
    id: 'disk-full',
    name: 'The Disk Full',
    icon: <HardDrive className="h-8 w-8" />,
    meaning: 'Storage limitations emerge',
    description: 'Capacity planning becomes crucial as your storage resources reach their limits.',
    color: 'text-pink-600',
    gradient: 'from-pink-500 to-rose-600',
  },
  {
    id: 'memory-leak',
    name: 'The Memory Leak',
    icon: <Gauge className="h-8 w-8" />,
    meaning: 'Resource consumption grows',
    description: 'Gradual resource drain will require monitoring and optimization vigilance.',
    color: 'text-orange-600',
    gradient: 'from-orange-500 to-red-600',
  },
  {
    id: 'config-drift',
    name: 'The Config Drift',
    icon: <Settings className="h-8 w-8" />,
    meaning: 'Configuration chaos looms',
    description:
      'Your infrastructure will diverge from desired state, requiring configuration management.',
    color: 'text-teal-600',
    gradient: 'from-teal-500 to-teal-700',
  },
  {
    id: 'cert-expiry',
    name: 'The Cert Expiry',
    icon: <Lock className="h-8 w-8" />,
    meaning: 'Security renewal required',
    description: 'Certificate lifecycle management becomes critical as expiration dates approach.',
    color: 'text-red-600',
    gradient: 'from-red-500 to-pink-600',
  },
  {
    id: 'api-timeout',
    name: 'The API Timeout',
    icon: <Timer className="h-8 w-8" />,
    meaning: 'Response delays manifest',
    description:
      'Service latency will challenge your timeout strategies and circuit breaker patterns.',
    color: 'text-amber-600',
    gradient: 'from-amber-500 to-orange-600',
  },
  {
    id: 'load-spike',
    name: 'The Load Spike',
    icon: <Zap className="h-8 w-8" />,
    meaning: 'Traffic surge incoming',
    description:
      'Unexpected high demand will test your capacity planning and performance optimization.',
    color: 'text-yellow-600',
    gradient: 'from-yellow-400 to-yellow-600',
  },
  {
    id: 'dependency-hell',
    name: 'The Dependency Hell',
    icon: <AlertTriangle className="h-8 w-8" />,
    meaning: 'Version conflicts arise',
    description:
      'Package dependencies will create conflicts requiring careful resolution and management.',
    color: 'text-red-600',
    gradient: 'from-red-600 to-red-800',
  },
  {
    id: 'cloud-migration',
    name: 'The Cloud Migration',
    icon: <CloudLightning className="h-8 w-8" />,
    meaning: 'Transformation journey begins',
    description:
      'A major platform shift will bring both challenges and opportunities for modernization.',
    color: 'text-blue-600',
    gradient: 'from-blue-400 to-purple-600',
  },
  {
    id: 'dns-outage',
    name: 'The DNS Outage',
    icon: <Wifi className="h-8 w-8" />,
    meaning: 'Name resolution fails',
    description:
      'Domain resolution issues will remind you that DNS is the foundation of everything.',
    color: 'text-gray-600',
    gradient: 'from-gray-500 to-gray-700',
  },
];

const MYSTICAL_READINGS = [
  'Mercury in retrograde suggests a node pool autoscaling bug is on your horizon.',
  'The stars align with your Kubernetes clusters, but beware of resource quotas in the third house.',
  'Venus is ascending through your CI/CD pipeline, bringing harmony to your deployment strategies.',
  "Jupiter's influence strengthens your monitoring dashboards, revealing hidden performance insights.",
  'Mars in your infrastructure suggests aggressive optimization opportunities ahead.',
  "The moon's phases mirror your backup cycles - ensure your disaster recovery is in sync.",
  "Saturn's rings remind you that circular dependencies will challenge your microservices.",
  "Neptune's depths reflect the mysteries of your legacy database schemas.",
  'Uranus brings unexpected innovation to your containerization efforts.',
  "Pluto's transformation energy indicates a major architectural refactoring in your future.",
  'The cosmic alignment favors infrastructure as code - your Terraform will flourish.',
  'Celestial bodies suggest your API gateway will become the center of your digital universe.',
  'The constellation of microservices points to service mesh adoption in your near future.',
  'Solar flares indicate potential electromagnetic interference with your cloud deployments.',
  'The gravitational pull of technical debt will require careful orbital adjustments.',
];

export default function InfraTarot() {
  const [selectedCards, setSelectedCards] = useState<TarotCard[]>([]);
  const [reading, setReading] = useState<string>('');
  const [isRevealing, setIsRevealing] = useState(false);
  const [cardFlips, setCardFlips] = useState<boolean[]>([]);

  const drawCards = () => {
    setIsRevealing(true);
    setCardFlips([]);

    // Select 3 random cards
    const shuffled = [...TAROT_CARDS].sort(() => Math.random() - 0.5);
    const drawn = shuffled.slice(0, 3);

    // Select random mystical reading
    const randomReading = MYSTICAL_READINGS[Math.floor(Math.random() * MYSTICAL_READINGS.length)];

    setTimeout(() => {
      setSelectedCards(drawn);
      setReading(randomReading);
      setCardFlips([false, false, false]);
      setIsRevealing(false);
    }, 1000);
  };

  const flipCard = (index: number) => {
    setCardFlips((prev) => {
      const newFlips = [...prev];
      newFlips[index] = true;
      return newFlips;
    });
  };

  const reset = () => {
    setSelectedCards([]);
    setReading('');
    setCardFlips([]);
    setIsRevealing(false);
  };

  const shareReading = () => {
    const cardNames = selectedCards.map((card) => card.name).join(', ');
    const shareText = `I just drew ${cardNames} in the Infra Tarot! 🔮\n\nMy reading: "${reading}"\n\nDiscover yours!`;

    // Create Twitter share URL
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(window.location.href)}`;

    // Open Twitter in a new window/tab
    window.open(twitterUrl, '_blank', 'width=550,height=400');
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-8 relative overflow-hidden">
      {/* Floating mystical particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            style={{
              position: 'absolute',
              width: '8px',
              height: '8px',
              background: 'rgba(147, 51, 234, 0.3)',
              borderRadius: '50%',
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [-20, -100, -20],
              x: [0, Math.random() * 50 - 25, 0],
              opacity: [0, 0.7, 0],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 4 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: 'easeInOut',
            }}
          />
        ))}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={`star-${i}`}
            style={{
              position: 'absolute',
              color: 'rgba(251, 191, 36, 0.4)',
              fontSize: '18px',
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              rotate: [0, 360],
              opacity: [0.2, 0.8, 0.2],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 6 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 3,
              ease: 'easeInOut',
            }}
          >
            ✦
          </motion.div>
        ))}
      </div>
      {/* Header */}
      <div className="text-center space-y-6">
        <div className="relative">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(to right, rgba(147, 51, 234, 0.2), rgba(37, 99, 235, 0.2))',
                filter: 'blur(48px)',
                borderRadius: '9999px',
              }}
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <div className="relative flex items-center justify-center gap-3 mb-6">
              <motion.div
                animate={{
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <Sparkles className="h-12 w-12 text-purple-600 drop-shadow-lg" />
              </motion.div>
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <h1 className="text-5xl md:text-7xl font-bold bg-linear-to-r from-purple-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent drop-shadow-sm">
                  Infra Tarot
                </h1>
              </motion.div>
              <motion.div
                animate={{
                  rotate: [0, -10, 10, 0],
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: 1,
                }}
              >
                <Sparkles className="h-12 w-12 text-blue-600 drop-shadow-lg" />
              </motion.div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          <p className="text-xl md:text-2xl text-muted-foreground max-w-4xl mx-auto leading-relaxed font-medium">
            🔮 Peer into the mystical realm of infrastructure! Draw 3 enchanted cards to unveil the
            cosmic secrets of your DevOps destiny. ✨
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          <Badge
            variant="secondary"
            className="text-sm px-6 py-3 bg-linear-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 border-purple-200 dark:border-purple-700 shadow-lg"
          >
            🎭 For entertainment purposes only (your prod environment is still your responsibility)
          </Badge>
        </motion.div>
      </div>

      {/* Main Action */}
      <div className="flex justify-center">
        {selectedCards.length === 0 ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              onClick={drawCards}
              disabled={isRevealing}
              size="lg"
              className="bg-linear-to-r from-purple-600 via-purple-700 to-blue-600 hover:from-purple-700 hover:via-purple-800 hover:to-blue-700 text-white px-10 py-6 text-xl font-semibold shadow-2xl hover:shadow-purple-500/25 transition-all duration-300"
            >
              {isRevealing ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Sparkles className="h-6 w-6 mr-3" />
                  </motion.div>
                  Consulting the DevOps Oracle...
                </>
              ) : (
                <>
                  <Sparkles className="h-6 w-6 mr-3" />
                  Draw 3 Mystical Cards
                </>
              )}
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex gap-4">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={reset}
                  variant="outline"
                  size="lg"
                  className="px-6 py-3 text-lg shadow-lg"
                >
                  <RotateCcw className="h-5 w-5 mr-2" />
                  Draw Again
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button onClick={shareReading} size="lg" className="px-6 py-3 text-lg shadow-lg">
                  <Share2 className="h-5 w-5 mr-2" />
                  Share Reading
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Cards Display */}
      <AnimatePresence>
        {selectedCards.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.5 }}
          >
            <div className="space-y-8">
              {/* Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {selectedCards.map((card, index) => (
                  <motion.div
                    key={card.id}
                    initial={{ y: 100, opacity: 0, rotateY: 180 }}
                    animate={{ y: 0, opacity: 1, rotateY: 0 }}
                    transition={{
                      delay: index * 0.3,
                      duration: 0.8,
                      type: 'spring',
                      stiffness: 100,
                    }}
                    whileHover={{ y: -10, scale: 1.02 }}
                    style={{ perspective: '1000px' }}
                  >
                    <Card
                      className={cn(
                        'cursor-pointer transform transition-all duration-500 relative overflow-hidden',
                        'bg-linear-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800',
                        'border-2 shadow-xl hover:shadow-2xl',
                        cardFlips[index]
                          ? 'shadow-2xl border-purple-200 dark:border-purple-700'
                          : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600'
                      )}
                      onClick={() => !cardFlips[index] && flipCard(index)}
                    >
                      {/* Gradient overlay for flipped cards */}
                      {cardFlips[index] && (
                        <div
                          className="absolute inset-0 opacity-5"
                          style={{
                            background: `linear-gradient(135deg, ${card.gradient.replace('from-', '').replace('to-', '').split(' ').join(', ')})`,
                          }}
                        />
                      )}

                      {!cardFlips[index] ? (
                        // Card Back - Enhanced Design
                        <div className="relative h-96 flex items-center justify-center bg-linear-to-br from-purple-900 via-purple-800 to-blue-900 overflow-hidden">
                          {/* Mystical background pattern */}
                          <div className="absolute inset-0 opacity-20">
                            <div className="absolute top-4 left-4 text-purple-300">✦</div>
                            <div className="absolute top-8 right-6 text-blue-300">✧</div>
                            <div className="absolute bottom-6 left-6 text-purple-300">✦</div>
                            <div className="absolute bottom-4 right-4 text-blue-300">✧</div>
                            <div className="absolute top-1/2 left-1/4 text-purple-300">✦</div>
                            <div className="absolute top-1/3 right-1/4 text-blue-300">✧</div>
                          </div>

                          <div className="text-center text-white z-10">
                            <motion.div
                              animate={{
                                rotate: [0, 360],
                                scale: [1, 1.1, 1],
                              }}
                              transition={{
                                rotate: { duration: 8, repeat: Infinity, ease: 'linear' },
                                scale: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
                              }}
                            >
                              <Sparkles className="h-20 w-20 mx-auto mb-6 text-yellow-300 drop-shadow-2xl" />
                            </motion.div>
                            <motion.div
                              animate={{ opacity: [0.7, 1, 0.7] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            >
                              <p className="text-2xl font-bold mb-2">Click to Reveal</p>
                            </motion.div>
                            <p className="text-lg opacity-90 font-medium">
                              {index === 0 && 'Past Influences'}
                              {index === 1 && 'Present Situation'}
                              {index === 2 && 'Future Outcome'}
                            </p>
                            <div className="mt-4 text-sm opacity-75">Card {index + 1} of 3</div>
                          </div>
                        </div>
                      ) : (
                        // Card Front - Enhanced Design
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.2, duration: 0.5 }}
                          style={{ height: '384px' }}
                        >
                          <CardHeader className="text-center pb-6 pt-8">
                            <motion.div
                              animate={{ rotate: [0, 5, -5, 0] }}
                              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                            >
                              <div className={cn('mx-auto mb-4 p-4 rounded-full ', card.color)}>
                                {card.icon}
                              </div>
                            </motion.div>
                            <CardTitle className="text-2xl font-bold mb-3">{card.name}</CardTitle>
                            <CardDescription className="font-semibold text-lg text-purple-700 dark:text-purple-300">
                              {card.meaning}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-0 px-6 pb-8">
                            <p className="text-center text-muted-foreground leading-relaxed text-base">
                              {card.description}
                            </p>
                          </CardContent>
                        </motion.div>
                      )}
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Mystical Reading */}
              {cardFlips.some((flip) => flip) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 50 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.8, type: 'spring' }}
                >
                  <Card className="bg-linear-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-purple-950/40 dark:via-blue-950/40 dark:to-indigo-950/40 border-2 border-purple-200 dark:border-purple-700 shadow-2xl">
                    <CardHeader className="text-center pb-6">
                      <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.7, duration: 0.5 }}
                      >
                        <CardTitle className="text-3xl text-purple-700 dark:text-purple-300 flex items-center justify-center gap-3 mb-4">
                          <motion.div
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                          >
                            <Sparkles className="h-8 w-8" />
                          </motion.div>
                          Your Mystical Reading
                          <motion.div
                            animate={{ rotate: [0, -10, 10, 0] }}
                            transition={{
                              duration: 3,
                              repeat: Infinity,
                              ease: 'easeInOut',
                              delay: 1.5,
                            }}
                          >
                            <Sparkles className="h-8 w-8" />
                          </motion.div>
                        </CardTitle>
                      </motion.div>
                    </CardHeader>
                    <CardContent className="px-8 pb-8">
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1, duration: 1 }}
                      >
                        <blockquote className="text-xl md:text-2xl text-center italic text-purple-800 dark:text-purple-200 font-medium leading-relaxed relative">
                          <span className="text-4xl text-purple-400 absolute -top-4 -left-2">
                            "
                          </span>
                          {reading}
                          <span className="text-4xl text-purple-400 absolute -bottom-2 -right-2">
                            "
                          </span>
                        </blockquote>
                      </motion.div>

                      {/* Card positions explanation */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.5, duration: 0.5 }}
                      >
                        <div className="mt-8 grid grid-cols-3 gap-4 text-center text-sm">
                          <div className="text-purple-600 dark:text-purple-400">
                            <div className="font-semibold">Past</div>
                            <div className="opacity-75">{selectedCards[0]?.name}</div>
                          </div>
                          <div className="text-blue-600 dark:text-blue-400">
                            <div className="font-semibold">Present</div>
                            <div className="opacity-75">{selectedCards[1]?.name}</div>
                          </div>
                          <div className="text-indigo-600 dark:text-indigo-400">
                            <div className="font-semibold">Future</div>
                            <div className="opacity-75">{selectedCards[2]?.name}</div>
                          </div>
                        </div>
                      </motion.div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Educational Content */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.6 }}
      >
        <div className="bg-linear-to-br from-muted/30 to-muted/10 rounded-xl p-8 border border-muted-foreground/10 shadow-lg">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
          >
            <h2 className="text-3xl font-bold mb-8 text-center bg-linear-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              About Infra Tarot
            </h2>
          </motion.div>
          <div className="grid gap-8 md:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.2, duration: 0.5 }}
            >
              <h3 className="text-xl font-semibold mb-4 text-purple-700 dark:text-purple-300">
                How It Works
              </h3>
              <ul className="space-y-3 text-sm list-disc list-inside text-muted-foreground leading-relaxed">
                <li>Click "Draw 3 Mystical Cards" to receive your infrastructure reading</li>
                <li>Each card represents a different aspect of DevOps/infrastructure challenges</li>
                <li>Click on face-down cards to reveal their meaning and significance</li>
                <li>
                  Get a mystical (and delightfully humorous) interpretation of your tech future
                </li>
                <li>Share your reading with teammates for fun discussions about infrastructure</li>
                <li>Draw again for a different perspective on your infrastructure destiny</li>
              </ul>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.4, duration: 0.5 }}
            >
              <h3 className="text-xl font-semibold mb-4 text-blue-700 dark:text-blue-300">
                Card Categories
              </h3>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border-l-4 border-red-400">
                  <strong className="text-red-600 dark:text-red-400">🔥 Chaos Cards:</strong> The
                  Outage, Security Breach, Dependency Hell
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border-l-4 border-blue-400">
                  <strong className="text-blue-600 dark:text-blue-400">
                    🏗️ Architecture Cards:
                  </strong>{' '}
                  The Sidecar, Cloud Migration, API Timeout
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border-l-4 border-green-400">
                  <strong className="text-green-600 dark:text-green-400">
                    ⚙️ Operations Cards:
                  </strong>{' '}
                  The Autoscaler, Config Drift, Load Spike
                </div>
                <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border-l-4 border-yellow-400">
                  <strong className="text-yellow-600 dark:text-yellow-400">
                    💰 Resource Cards:
                  </strong>{' '}
                  Budget Cut, Disk Full, Memory Leak
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border-l-4 border-purple-400">
                  <strong className="text-purple-600 dark:text-purple-400">
                    🌐 Network Cards:
                  </strong>{' '}
                  DNS Outage, Network Partition
                </div>
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border-l-4 border-indigo-400">
                  <strong className="text-indigo-600 dark:text-indigo-400">💾 Data Cards:</strong>{' '}
                  Database Lock, Cert Expiry
                </div>
              </div>
            </motion.div>
          </div>
          <motion.div
            className="mt-8 p-6 bg-linear-to-r from-yellow-50 via-orange-50 to-yellow-50 dark:from-yellow-950/20 dark:via-orange-950/20 dark:to-yellow-950/20 rounded-xl border-2 border-yellow-200 dark:border-yellow-800 shadow-inner"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.6, duration: 0.5 }}
          >
            <p className="text-sm text-yellow-800 dark:text-yellow-200 text-center leading-relaxed">
              <strong className="text-lg">🎭 Disclaimer:</strong> This is a fun parody game designed
              purely for entertainment! While the cards reference real infrastructure concepts and
              challenges, the mystical readings are completely satirical and should absolutely not
              be used for actual infrastructure planning or decision-making.
              <br />
              <span className="italic mt-2 block">
                Remember: Your monitoring dashboards are more reliable than crystal balls! 📊✨
              </span>
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
