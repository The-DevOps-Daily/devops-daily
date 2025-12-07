'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Breadcrumb } from '@/components/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Play,
  Pause,
  RotateCcw,
  Home,
  Info,
  Server,
  Bug,
  Award,
  Trophy,
  Flame,
  AlertTriangle,
  CheckCircle,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Grid configuration
const GRID_SIZE = 24;
const CELL_SIZE = 22; // pixels
const INITIAL_SPEED = 150; // milliseconds per move
const SPEED_INCREMENT = 5; // speed increase per server eaten
const MIN_SPEED = 50; // minimum milliseconds per move

// Direction types
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

// Position interface
interface Position {
  x: number;
  y: number;
}

// Game over reason
type GameOverReason = 'wall' | 'self' | null;

// Achievement interface
interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  icon: string;
}

// Achievements list
const ACHIEVEMENTS_LIST: Achievement[] = [
  { id: 'first_server', title: 'First Infection', description: 'Compromise your first server', unlocked: false, icon: '🦠' },
  { id: 'servers_5', title: 'Spreading', description: 'Infect 5 servers', unlocked: false, icon: '🔥' },
  { id: 'servers_10', title: 'Outbreak', description: 'Infect 10 servers', unlocked: false, icon: '💥' },
  { id: 'servers_20', title: 'Pandemic', description: 'Infect 20 servers', unlocked: false, icon: '🌍' },
  { id: 'servers_50', title: 'System Failure', description: 'Infect 50 servers', unlocked: false, icon: '💀' },
  { id: 'speed_demon', title: 'Lightning Bug', description: 'Reach maximum speed', unlocked: false, icon: '⚡' },
  { id: 'survivor', title: 'Persistent Threat', description: 'Survive for 60 seconds', unlocked: false, icon: '⏰' },
];

export default function BugHunter() {
  // Game state
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  
  // Snake/Bug state
  const [bug, setBug] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [nextDirection, setNextDirection] = useState<Direction>('RIGHT');
  
  // Game over reason
  const [gameOverReason, setGameOverReason] = useState<GameOverReason>(null);
  
  // Server (food) state
  const [server, setServer] = useState<Position>({ x: 15, y: 15 });
  
  // Game stats
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const [serversInfected, setServersInfected] = useState(0);
  const [gameTime, setGameTime] = useState(0);
  
  // Achievements
  const [achievements, setAchievements] = useState<Achievement[]>(ACHIEVEMENTS_LIST);
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);
  
  // Refs
const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
const timerRef = useRef<NodeJS.Timeout | null>(null);
const directionRef = useRef<Direction>('RIGHT');
 const directionQueueRef = useRef<Direction[]>([]);

