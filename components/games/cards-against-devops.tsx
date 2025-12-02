'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCcw,
  Share2,
  Copy,
  Heart,
  Trophy,
  Users,
  Sparkles,
  Clock,
  Zap,
  ArrowRight,
  Home,
  Shuffle,
  Play,
  Pause,
  Crown,
  Star,
  CheckCircle,
  Award,
  Laugh,
  RotateCcw,
  MessageCircle,
  Target,
  TrendingUp,
  UserPlus,
  Gavel,
  Timer,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Black Cards (Prompts with blanks)
const BLACK_CARDS = [
  'When the production servers went down at 3 AM, I knew it was time for _____.',
  'The new DevOps engineer quit after experiencing _____.',
  'Our deployment pipeline broke because someone forgot about _____.',
  'The CEO asked why we need _____ in our infrastructure budget.',
  'The intern accidentally deleted _____ and brought down the entire system.',
  'Our monitoring alerts went crazy when _____ happened in production.',
  'The security team freaked out when they discovered _____ in our AWS account.',
  'We knew our Kubernetes cluster was doomed when we found _____.',
  'The on-call rotation became a nightmare after _____.',
  'Our CI/CD pipeline failed spectacularly due to _____.',
  'The database administrator cried when they saw _____.',
  'We had to explain to management why _____ costs $10,000 per month.',
  'The incident post-mortem revealed that _____ was the root cause.',
  'Our containerization efforts were derailed by _____.',
  'The cloud migration went sideways because of _____.',
  'We knew our microservices architecture was too complex when _____.',
  "The docker container wouldn't start because of _____.",
  'Our Terraform state got corrupted due to _____.',
  "The load balancer couldn't handle _____ during Black Friday.",
  'We discovered that our backup strategy failed because of _____.',
  'The networking team blamed _____ for the connectivity issues.',
  'Our SSL certificate expired and caused _____.',
  'The compliance audit failed when they found _____.',
  'We had to rollback the deployment because _____.',
  'The chaos engineering experiment revealed _____.',
  "Our observability stack couldn't trace _____.",
  'The infrastructure as code deployment destroyed _____.',
  'We knew the system was under attack when _____ appeared in the logs.',
  'The auto-scaling group went rogue and created _____.',
  'Our disaster recovery plan failed to account for _____.',
];

// White Cards (Responses)
const WHITE_CARDS = [
  'A rogue Kubernetes pod consuming all cluster resources',
  'Misconfigured DNS that routes traffic to a coffee shop',
  "A deployment script that only works on the developer's laptop",
  'Hardcoded passwords in the main branch',
  "A load balancer that's actually just three hamsters on wheels",
  'Cryptocurrency mining malware in the CI/CD pipeline',
  "A database that hasn't been backed up since 2019",
  'Infrastructure managed entirely through SSH and tears',
  'A monitoring system that monitors itself monitoring itself',
  'Serverless functions that cost more than dedicated servers',
  "A Docker image that's 47GB because someone forgot to use .dockerignore",
  'AWS bills that require a mortgage to pay',
  'Production deployments on Fridays at 5 PM',
  'A single-threaded Node.js app handling millions of requests',
  'Helm charts written by someone who clearly hates YAML',
  "A CDN that's slower than dial-up internet",
  'Microservices that talk to each other through carrier pigeons',
  "A Jenkins server running on a Raspberry Pi under someone's desk",
  'Log files that are larger than the entire application',
  'A security group that allows traffic from 0.0.0.0/0',
  'Health checks that always return 200 even when everything is on fire',
  "A Terraform module that nobody understands but everyone's afraid to touch",
  'Container orchestration managed by a Magic 8-Ball',
  "A message queue that's just email with extra steps",
  'SSL certificates that expired during the company holiday party',
  'A caching layer that caches everything except what you actually need',
  "An API gateway that's actually just a very confused reverse proxy",
  "Infrastructure documentation that exists only in the original developer's head",
  'A backup strategy that involves USB drives and good intentions',
  'Monitoring dashboards that show everything is fine while the building is on fire',
  'A CI/CD pipeline that takes longer to run than to rewrite the entire application',
  'Kubernetes configs that summon ancient DevOps demons',
  'A database migration that time travels',
  'Auto-scaling that scales down during traffic spikes',
  'Service mesh configuration that creates more problems than it solves',
  'A Git repository with 50,000 unread notification emails',
  "Infrastructure as Code that's actually Infrastructure as Chaos",
  'A load test that accidentally DDoSed the competition',
  "Container images that update themselves when you're not looking",
  'A service discovery mechanism that discovers services from parallel universes',
  'Feature flags that flag themselves',
  'A deployment rollback that goes forward in time',
  'Network policies that only work during a full moon',
  'A secret management system that tells everyone the secrets',
  'Log aggregation that aggregates everything except the logs you need',
  'A disaster recovery plan written on a napkin in Comic Sans',
  'Service-to-service authentication via interpretive dance',
  'A cron job that gained sentience and is now unionizing',
  'Infrastructure provisioning through prayer and sacrifice',
  'A monitoring alert that alerts you about other alerts',
];