// Load high score from localStorage
  useEffect(() => {
    const savedHighScore = localStorage.getItem('bugHunterHighScore');
    if (savedHighScore) {
      setHighScore(parseInt(savedHighScore));
    }
    
    const savedAchievements = localStorage.getItem('bugHunterAchievements');
    if (savedAchievements) {
      setAchievements(JSON.parse(savedAchievements));
    }
  }, []);
  
  // Generate random server position
  const generateServerPosition = useCallback((currentBug: Position[]) => {
    let newPos: Position;
    let attempts = 0;
    const maxAttempts = 100;
    
    do {
      newPos = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      attempts++;
    } while (
      currentBug.some(segment => segment.x === newPos.x && segment.y === newPos.y) &&
      attempts < maxAttempts
    );
    
    return newPos;
  }, []);
  
  // Check achievement
  const checkAchievement = useCallback((achievementId: string) => {
    setAchievements(prev => {
      const updated = prev.map(achievement => {
        if (achievement.id === achievementId && !achievement.unlocked) {
          setNewAchievement(achievement);
          setTimeout(() => setNewAchievement(null), 3000);
          return { ...achievement, unlocked: true };
        }
        return achievement;
      });
      localStorage.setItem('bugHunterAchievements', JSON.stringify(updated));
      return updated;
    });
  }, []);
  
  // Handle keyboard input
 useEffect(() => {
   const handleKeyPress = (e: KeyboardEvent) => {
     if (!isRunning || isPaused) {
       if (e.key === ' ' && isRunning) {
         e.preventDefault();
         setIsPaused(prev => !prev);
       }
       if (e.key === 'Enter' && (gameOver || !isRunning)) {
         startGame();
       }
       return;
     }
     
     if (e.key === ' ') {
       e.preventDefault();
       setIsPaused(true);
       return;
     }
     
     let newDirection: Direction | null = null;
     
     switch (e.key) {
       case 'ArrowUp':
       case 'w':
       case 'W':
         if (directionRef.current !== 'DOWN') newDirection = 'UP';
         break;
       case 'ArrowDown':
       case 's':
       case 'S':
         if (directionRef.current !== 'UP') newDirection = 'DOWN';
         break;
       case 'ArrowLeft':
       case 'a':
       case 'A':
         if (directionRef.current !== 'RIGHT') newDirection = 'LEFT';
         break;
       case 'ArrowRight':
       case 'd':
       case 'D':
         if (directionRef.current !== 'LEFT') newDirection = 'RIGHT';
         break;
     }
     
    if (newDirection) {
      e.preventDefault();
      directionQueueRef.current.push(newDirection);
    }
  };
   
   window.addEventListener('keydown', handleKeyPress);
   return () => window.removeEventListener('keydown', handleKeyPress);
 }, [isRunning, isPaused, gameOver]);
  
  // Game loop
  useEffect(() => {
    if (!isRunning || isPaused || gameOver) {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    
    // Start timer
    timerRef.current = setInterval(() => {
      setGameTime(prev => prev + 1);
    }, 1000);
    
    // Start game loop
  gameLoopRef.current = setInterval(() => {
    setBug(prevBug => {
      const head = prevBug[0];
      let newHead: Position;
      
      // Process direction queue
      if (directionQueueRef.current.length > 0) {
        const queuedDirection = directionQueueRef.current.shift()!;
        // Validate the direction change is valid (not opposite)
        const currentDir = directionRef.current;
        const isValid = 
          (queuedDirection === 'UP' && currentDir !== 'DOWN') ||
          (queuedDirection === 'DOWN' && currentDir !== 'UP') ||
          (queuedDirection === 'LEFT' && currentDir !== 'RIGHT') ||
          (queuedDirection === 'RIGHT' && currentDir !== 'LEFT');
        
        if (isValid) {
          setNextDirection(queuedDirection);
          directionRef.current = queuedDirection;
        }
      }
      
      // Use current direction from ref
      const currentDirection = directionRef.current;
      
      // Calculate new head position
       switch (currentDirection) {
         case 'UP':
           newHead = { x: head.x, y: head.y - 1 };
            break;
          case 'DOWN':
            newHead = { x: head.x, y: head.y + 1 };
            break;
          case 'LEFT':
            newHead = { x: head.x - 1, y: head.y };
            break;
          case 'RIGHT':
            newHead = { x: head.x + 1, y: head.y };
            break;
        }
        
        // Check wall collision
        if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
          setGameOver(true);
          setIsRunning(false);
          setGameOverReason('wall');
          return prevBug;
        }
        
        // Check self collision
        if (prevBug.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
          setGameOver(true);
          setIsRunning(false);
          setGameOverReason('self');
          return prevBug;
        }
        
        const newBug = [newHead, ...prevBug];
        
        // Check if server is eaten
        if (newHead.x === server.x && newHead.y === server.y) {
          const newScore = score + 10;
          const newServersInfected = serversInfected + 1;
          
          setScore(newScore);
          setServersInfected(newServersInfected);
          
          // Update high score
          if (newScore > highScore) {
            setHighScore(newScore);
            localStorage.setItem('bugHunterHighScore', newScore.toString());
          }
          
          // Increase speed
          const newSpeed = Math.max(MIN_SPEED, speed - SPEED_INCREMENT);
          setSpeed(newSpeed);
          
          // Generate new server
          setServer(generateServerPosition(newBug));
          
          // Check achievements
          if (newServersInfected === 1) checkAchievement('first_server');
          if (newServersInfected === 5) checkAchievement('servers_5');
          if (newServersInfected === 10) checkAchievement('servers_10');
          if (newServersInfected === 20) checkAchievement('servers_20');
          if (newServersInfected === 50) checkAchievement('servers_50');
          if (newSpeed === MIN_SPEED) checkAchievement('speed_demon');
          
          return newBug;
        } else {
          // Remove tail if no server eaten
          newBug.pop();
          return newBug;
        }
      });
    }, speed);
    
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, isPaused, gameOver, nextDirection, speed, score, highScore, server, serversInfected, generateServerPosition, checkAchievement]);
  
  // Check time achievements
  useEffect(() => {
    if (gameTime === 60) {
      checkAchievement('survivor');
    }
  }, [gameTime, checkAchievement]);
  
  // Start game
 const startGame = () => {
   const initialBug = [{ x: 10, y: 10 }];
   setBug(initialBug);
   setDirection('RIGHT');
   setNextDirection('RIGHT');
   directionRef.current = 'RIGHT';
   directionQueueRef.current = [];
   setServer(generateServerPosition(initialBug));
    setScore(0);
    setServersInfected(0);
    setGameTime(0);
    setSpeed(INITIAL_SPEED);
    setGameOver(false);
    setIsPaused(false);
    setIsRunning(true);
    setShowInstructions(false);
    setGameOverReason(null);
  };
  
  // Toggle pause
  const togglePause = () => {
    setIsPaused(prev => !prev);
  };
  
  // Reset game
 const resetGame = () => {
   startGame();
 };
 
  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: 'Bug Hunter', href: '/games/bug-hunter', isCurrent: true },
  ];
 
 return (
   <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-12 px-4">
    <div className="max-w-7xl mx-auto space-y-8">
       {/* Breadcrumb */}
       <Breadcrumb items={breadcrumbItems} />

       {/* Header */}
       <div className="text-center space-y-4">
         <div className="flex items-center justify-center gap-3">
           <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
             <Bug className="w-7 h-7 text-white" />
           </div>
           <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white">
             Bug Hunter
           </h1>
         </div>
         <p className="text-xl text-slate-600 dark:text-gray-400 max-w-2xl mx-auto">
           Control a glitch that infects healthy servers. Grow longer with each infection, but don't crash!
         </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/games">
              <Button variant="outline" size="sm" className="gap-2">
                <Home className="w-4 h-4" />
                All Games
              </Button>
            </Link>
          </div>
        </div>

        {/* Game controls - above everything */}
       <Card className="bg-slate-100/90 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700/50 backdrop-blur">
         <CardContent className="p-6">
            <div className="flex items-center justify-center gap-4">
              {!isRunning ? (
                <Button
                  onClick={startGame}
                  size="lg"
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Start Game
                </Button>
              ) : (
                <>
                  <Button
                    onClick={togglePause}
                    size="lg"
                    variant="outline"
                  >
                    {isPaused ? (
                      <><Play className="w-5 h-5 mr-2" /> Resume</>
                    ) : (
                      <><Pause className="w-5 h-5 mr-2" /> Pause</>
                    )}
                  </Button>
                  <Button
                    onClick={resetGame}
                    size="lg"
                    variant="outline"
                  >
                    <RotateCcw className="w-5 h-5 mr-2" />
                    Reset
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-[300px_1fr_300px] gap-6 items-start">
          {/* Left sidebar - Score */}
         <div>
           {/* Score Card */}
           <Card className="bg-slate-100/90 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700/50 backdrop-blur">
             <CardHeader>
               <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                 <Trophy className="w-5 h-5 text-yellow-400" />
                 Score
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="space-y-2">
                 <div className="flex justify-between items-center">
                   <span className="text-sm text-slate-600 dark:text-gray-400">Current</span>
                   <span className="text-3xl font-bold text-slate-900 dark:text-white">{score}</span>
                 </div>
                 <div className="flex justify-between items-center">
                   <span className="text-sm text-slate-600 dark:text-gray-400">High Score</span>
                   <span className="text-xl font-bold text-yellow-400">{highScore}</span>
                 </div>
               </div>
               
               <div className="pt-4 border-t border-slate-300 dark:border-slate-700/50 space-y-2">
                 <div className="flex justify-between items-center">
                   <span className="text-sm text-slate-600 dark:text-gray-400">Servers Infected</span>
                   <span className="text-lg font-bold text-red-400">{serversInfected}</span>
                 </div>
                 <div className="flex justify-between items-center">
                   <span className="text-sm text-slate-600 dark:text-gray-400">Bug Length</span>
                   <span className="text-lg font-bold text-orange-400">{bug.length}</span>
                 </div>
                 <div className="flex justify-between items-center">
                   <span className="text-sm text-slate-600 dark:text-gray-400">Time</span>
                   <span className="text-lg font-bold text-blue-400">{gameTime}s</span>
                 </div>
                 <div className="flex justify-between items-center">
                   <span className="text-sm text-slate-600 dark:text-gray-400">Speed</span>
                   <span className="text-lg font-bold text-purple-400">
                      {Math.round((1000 / speed) * 10) / 10} moves/s
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Center - Game canvas */}
         <div className="flex justify-center">
           <Card className="bg-slate-100/90 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700/50 backdrop-blur overflow-hidden w-fit">
             <CardContent className="p-6">
               <div className="relative mx-auto" style={{ width: GRID_SIZE * CELL_SIZE, height: GRID_SIZE * CELL_SIZE }}>
                 {/* Grid background */}
                 <div className="absolute inset-0 bg-slate-200 dark:bg-slate-950 rounded-lg border-2 border-slate-400 dark:border-slate-700">
                   <div className="absolute inset-0 bg-grid opacity-20" />
                 </div>

                  {/* Server (food) */}
                  <motion.div
                    key={`server-${server.x}-${server.y}`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute flex items-center justify-center"
                    style={{
                      left: server.x * CELL_SIZE,
                      top: server.y * CELL_SIZE,
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                    }}
                  >
                    <div className="w-full h-full bg-gradient-to-br from-green-400 to-emerald-600 rounded shadow-lg flex items-center justify-center animate-pulse">
                      <Server className="w-4 h-4 text-white" />
                    </div>
                  </motion.div>

                  {/* Bug (snake) */}
                  {bug.map((segment, index) => (
                    <motion.div
                      key={`bug-${index}`}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute"
                      style={{
                        left: segment.x * CELL_SIZE,
                        top: segment.y * CELL_SIZE,
                        width: CELL_SIZE,
                        height: CELL_SIZE,
                      }}
                    >
                      <div
                        className={cn(
                          'w-full h-full rounded shadow-lg flex items-center justify-center',
                          index === 0
                            ? 'bg-gradient-to-br from-red-500 to-orange-600 animate-glitch'
                            : 'bg-gradient-to-br from-red-600 to-orange-700'
                        )}
                      >
                        {index === 0 && <Bug className="w-4 h-4 text-white" />}
                      </div>
                    </motion.div>
                  ))}

                  {/* Instructions overlay */}
                 <AnimatePresence>
                   {showInstructions && !isRunning && (
                     <motion.div
                       initial={{ opacity: 0 }}
                       animate={{ opacity: 1 }}
                       exit={{ opacity: 0 }}
                       className="absolute inset-0 bg-white/90 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center"
                     >
                       <div className="text-center p-8 max-w-md bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-2xl">
                        <Bug className="w-16 h-16 text-red-500 mx-auto mb-4" />
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">How to Play</h3>
                        <div className="text-left space-y-2 text-slate-700 dark:text-gray-300 mb-6">
                           <p>• Control the <span className="text-red-400 font-semibold">bug</span> to infect <span className="text-green-400 font-semibold">healthy servers</span></p>
                            <p>• The bug grows longer with each infection</p>
                            <p>• Avoid crashing into walls or yourself</p>
                            <p>• Speed increases as you infect more servers</p>
                            <p>• Unlock achievements as you progress</p>
                          </div>
                          <Button
                            onClick={startGame}
                            size="lg"
                            className="bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700"
                          >
                            Start Game
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Pause overlay */}
                  <AnimatePresence>
                    {isPaused && isRunning && !gameOver && (
                      <motion.div
                       initial={{ opacity: 0 }}
                       animate={{ opacity: 1 }}
                       exit={{ opacity: 0 }}
                       className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center"
                     >
                       <div className="text-center">
                         <Pause className="w-16 h-16 text-slate-900 dark:text-white mx-auto mb-4" />
                         <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Paused</h3>
                         <p className="text-slate-700 dark:text-gray-400">Press Space to resume</p>
                       </div>
                     </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Game over overlay */}
                  <AnimatePresence>
                    {gameOver && (
                      <motion.div
                       initial={{ opacity: 0 }}
                       animate={{ opacity: 1 }}
                       exit={{ opacity: 0 }}
                       className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center"
                     >
                       <div className="text-center p-8 bg-slate-100/90 dark:bg-slate-900/90 rounded-2xl border-2 border-red-500/50 shadow-2xl max-w-md">
                         <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                         <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                           {gameOverReason === 'wall' ? 'Bug Patched!' : 'System Crash!'}
                         </h3>
                         <p className="text-slate-600 dark:text-gray-400 mb-4">
                           {gameOverReason === 'wall'
                             ? 'The bug hit a firewall and was patched!'
                             : 'The bug corrupted itself and crashed!'}
                         </p>
                         <div className="grid grid-cols-2 gap-4 mb-6">
                           <div className="p-4 bg-slate-200/80 dark:bg-slate-800/50 rounded-lg">
                             <div className="text-3xl font-bold text-orange-400">
                               {score}
                             </div>
                             <div className="text-sm text-slate-600 dark:text-gray-400">Final Score</div>
                           </div>
                           <div className="p-4 bg-slate-200/80 dark:bg-slate-800/50 rounded-lg">
                             <div className="text-3xl font-bold text-red-400">
                               {serversInfected}
                             </div>
                             <div className="text-sm text-slate-600 dark:text-gray-400">Infected</div>
                           </div>
                         </div>
                          {score === highScore && highScore > 0 && (
                            <div className="mb-4">
                              <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500">
                                🏆 New High Score!
                              </Badge>
                            </div>
                          )}
                          <Button
                            onClick={resetGame}
                            className="bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700"
                          >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Try Again
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Achievement notification */}
                  <AnimatePresence>
                    {newAchievement && (
                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="absolute top-4 left-1/2 -translate-x-1/2 z-50"
                      >
                        <Alert className="bg-gradient-to-r from-yellow-500/90 to-orange-500/90 border-yellow-400 shadow-2xl">
                          <Award className="w-5 h-5" />
                          <AlertDescription className="font-semibold text-white">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{newAchievement.icon}</span>
                              <div>
                                <div>{newAchievement.title}</div>
                                <div className="text-xs opacity-90">{newAchievement.description}</div>
                              </div>
                            </div>
                          </AlertDescription>
                        </Alert>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Legend */}
                <div className="mt-6 flex flex-wrap gap-6 justify-center text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
                      <Bug className="w-4 h-4 text-white" />
                    </div>
                   <span className="text-slate-600 dark:text-gray-400">Bug (You)</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="w-6 h-6 rounded bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
                     <Server className="w-4 h-4 text-white" />
                   </div>
                   <span className="text-slate-600 dark:text-gray-400">Healthy Server</span>
                 </div>
               </div>
             </CardContent>
            </Card>
          </div>

          {/* Right sidebar - Controls */}
         <div>
           <Card className="bg-slate-100/90 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700/50 backdrop-blur">
             <CardHeader>
               <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                 <Info className="w-5 h-5 text-blue-400" />
                 Controls
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-3 text-sm">
               <div className="flex items-center gap-3">
                 <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded border border-slate-400 dark:border-slate-700 text-slate-900 dark:text-white font-mono">↑ ↓ ← →</kbd>
                 <span className="text-slate-600 dark:text-gray-400">Move</span>
               </div>
               <div className="flex items-center gap-3">
                 <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded border border-slate-400 dark:border-slate-700 text-slate-900 dark:text-white font-mono">W A S D</kbd>
                 <span className="text-slate-600 dark:text-gray-400">Alternative</span>
               </div>
               <div className="flex items-center gap-3">
                 <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded border border-slate-400 dark:border-slate-700 text-slate-900 dark:text-white font-mono">Space</kbd>
                 <span className="text-slate-600 dark:text-gray-400">Pause</span>
               </div>
               <div className="flex items-center gap-3">
                 <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded border border-slate-400 dark:border-slate-700 text-slate-900 dark:text-white font-mono">Enter</kbd>
                 <span className="text-slate-600 dark:text-gray-400">Start</span>
               </div>
             </CardContent>
           </Card>
          </div>
        </div>

        {/* Achievements - Below game */}
       <Card className="bg-slate-100/90 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700/50 backdrop-blur">
         <CardHeader>
           <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
             <Award className="w-5 h-5 text-yellow-400" />
             Achievements
           </CardTitle>
            <CardDescription>
              {achievements.filter(a => a.unlocked).length} / {achievements.length} unlocked
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {achievements.map(achievement => (
                <div
                  key={achievement.id}
                  className={cn(
                   'flex items-start gap-3 p-3 rounded-lg transition-colors',
                   achievement.unlocked
                     ? 'bg-green-500/10 dark:bg-green-500/10 border border-green-500/20'
                     : 'bg-slate-200/50 dark:bg-slate-800/50 opacity-50'
                 )}
                >
                  <div className="text-2xl">{achievement.icon}</div>
                  <div className="flex-1 min-w-0">
                   <div className="text-sm font-medium text-slate-900 dark:text-white">
                     {achievement.title}
                   </div>
                   <div className="text-xs text-slate-600 dark:text-gray-400">
                     {achievement.description}
                   </div>
                 </div>
                  {achievement.unlocked && (
                    <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Educational Tips */}
       <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 dark:from-blue-500/10 dark:to-purple-500/10 border-blue-500/20 dark:border-blue-500/20 backdrop-blur">
         <CardContent className="p-6">
           <div className="flex items-start gap-4">
             <div className="w-10 h-10 rounded-lg bg-blue-500/20 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
               <Info className="w-5 h-5 text-blue-400" />
             </div>
             <div>
               <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                 Real-World Security Lessons
               </h3>
               <ul className="text-sm text-slate-700 dark:text-gray-300 space-y-1">
                 <li>• <strong>Lateral Movement:</strong> Like the bug spreading, attackers move through networks after initial breach</li>
                  <li>• <strong>Rapid Propagation:</strong> Malware can quickly spread to vulnerable systems (like WannaCry ransomware)</li>
                  <li>• <strong>Containment:</strong> Early detection and isolation prevent widespread infection</li>
                  <li>• <strong>Defense in Depth:</strong> Multiple security layers slow down attackers (the walls in the game)</li>
                  <li>• <strong>Monitoring:</strong> Track system behavior to detect anomalies before they spread</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <style jsx global>{`
        .bg-grid {
          background-image: linear-gradient(to right, rgba(100, 100, 100, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(100, 100, 100, 0.1) 1px, transparent 1px);
          background-size: ${CELL_SIZE}px ${CELL_SIZE}px;
        }

        @keyframes glitch {
          0%, 100% { transform: translate(0); }
          20% { transform: translate(-2px, 2px); }
          40% { transform: translate(2px, -2px); }
          60% { transform: translate(-2px, -2px); }
          80% { transform: translate(2px, 2px); }
        }

        .animate-glitch {
          animation: glitch 0.3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