// Game modes
type GameMode = 'solo' | 'pass-and-play';

// Player interface for multiplayer
interface Player {
  id: string;
  name: string;
  score: number;
  hand: string[];
  isJudge: boolean;
}

// Game state interface
interface GameState {
  gameMode: GameMode;
  currentBlackCard: string;
  playerHand: string[];
  selectedCards: string[];
  score: number;
  round: number;
  gameStarted: boolean;
  showResults: boolean;

  // Multiplayer specific
  players: Player[];
  currentJudgeIndex: number;
  currentPlayerIndex: number;
  submittedCards: Array<{
    playerId: string;
    card: string;
    playerName: string;
  }>;
  isJudging: boolean;

  gameHistory: Array<{
    blackCard: string;
    selectedCard: string;
    round: number;
    points: number;
    playerName?: string;
    winnerName?: string;
  }>;
}

// Card component with improved styling
function GameCard({
  children,
  isBlack = false,
  isSelected = false,
  onClick,
  className = '',
  disabled = false,
  variant = 'default',
}: {
  children: React.ReactNode;
  isBlack?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  variant?: 'default' | 'preview';
}) {
  return (
    <motion.div
      whileHover={!disabled ? { scale: 1.02, y: -2 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      className={cn(
        'relative transition-all duration-300',
        !disabled && 'cursor-pointer',
        disabled && 'cursor-not-allowed',
        className
      )}
      onClick={!disabled ? onClick : undefined}
    >
      <Card
        className={cn(
          'transition-all duration-300 shadow-lg border-2',
          variant === 'preview' ? 'h-32' : 'h-40 sm:h-48',
          isBlack
            ? 'bg-linear-to-br from-gray-900 via-gray-800 to-black text-white border-gray-600 hover:border-gray-500 hover:shadow-2xl'
            : 'bg-linear-to-br from-white via-gray-50 to-white border-gray-200 hover:border-primary/40 hover:shadow-xl dark:from-gray-800 dark:to-gray-900 dark:border-gray-700',
          isSelected &&
            !isBlack &&
            'border-primary/80 bg-linear-to-br from-primary/5 to-purple-500/5 shadow-xl ring-2 ring-primary/20',
          disabled && 'opacity-60 grayscale',
          !disabled && 'hover:shadow-2xl'
        )}
      >
        <CardContent
          className={cn(
            'p-3 sm:p-4 h-full flex items-center justify-center relative',
            variant === 'preview' && 'p-2'
          )}
        >
          <p
            className={cn(
              'text-center font-medium leading-relaxed select-none',
              isBlack ? 'text-gray-100' : 'text-gray-800 dark:text-gray-200',
              variant === 'preview' ? 'text-xs' : 'text-sm sm:text-base',
              'line-clamp-6'
            )}
          >
            {children}
          </p>

          {/* Card decorations */}
          {isBlack && (
            <div className="absolute top-2 left-2">
              <div className="w-6 h-6 rounded-full bg-linear-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                <Crown className="w-3 h-3 text-white" />
              </div>
            </div>
          )}

          {isSelected && !isBlack && (
            <div className="absolute top-2 right-2">
              <div className="w-6 h-6 rounded-full bg-linear-to-br from-primary to-purple-600 flex items-center justify-center">
                <CheckCircle className="w-3 h-3 text-white" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Shuffle function
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Score calculation
function calculatePoints(combination: string): number {
  // Simple scoring based on combination length and keywords
  const keywords = ['fire', 'disaster', 'crash', 'fail', 'chaos', 'nightmare', 'tears'];
  let points = Math.floor(Math.random() * 3) + 1;

  if (keywords.some((keyword) => combination.toLowerCase().includes(keyword))) {
    points += 1;
  }

  return Math.min(5, points);
}

export function CardsAgainstDevOps() {
  const [gameState, setGameState] = useState<GameState>({
    gameMode: 'solo',
    currentBlackCard: '',
    playerHand: [],
    selectedCards: [],
    score: 0,
    round: 0,
    gameStarted: false,
    showResults: false,

    // Multiplayer specific
    players: [],
    currentJudgeIndex: 0,
    currentPlayerIndex: 0,
    submittedCards: [],
    isJudging: false,

    gameHistory: [],
  });

  const [setupStep, setSetupStep] = useState<'mode' | 'players' | 'ready'>('mode');
  const [playerNames, setPlayerNames] = useState<string[]>(['', '', '']);
  const [showInstructions, setShowInstructions] = useState(false);

  // Initialize multiplayer game
  const initializeMultiplayerGame = useCallback(() => {
    const validPlayers = playerNames.filter((name) => name.trim().length > 0);
    const shuffledWhiteCards = shuffleArray(WHITE_CARDS);
    const shuffledBlackCards = shuffleArray(BLACK_CARDS);

    const players: Player[] = validPlayers.map((name, index) => ({
      id: `player-${index}`,
      name: name.trim(),
      score: 0,
      hand: shuffledWhiteCards.slice(index * 7, (index + 1) * 7),
      isJudge: index === 0,
    }));

    setGameState({
      gameMode: 'pass-and-play',
      currentBlackCard: shuffledBlackCards[0],
      playerHand: players[1]?.hand || [], // Start with first non-judge player
      selectedCards: [],
      score: 0,
      round: 1,
      gameStarted: true,
      showResults: false,

      // Multiplayer specific
      players,
      currentJudgeIndex: 0,
      currentPlayerIndex: 1,
      submittedCards: [],
      isJudging: false,

      gameHistory: [],
    });
  }, [playerNames]);

  // Initialize game
  const initializeGame = useCallback(() => {
    const shuffledWhiteCards = shuffleArray(WHITE_CARDS);
    const shuffledBlackCards = shuffleArray(BLACK_CARDS);

    setGameState({
      gameMode: 'solo',
      currentBlackCard: shuffledBlackCards[0],
      playerHand: shuffledWhiteCards.slice(0, 7),
      selectedCards: [],
      score: 0,
      round: 1,
      gameStarted: true,
      showResults: false,

      // Multiplayer specific
      players: [],
      currentJudgeIndex: 0,
      currentPlayerIndex: 0,
      submittedCards: [],
      isJudging: false,

      gameHistory: [],
    });
  }, []);

  // Start next round
  const nextRound = useCallback(() => {
    if (gameState.selectedCards.length === 0) return;

    const selectedCard = gameState.selectedCards[0];
    const combination = gameState.currentBlackCard.replace('_____', selectedCard);
    const points = calculatePoints(combination);

    const newHistory = [
      ...gameState.gameHistory,
      {
        blackCard: gameState.currentBlackCard,
        selectedCard,
        round: gameState.round,
        points,
      },
    ];

    setGameState((prev) => {
      const remainingWhiteCards = WHITE_CARDS.filter(
        (card) => !prev.playerHand.includes(card) && card !== selectedCard
      );
      const shuffledRemaining = shuffleArray(remainingWhiteCards);
      const newHand = [
        ...prev.playerHand.filter((card) => card !== selectedCard),
        shuffledRemaining[0],
      ];
      const shuffledBlackCards = shuffleArray(
        BLACK_CARDS.filter((card) => card !== prev.currentBlackCard)
      );

      return {
        ...prev,
        currentBlackCard: shuffledBlackCards[0],
        playerHand: newHand,
        selectedCards: [],
        score: prev.score + points,
        round: prev.round + 1,
        showResults: true,
        gameHistory: newHistory,
      };
    });

    // Hide results after 3 seconds
    setTimeout(() => {
      setGameState((prev) => ({ ...prev, showResults: false }));
    }, 3000);
  }, [
    gameState.selectedCards,
    gameState.currentBlackCard,
    gameState.round,
    gameState.playerHand,
    gameState.gameHistory,
  ]);

  // Select/deselect card
  const toggleCardSelection = useCallback((card: string) => {
    setGameState((prev) => ({
      ...prev,
      selectedCards: prev.selectedCards.includes(card)
        ? prev.selectedCards.filter((c) => c !== card)
        : [card], // Only allow one card selection
    }));
  }, []);

  // Reset game
  const resetGame = useCallback(() => {
    setGameState({
      gameMode: 'solo',
      currentBlackCard: '',
      playerHand: [],
      selectedCards: [],
      score: 0,
      round: 0,
      gameStarted: false,
      showResults: false,

      // Multiplayer specific
      players: [],
      currentJudgeIndex: 0,
      currentPlayerIndex: 0,
      submittedCards: [],
      isJudging: false,

      gameHistory: [],
    });

    // Reset setup step and player names
    setSetupStep('mode');
    setPlayerNames(['', '', '']);
  }, []);

  // Share combination
  const shareCombination = useCallback(async () => {
    if (gameState.selectedCards.length === 0) return;

    const combination = gameState.currentBlackCard.replace('_____', gameState.selectedCards[0]);
    const shareText = `Check out this hilarious Cards Against DevOps combination:\n\n"${combination}"\n\n🃏 Play at DevOps Daily!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Cards Against DevOps',
          text: shareText,
          url: window.location.href,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      await navigator.clipboard.writeText(`${shareText}\n\n${window.location.href}`);
      // Show toast notification
    }
  }, [gameState.currentBlackCard, gameState.selectedCards]);

  // Advance to next player in pass-and-play mode
  const advanceToNextPlayer = useCallback(() => {
    if (gameState.gameMode !== 'pass-and-play') return;

    setGameState((prev) => {
      const nextPlayerIndex = (prev.currentPlayerIndex + 1) % prev.players.length;

      // Skip judge
      if (nextPlayerIndex === prev.currentJudgeIndex) {
        const afterJudge = (nextPlayerIndex + 1) % prev.players.length;
        return {
          ...prev,
          currentPlayerIndex: afterJudge,
          playerHand: prev.players[afterJudge]?.hand || [],
          selectedCards: [],
        };
      }

      return {
        ...prev,
        currentPlayerIndex: nextPlayerIndex,
        playerHand: prev.players[nextPlayerIndex]?.hand || [],
        selectedCards: [],
      };
    });
  }, [
    gameState.gameMode,
    gameState.currentPlayerIndex,
    gameState.players,
    gameState.currentJudgeIndex,
  ]);

  // Submit card in multiplayer mode
  const submitCardMultiplayer = useCallback(() => {
    if (gameState.selectedCards.length === 0 || gameState.gameMode !== 'pass-and-play') return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const selectedCard = gameState.selectedCards[0];

    setGameState((prev) => ({
      ...prev,
      submittedCards: [
        ...prev.submittedCards,
        {
          playerId: currentPlayer.id,
          card: selectedCard,
          playerName: currentPlayer.name,
        },
      ],
      selectedCards: [],
    }));

    // Check if all non-judge players have submitted
    const totalPlayers = gameState.players.length;
    const expectedSubmissions = totalPlayers - 1; // Exclude judge

    if (gameState.submittedCards.length + 1 >= expectedSubmissions) {
      // Start judging phase
      setGameState((prev) => ({ ...prev, isJudging: true }));
    } else {
      // Advance to next player
      advanceToNextPlayer();
    }
  }, [
    gameState.selectedCards,
    gameState.gameMode,
    gameState.players,
    gameState.currentPlayerIndex,
    gameState.submittedCards,
    advanceToNextPlayer,
  ]);

  // Judge selects winner
  const selectWinner = useCallback(
    (winningSubmission: { playerId: string; card: string; playerName: string }) => {
      const combination = gameState.currentBlackCard.replace('_____', winningSubmission.card);
      const points = calculatePoints(combination);

      const newHistory = [
        ...gameState.gameHistory,
        {
          blackCard: gameState.currentBlackCard,
          selectedCard: winningSubmission.card,
          round: gameState.round,
          points,
          playerName: winningSubmission.playerName,
          winnerName: winningSubmission.playerName,
        },
      ];

      setGameState((prev) => {
        // Update winner's score
        const updatedPlayers = prev.players.map((player) =>
          player.id === winningSubmission.playerId
            ? { ...player, score: player.score + points }
            : player
        );

        // Advance to next round with new judge
        const nextJudgeIndex = (prev.currentJudgeIndex + 1) % prev.players.length;
        const nextPlayerIndex = nextJudgeIndex === 0 ? 1 : 0; // Start with first non-judge

        const shuffledBlackCards = shuffleArray(
          BLACK_CARDS.filter((card) => card !== prev.currentBlackCard)
        );

        return {
          ...prev,
          currentBlackCard: shuffledBlackCards[0],
          players: updatedPlayers,
          currentJudgeIndex: nextJudgeIndex,
          currentPlayerIndex: nextPlayerIndex,
          playerHand: updatedPlayers[nextPlayerIndex]?.hand || [],
          submittedCards: [],
          isJudging: false,
          selectedCards: [],
          round: prev.round + 1,
          showResults: true,
          gameHistory: newHistory,
        };
      });

      // Hide results after 3 seconds
      setTimeout(() => {
        setGameState((prev) => ({ ...prev, showResults: false }));
      }, 3000);
    },
    [gameState.currentBlackCard, gameState.round, gameState.gameHistory]
  );

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
          <Link
            href="/games"
            className="hover:text-primary transition-colors flex items-center gap-1"
          >
            <Home className="w-4 h-4" />
            Games
          </Link>
          <span>/</span>
          <span className="text-foreground">Cards Against DevOps</span>
        </nav>
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-pink-500 to-red-600 flex items-center justify-center">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-linear-to-r from-pink-600 to-red-600 bg-clip-text text-transparent">
                Cards Against DevOps
              </h1>
            </div>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              The hilariously inappropriate DevOps party game. Fill in the blanks with the most
              outrageous DevOps scenarios!
            </p>
            {gameState.gameStarted && (
              <div className="flex flex-wrap items-center justify-center gap-4">
                {gameState.gameMode === 'solo' ? (
                  <>
                    <Badge variant="secondary" className="text-sm px-3 py-1">
                      <Trophy className="w-3 h-3 mr-1" />
                      {gameState.score} points
                    </Badge>
                    <Badge variant="outline" className="text-sm px-3 py-1">
                      <Target className="w-3 h-3 mr-1" />
                      Round {gameState.round}
                    </Badge>
                    <Badge variant="outline" className="text-sm px-3 py-1">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      {gameState.gameHistory.length} played
                    </Badge>
                  </>
                ) : (
                  <>
                    <Badge variant="secondary" className="text-sm px-3 py-1">
                      <Gavel className="w-3 h-3 mr-1" />
                      Judge: {gameState.players[gameState.currentJudgeIndex]?.name}
                    </Badge>
                    <Badge variant="outline" className="text-sm px-3 py-1">
                      <Target className="w-3 h-3 mr-1" />
                      Round {gameState.round}
                    </Badge>
                    <Badge variant="outline" className="text-sm px-3 py-1">
                      <Users className="w-3 h-3 mr-1" />
                      {gameState.players.length} players
                    </Badge>
                  </>
                )}
              </div>
            )}
          </motion.div>
        </div>{' '}
        {!gameState.gameStarted ? (
          // Game Setup
          <div className="max-w-2xl mx-auto">
            {setupStep === 'mode' && (
              <Card className="mx-4 p-4 sm:p-6 lg:p-8 bg-linear-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-2 border-primary/20 shadow-xl">
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-linear-to-br from-pink-500 to-red-600 rounded-2xl flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <CardTitle className="text-xl sm:text-2xl mb-2">Choose Game Mode</CardTitle>
                    <CardDescription className="text-sm sm:text-base px-2">
                      How would you like to play Cards Against DevOps?
                    </CardDescription>
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    <Button
                      onClick={() => {
                        setGameState((prev) => ({ ...prev, gameMode: 'solo' }));
                        initializeGame();
                      }}
                      variant="outline"
                      className="w-full h-auto p-3 sm:p-4 text-left flex items-start gap-3 sm:gap-4 hover:bg-primary/5 border-2 transition-all duration-200"
                    >
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="font-semibold mb-1 text-sm sm:text-base wrap-break-word">
                          Solo Play
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed wrap-break-word whitespace-normal">
                          Practice mode - play against the computer and build your DevOps humor
                          skills
                        </div>
                      </div>
                    </Button>

                    <Button
                      onClick={() => setSetupStep('players')}
                      variant="outline"
                      className="w-full h-auto p-3 sm:p-4 text-left flex items-start gap-3 sm:gap-4 hover:bg-primary/5 border-2 transition-all duration-200"
                    >
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-linear-to-br from-pink-500 to-red-600 flex items-center justify-center shrink-0">
                        <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="font-semibold mb-1 text-sm sm:text-base wrap-break-word">
                          Pass & Play (3-8 Players)
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed wrap-break-word whitespace-normal">
                          Perfect for groups! Take turns on one device with friends or colleagues
                        </div>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {setupStep === 'players' && (
              <Card className="mx-4 p-4 sm:p-6 lg:p-8 bg-linear-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-2 border-primary/20 shadow-xl">
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-linear-to-br from-pink-500 to-red-600 rounded-2xl flex items-center justify-center">
                      <UserPlus className="w-8 h-8 text-white" />
                    </div>
                    <CardTitle className="text-xl sm:text-2xl mb-2">Add Players</CardTitle>
                    <CardDescription className="text-sm sm:text-base px-2">
                      Enter player names (3-8 players required)
                    </CardDescription>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {playerNames.map((name, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-linear-to-br from-primary/20 to-purple-500/20 flex items-center justify-center text-sm font-medium shrink-0">
                          {index + 1}
                        </div>
                        <input
                          type="text"
                          placeholder={`Player ${index + 1} name${index < 3 ? ' (required)' : ' (optional)'}`}
                          value={name}
                          onChange={(e) => {
                            const newNames = [...playerNames];
                            newNames[index] = e.target.value;
                            setPlayerNames(newNames);
                          }}
                          className="flex-1 min-w-0 px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                          maxLength={20}
                        />
                      </div>
                    ))}

                    {playerNames.length < 8 && (
                      <Button
                        onClick={() => setPlayerNames([...playerNames, ''])}
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add Player
                      </Button>
                    )}

                    <div className="text-xs text-muted-foreground text-center mt-4 p-3 bg-muted/30 rounded-lg">
                      💡 <strong>Tip:</strong> Players will take turns judging. The judge picks the
                      funniest combination each round!
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border/50">
                    <Button
                      onClick={() => setSetupStep('mode')}
                      variant="outline"
                      className="flex-1 order-2 sm:order-1"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={initializeMultiplayerGame}
                      disabled={playerNames.filter((name) => name.trim()).length < 3}
                      className="flex-1 order-1 sm:order-2 bg-linear-to-r from-pink-500 to-red-600 hover:from-pink-600 hover:to-red-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Start Game ({playerNames.filter((name) => name.trim()).length}/8)
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          // Game Interface
          <div className="space-y-6 sm:space-y-8">
            {/* Game Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-border/50 backdrop-blur-sm">
              <div className="flex items-center gap-2 sm:gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={shareCombination}
                  disabled={gameState.selectedCards.length === 0}
                  className="hidden sm:flex"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
                {gameState.gameMode === 'pass-and-play' && (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      Best of {Math.max(5, gameState.players.length)} wins!
                    </span>
                    <span className="sm:hidden">
                      Best of {Math.max(5, gameState.players.length)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {gameState.gameMode === 'pass-and-play' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowInstructions(!showInstructions)}
                    className="text-xs"
                  >
                    <MessageCircle className="w-4 h-4 mr-1" />
                    Rules
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={resetGame}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">New Game</span>
                  <span className="sm:hidden">Reset</span>
                </Button>
              </div>
            </div>
            {/* Results Modal */}
            <AnimatePresence>
              {gameState.showResults && gameState.gameHistory.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                >
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl border-2 border-primary/20"
                  >
                    <div className="w-16 h-16 mx-auto mb-4 bg-linear-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center">
                      <Award className="w-8 h-8 text-white" />
                    </div>

                    {gameState.gameMode === 'solo' ? (
                      <>
                        <h3 className="text-xl font-bold mb-2">Round Complete!</h3>
                        <p className="text-muted-foreground mb-4">
                          You earned{' '}
                          {gameState.gameHistory[gameState.gameHistory.length - 1]?.points || 1}{' '}
                          points for that combination!
                        </p>
                        <div className="text-sm text-muted-foreground">
                          Moving to round {gameState.round}...
                        </div>
                      </>
                    ) : (
                      <>
                        <h3 className="text-xl font-bold mb-2">🎉 Round Winner!</h3>
                        <div className="text-2xl font-bold text-primary mb-2">
                          {gameState.gameHistory[gameState.gameHistory.length - 1]?.winnerName}
                        </div>
                        <p className="text-muted-foreground mb-4">
                          Won with{' '}
                          {gameState.gameHistory[gameState.gameHistory.length - 1]?.points || 1}{' '}
                          points!
                        </p>
                        <div className="text-sm text-muted-foreground">
                          Next judge: {gameState.players[gameState.currentJudgeIndex]?.name}
                        </div>
                      </>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            {/* Black Card (Prompt) */}
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 mb-4">
                <MessageCircle className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-lg font-medium text-muted-foreground">Fill in the blank:</h2>
              </div>
              <motion.div
                key={gameState.currentBlackCard}
                initial={{ rotateY: 90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="max-w-md mx-auto"
              >
                <GameCard isBlack>
                  {gameState.selectedCards.length > 0
                    ? gameState.currentBlackCard.replace('_____', gameState.selectedCards[0])
                    : gameState.currentBlackCard}
                </GameCard>
              </motion.div>
            </div>
            {/* Player Hand */}
            <div className="space-y-4">
              {gameState.gameMode === 'pass-and-play' && !gameState.isJudging && (
                <div className="text-center p-4 bg-linear-to-r from-primary/10 to-purple-500/10 rounded-xl border border-primary/20 shadow-lg">
                  <h3 className="font-semibold text-lg mb-2 flex items-center justify-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center animate-pulse">
                      <span className="text-white text-sm font-bold">
                        {gameState.players.findIndex(
                          (p) => p.id === gameState.players[gameState.currentPlayerIndex]?.id
                        ) + 1}
                      </span>
                    </div>
                    {gameState.players[gameState.currentPlayerIndex]?.name}'s Turn
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Select your funniest card to complete the prompt
                  </p>
                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Timer className="w-3 h-3" />
                      <span>Round {gameState.round}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>
                        {gameState.submittedCards.length}/{gameState.players.length - 1} submitted
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {gameState.gameMode === 'pass-and-play' && gameState.isJudging && (
                <div className="text-center p-4 bg-linear-to-r from-yellow-500/10 to-orange-500/10 rounded-xl border border-yellow-500/20 shadow-lg">
                  <h3 className="font-semibold text-lg mb-2 flex items-center justify-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center animate-bounce">
                      <Gavel className="w-4 h-4 text-white" />
                    </div>
                    {gameState.players[gameState.currentJudgeIndex]?.name} is Judging
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Choose the funniest combination to win the round
                  </p>
                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Trophy className="w-3 h-3" />
                      <span>Winner gets 1 point</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{gameState.submittedCards.length} cards to choose from</span>
                    </div>
                  </div>
                </div>
              )}

              {gameState.gameMode === 'pass-and-play' && gameState.isJudging ? (
                // Show submitted cards for judging
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-center flex items-center justify-center gap-2">
                    <Gavel className="w-5 h-5 text-yellow-600" />
                    Select the Winner
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {gameState.submittedCards.map((submission, index) => (
                      <div key={submission.playerId} className="space-y-2">
                        <div className="text-center">
                          <Badge variant="outline" className="text-xs font-medium">
                            Option {index + 1}
                          </Badge>
                        </div>
                        <GameCard
                          onClick={() => selectWinner(submission)}
                          className="hover:ring-2 hover:ring-yellow-500/50 hover:shadow-xl cursor-pointer transition-all duration-200 hover:scale-[1.02] bg-linear-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900"
                        >
                          {gameState.currentBlackCard.replace('_____', submission.card)}
                        </GameCard>
                        <div className="text-center">
                          <Button
                            onClick={() => selectWinner(submission)}
                            variant="outline"
                            size="sm"
                            className="text-xs hover:bg-yellow-500/10 hover:border-yellow-500/30"
                          >
                            Choose This One
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-center mt-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      💡 <strong>Judge's Choice:</strong> Pick the combination that made you laugh
                      the most!
                    </p>
                  </div>
                </div>
              ) : (
                // Show player hand for card selection
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      {gameState.gameMode === 'solo'
                        ? 'Your Cards'
                        : gameState.gameMode === 'pass-and-play'
                          ? `${gameState.players[gameState.currentPlayerIndex]?.name}'s Cards`
                          : 'Your Cards'}
                      <Badge variant="secondary" className="ml-2">
                        {gameState.playerHand.length}
                      </Badge>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {gameState.selectedCards.length > 0
                        ? 'Card selected! Ready to submit'
                        : 'Tap a card to select it'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                    {gameState.playerHand.map((card, index) => (
                      <GameCard
                        key={card}
                        isSelected={gameState.selectedCards.includes(card)}
                        onClick={() => toggleCardSelection(card)}
                        className="transform transition-all duration-200 hover:scale-[1.02]"
                      >
                        {card}
                      </GameCard>
                    ))}
                  </div>

                  {/* Play Button */}
                  <div className="text-center pt-4 space-y-3">
                    <Button
                      onClick={gameState.gameMode === 'solo' ? nextRound : submitCardMultiplayer}
                      disabled={gameState.selectedCards.length === 0}
                      size="lg"
                      className={`font-semibold w-full sm:w-auto transition-all duration-200 ${
                        gameState.selectedCards.length === 0
                          ? 'bg-gray-400 hover:bg-gray-400 cursor-not-allowed'
                          : 'bg-linear-to-r from-pink-500 to-red-600 hover:from-pink-600 hover:to-red-700 hover:scale-105'
                      } text-white`}
                    >
                      <ArrowRight className="w-5 h-5 mr-2" />
                      {gameState.gameMode === 'solo' ? 'Play Selected Card' : 'Submit Card'}
                    </Button>

                    {gameState.gameMode === 'pass-and-play' &&
                      gameState.selectedCards.length > 0 && (
                        <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg">
                          📱 <strong>Pass the device</strong> to the next player after submitting
                        </div>
                      )}
                  </div>
                </>
              )}
            </div>{' '}
            {/* Multiplayer Scoreboard */}
            {gameState.gameMode === 'pass-and-play' && gameState.players.length > 0 && (
              <div className="mt-8 sm:mt-12">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  Scoreboard
                  <Badge variant="outline" className="ml-auto text-xs">
                    Round {gameState.round}
                  </Badge>
                </h3>
                <div className="grid gap-2 sm:gap-3">
                  {gameState.players
                    .sort((a, b) => b.score - a.score)
                    .map((player, index) => (
                      <div
                        key={player.id}
                        className={`p-3 sm:p-4 rounded-xl border flex items-center justify-between transition-all duration-200 ${
                          player.isJudge
                            ? 'bg-linear-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30 ring-1 ring-yellow-500/20'
                            : player.id === gameState.players[gameState.currentPlayerIndex]?.id &&
                                !gameState.isJudging
                              ? 'bg-linear-to-r from-primary/10 to-purple-500/10 border-primary/30 ring-1 ring-primary/20'
                              : 'bg-white/70 dark:bg-gray-800/70 border-border/50 hover:bg-white/90 dark:hover:bg-gray-800/90'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              index === 0
                                ? 'bg-linear-to-br from-yellow-400 to-orange-500 text-white shadow-lg'
                                : index === 1
                                  ? 'bg-linear-to-br from-gray-400 to-gray-500 text-white shadow-md'
                                  : index === 2
                                    ? 'bg-linear-to-br from-amber-600 to-amber-700 text-white shadow-md'
                                    : 'bg-linear-to-br from-primary/20 to-purple-500/20 text-foreground'
                            }`}
                          >
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium flex items-center gap-2 text-sm sm:text-base">
                              <span className="truncate">{player.name}</span>
                              {player.isJudge && (
                                <div className="flex items-center gap-1">
                                  <Gavel className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-600" />
                                  <span className="text-xs text-yellow-600 hidden sm:inline">
                                    Judge
                                  </span>
                                </div>
                              )}
                              {player.id === gameState.players[gameState.currentPlayerIndex]?.id &&
                                !player.isJudge &&
                                !gameState.isJudging && (
                                  <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                                    <span className="text-xs text-primary hidden sm:inline">
                                      Active
                                    </span>
                                  </div>
                                )}
                            </div>
                            <div className="text-xs sm:text-sm text-muted-foreground">
                              {player.isJudge && gameState.isJudging
                                ? 'Choosing winner...'
                                : player.isJudge
                                  ? 'Judge this round'
                                  : player.id ===
                                        gameState.players[gameState.currentPlayerIndex]?.id &&
                                      !gameState.isJudging
                                    ? 'Current turn'
                                    : `${player.score} points`}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg sm:text-xl font-bold">{player.score}</div>
                          <div className="text-xs text-muted-foreground">pts</div>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Game Progress */}
                <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Game Progress</span>
                    <span className="font-medium">
                      {gameState.gameHistory.length} rounds completed
                    </span>
                  </div>
                </div>
              </div>
            )}
            {/* Game History */}
            {gameState.gameHistory.length > 0 && gameState.gameMode === 'solo' && (
              <div className="mt-8 sm:mt-12">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Recent Rounds
                </h3>
                <div className="grid gap-3">
                  {gameState.gameHistory
                    .slice(-3)
                    .reverse()
                    .map((history, index) => (
                      <div
                        key={history.round}
                        className="p-4 bg-white/70 dark:bg-gray-800/70 rounded-xl border border-border/50 backdrop-blur-sm"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="text-xs">
                              Round {history.round}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              +{history.points} pts
                            </Badge>
                          </div>
                          <p className="text-sm leading-relaxed">
                            <span className="font-medium">
                              {history.blackCard.replace('_____', history.selectedCard)}
                            </span>
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
            {/* Multiplayer Game History */}
            {gameState.gameHistory.length > 0 && gameState.gameMode === 'pass-and-play' && (
              <div className="mt-8 sm:mt-12">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  Recent Winners
                </h3>
                <div className="grid gap-3">
                  {gameState.gameHistory
                    .slice(-3)
                    .reverse()
                    .map((history, index) => (
                      <div
                        key={history.round}
                        className="p-4 bg-white/70 dark:bg-gray-800/70 rounded-xl border border-border/50 backdrop-blur-sm"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="text-xs">
                              Round {history.round}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              Winner: {history.winnerName}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              +{history.points} pts
                            </Badge>
                          </div>
                          <p className="text-sm leading-relaxed">
                            <span className="font-medium">
                              {history.blackCard.replace('_____', history.selectedCard)}
                            </span>
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
        {/* Instructions Modal */}
        <AnimatePresence>
          {showInstructions && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
              onClick={() => setShowInstructions(false)}
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border-2 border-primary/20"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 bg-linear-to-br from-pink-500 to-red-600 rounded-2xl flex items-center justify-center">
                    <MessageCircle className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">How to Play</h3>
                  <p className="text-sm text-muted-foreground">
                    Cards Against DevOps - Pass & Play Rules
                  </p>
                </div>

                <div className="space-y-4 text-sm">
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-xs font-bold">
                        1
                      </div>
                      Setup
                    </h4>
                    <p className="text-muted-foreground ml-8">
                      Each player gets 7 white cards. One player starts as the judge.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-xs font-bold">
                        2
                      </div>
                      Playing Cards
                    </h4>
                    <p className="text-muted-foreground ml-8">
                      Players take turns selecting their funniest white card to complete the black
                      card prompt.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-xs font-bold">
                        3
                      </div>
                      Judging
                    </h4>
                    <p className="text-muted-foreground ml-8">
                      The judge picks the funniest combination. That player gets 1 point!
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-xs font-bold">
                        4
                      </div>
                      Winning
                    </h4>
                    <p className="text-muted-foreground ml-8">
                      First to {Math.max(5, gameState.players.length)} points wins the game!
                    </p>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground text-center">
                    💡 <strong>Tip:</strong> The judge rotates each round, so everyone gets a chance
                    to pick the winner!
                  </p>
                </div>

                <div className="mt-6 text-center">
                  <Button onClick={() => setShowInstructions(false)} className="w-full">
                    Got it!
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
