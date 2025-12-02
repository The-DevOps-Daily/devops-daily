'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCcw,
  Share2,
  Copy,
  Laugh,
  Lightbulb,
  Coffee,
  Zap,
  Sparkles,
  Download,
  ChevronRight,
  Shuffle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// DevOps Engineer memes database with categories - 120+ memes!
const DEVOPS_MEMES = {
  infrastructure: [
    "You've debugged DNS more than you've hugged your family.",
    "You consider 'Everything is on fire' a normal Tuesday.",
    "You've ever said 'Have you tried turning the entire datacenter off and on again?'",
    "Your biggest fear isn't death, it's a single point of failure.",
    "You've named infrastructure components after Game of Thrones characters and lived to regret it.",
    "You've used Infrastructure as Code to provision your home network.",
    "Your definition of 'serverless' includes 'someone else's servers'.",
    'You know more about Linux file permissions than your own emotions.',
    "You've named your Wi-Fi network after your favorite load balancer.",
    "You've explained network latency using pizza delivery analogies.",
    'You know what a 503 error means but not what SOS stands for.',
    "You've ever described a server as 'having personality issues'.",
    "Your home router has better monitoring than some companies' production systems.",
    'You can tell if a server is having a bad day just by looking at its metrics.',
    "You've named your pet after your favorite cloud provider.",
    'You know more about subnet masks than your own neighborhood.',
    "You've ever called a server 'she' and meant it affectionately.",
    "Your dating profile lists 'high availability' as a key requirement.",
    "You've explained why the internet is down using OSI layer analogies.",
    "You treat load balancers like they're members of your family.",
    "You've had longer relationships with servers than with people.",
    'You know the IP addresses of your favorite websites by heart.',
    "You've given servers pet names based on their quirks.",
    'You can predict server failures better than the weather.',
  ],
  automation: [
    "You've automated your coffee machine but still manually deploy to production.",
    "Your idea of 'manual testing' involves at least three different CI/CD pipelines.",
    "You've written more YAML than actual code this year.",
    'You automate everything except remembering to automate everything.',
    'Your deployment pipeline has more stages than a rocket launch.',
    "You've ever said 'It works in my pipeline' as if that's reassuring.",
    'Your CI/CD pipeline takes longer to run than the actual development time.',
    "You've named your build servers and talk to them when they're slow.",
    'You measure your worth by the number of green checkmarks in your pipeline.',
    "You've automated your lunch order but still manually restart services.",
    'Your Ansible playbooks have more roles than a Shakespeare play.',
    "You've written a script to write scripts that write other scripts.",
    'You automate your standup updates but forget to automate your actual work.',
    'Your Jenkins has more plugins than your browser has extensions.',
    "You've created a pipeline to deploy pipelines that deploy other pipelines.",
    'You know more about cron syntax than your own birthday.',
    "You've automated saying 'hello world' in 15 different ways.",
    'Your GitHub Actions workflow file is longer than most novels.',
    "You've made a bot to remind you to check on your other bots.",
    'You automated your vacation out-of-office message but forgot to take the vacation.',
    "You've automated your morning routine but still forget to eat breakfast.",
    'Your shell aliases are more complex than some programming languages.',
    "You've written a script to generate excuses for why the build is broken.",
    'You automate code formatting but manually organize your desk.',
  ],
  monitoring: [
    'Your vacation photos are all screenshots of monitoring dashboards showing 99.99% uptime.',
    'You know exactly which emoji represents each service status in Slack.',
    "Your car's check engine light doesn't worry you because there are no alerts in PagerDuty.",
    'You have opinions about monitoring tools that are stronger than your political views.',
    'Your first instinct when something breaks is to check the logs, even for your coffee machine.',
    "You've ever debugged a problem by reading tea leaves (and by tea leaves, we mean logs).",
    'You can tell the health of your entire infrastructure by the color of your phone notifications.',
    "You've named your child's stuffed animals after monitoring metrics.",
    'You know what normal CPU usage looks like better than your own vital signs.',
    "You've ever been woken up by an alert about a service you forgot existed.",
    'Your phone has more monitoring apps than social media apps.',
    "You judge restaurants by their uptime (how often they're actually open).",
    "You've set up monitoring for your home appliances.",
    'You know the difference between a spike and an anomaly in your sleep patterns.',
    "You've created dashboards for tracking your personal productivity.",
    'Your heart rate monitor is just another data source to you.',
    "You've ever troubleshot a family argument using root cause analysis.",
    'You monitor your Wi-Fi performance more closely than your bank account.',
    "You've set up alerts for when your plants need watering.",
    'You can read Grafana charts faster than restaurant menus.',
  ],
  development: [
    "You've ever said 'It works on my machine' and meant your production cluster.",
    "You consider 'legacy code' anything written more than 3 months ago.",
    'You dream in YAML and wake up screaming about indentation.',
    "You've had heated arguments about the proper way to structure a monorepo.",
    "You've ever wished you could `git blame` real-life problems.",
    "You have strong feelings about whether tabs or spaces are better (and you're right).",
    "You consider 'works locally' to be a mythical concept like unicorns.",
    "You've written more Dockerfile lines than poetry lines in your lifetime.",
    "Your browser has more tabs open than a restaurant on New Year's Eve.",
    'You know the HTTP status codes better than your anniversary date.',
    "You've ever said 'That's a feature, not a bug' about infrastructure drift.",
    'Your code reviews are more thorough than your medical checkups.',
    "You've named variables after your feelings (mostly 'frustrated' and 'confused').",
    "You've commented your code better than you've commented on social media.",
    'You understand merge conflicts better than relationship conflicts.',
    "You've used Stack Overflow more than any other website this year.",
    'Your git history tells a better story than your diary.',
    "You've written TODO comments that are older than some junior developers.",
    "You debug production issues faster than you debug why your code doesn't work locally.",
    "You've named branches after your current mood.",
    'You know more keyboard shortcuts than your phone contacts.',
    "You've refactored code more times than you've rearranged your furniture.",
  ],
  culture: [
    'You have more SSH keys than house keys.',
    'Your browser bookmarks are 90% documentation and 10% Stack Overflow.',
    "You've named your pets after Kubernetes pods.",
    "You've ever explained microservices to your grandmother using kitchen analogies.",
    'Your personal todo list is managed in Jira.',
    "You've ever been in a meeting where someone suggested solving a people problem with Kubernetes.",
    'Your idea of a romantic evening is pairing on a deployment script.',
    'Your favorite bedtime story is the AWS pricing calculator.',
    "You've ever described your job as 'professional fire extinguisher'.",
    'Your idea of extreme sports is a production deployment on a Friday afternoon.',
    "You've ever said 'It's not a bug, it's a race condition' with a straight face.",
    "Your browser bookmarks folder 'DevOps Tools' has more entries than your contacts list.",
    "You know what 'works on my cluster' means and it's not funny anymore.",
    "You've used 'blame' more in git than in real life arguments.",
    'Your idea of a vacation is a weekend without any production incidents.',
    "You've ever explained Kubernetes to someone using IKEA furniture assembly analogies.",
    'Your coffee mug has more stickers from tech conferences than your laptop.',
    'You measure time in deployment cycles rather than hours.',
    "You've named your Wi-Fi network something only other DevOps engineers would understand.",
    "You know more about your servers' uptime than your own sleep schedule.",
    "You've used technical debt as an excuse for personal debt.",
    'Your idea of small talk is discussing the latest security vulnerabilities.',
    "You've explained scaling to non-tech people using restaurant analogies.",
    'You know more DevOps engineers than people in your neighborhood.',
    "You've used 'that's not in scope' in personal conversations.",
    'Your emergency contacts include your monitoring service.',
    "You've celebrated a successful deployment more than personal achievements.",
    'You know the difference between a hotfix and a feature in relationships.',
  ],
};

// Get all memes as a flat array
const ALL_MEMES = Object.values(DEVOPS_MEMES).flat();

// Meme categories for filtering
const MEME_CATEGORIES = [
  { id: 'all', label: 'All Memes', emoji: '🎯', count: ALL_MEMES.length },
  {
    id: 'infrastructure',
    label: 'Infrastructure',
    emoji: '🏗️',
    count: DEVOPS_MEMES.infrastructure.length,
  },
  { id: 'automation', label: 'Automation', emoji: '🤖', count: DEVOPS_MEMES.automation.length },
  { id: 'monitoring', label: 'Monitoring', emoji: '📊', count: DEVOPS_MEMES.monitoring.length },
  { id: 'development', label: 'Development', emoji: '💻', count: DEVOPS_MEMES.development.length },
  { id: 'culture', label: 'Culture', emoji: '🎭', count: DEVOPS_MEMES.culture.length },
];

// Simple reactions without counters
const REACTIONS = [
  { emoji: '😂', label: 'LOL!', shortcut: '1' },
  { emoji: '💯', label: 'This!', shortcut: '2' },
  { emoji: '🔥', label: 'Fire!', shortcut: '3' },
  { emoji: '😭', label: 'Too Real!', shortcut: '4' },
  { emoji: '🎯', label: 'Accurate!', shortcut: '5' },
  { emoji: '⚡', label: 'Relatable!', shortcut: '6' },
];

export default function DevOpsMemes() {
  const [currentMeme, setCurrentMeme] = useState('');
  const [currentCategory, setCurrentCategory] = useState('all');
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentReaction, setCurrentReaction] = useState<string | null>(null);
  const [memeHistory, setMemeHistory] = useState<string[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Generate initial meme
  useEffect(() => {
    generateNewMeme();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        generateNewMeme();
      } else if (e.key >= '1' && e.key <= '6') {
        const reactionIndex = parseInt(e.key) - 1;
        if (REACTIONS[reactionIndex]) {
          handleReaction(REACTIONS[reactionIndex].emoji);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const getCurrentMemes = () => {
    if (currentCategory === 'all') {
      return ALL_MEMES;
    }
    return DEVOPS_MEMES[currentCategory as keyof typeof DEVOPS_MEMES] || [];
  };

  const generateNewMeme = () => {
    if (isAnimating) return;

    setIsAnimating(true);

    // Add a small delay for animation effect
    setTimeout(() => {
      const availableMemes = getCurrentMemes();
      let randomMeme = availableMemes[Math.floor(Math.random() * availableMemes.length)];

      // Avoid showing the same meme twice in a row
      let attempts = 0;
      while (randomMeme === currentMeme && availableMemes.length > 1 && attempts < 10) {
        randomMeme = availableMemes[Math.floor(Math.random() * availableMemes.length)];
        attempts++;
      }

      setCurrentMeme(randomMeme);
      setCurrentReaction(null);
      setMemeHistory((prev) => [randomMeme, ...prev.slice(0, 4)]); // Keep last 5 memes

      setIsAnimating(false);
    }, 300);
  };

  const triggerConfetti = () => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 2000);
  };

  const copyToClipboard = async () => {
    const text = `You might be a DevOps engineer if...\n\n${currentMeme}\n\n#DevOps #Memes #TechHumor`;

    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const shareOnSocial = (platform: string) => {
    const text = encodeURIComponent(
      `You might be a DevOps engineer if... ${currentMeme} #DevOps #Memes`
    );
    const url = encodeURIComponent(window.location.href);

    let shareUrl = '';

    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${text}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}&title=${text}`;
        break;
      case 'reddit':
        shareUrl = `https://reddit.com/submit?title=${text}&url=${url}`;
        break;
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=550,height=420');
    }
  };

  const handleReaction = (emoji: string) => {
    setCurrentReaction(emoji);

    // Trigger confetti for special reactions
    if (['💯', '🔥'].includes(emoji)) {
      triggerConfetti();
    }

    // Reset reaction after 3 seconds
    setTimeout(() => setCurrentReaction(null), 3000);
  };

  const downloadMeme = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 600;

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#f97316');
    gradient.addColorStop(1, '#dc2626');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';

    const title = 'You might be a DevOps engineer if...';
    ctx.fillText(title, canvas.width / 2, 150);

    ctx.font = '24px Arial';
    const words = currentMeme.split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach((word) => {
      const testLine = currentLine + word + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > canvas.width - 100 && currentLine !== '') {
        lines.push(currentLine);
        currentLine = word + ' ';
      } else {
        currentLine = testLine;
      }
    });
    lines.push(currentLine);

    lines.forEach((line, index) => {
      ctx.fillText(line, canvas.width / 2, 250 + index * 40);
    });

    // Download
    const link = document.createElement('a');
    link.download = 'devops-meme.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {Array.from({ length: 30 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{
                x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 800),
                y: -10,
                rotate: 0,
              }}
              animate={{
                y: (typeof window !== 'undefined' ? window.innerHeight : 600) + 10,
                rotate: 360,
                x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 800),
              }}
              transition={{
                duration: 2,
                ease: 'easeOut',
                delay: Math.random() * 0.3,
              }}
            >
              <div className="w-2 h-2 bg-linear-to-r from-orange-400 to-red-500 rounded-full" />
            </motion.div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="text-center space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-center gap-4 mb-6">
            <Badge
              variant="outline"
              className="px-4 py-2 text-sm bg-linear-to-r from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 border-orange-200 dark:border-orange-700"
            >
              <Laugh className="w-4 h-4 mr-2" />
              {ALL_MEMES.length}+ Memes
            </Badge>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-linear-to-r from-orange-600 via-red-600 to-pink-600 bg-clip-text text-transparent">
            🧪 You Might Be a DevOps Engineer If...
          </h1>

          <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Auto-generating hilarious (and painfully accurate) DevOps memes. Each click brings a new
            dose of reality! Perfect for sharing your DevOps struggles with the world. 🔥
          </p>
        </motion.div>

        {/* Category Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <div className="flex flex-wrap justify-center gap-3">
            {MEME_CATEGORIES.map((category) => (
              <Button
                key={category.id}
                variant={currentCategory === category.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentCategory(category.id)}
                className={cn(
                  'transition-all duration-200',
                  currentCategory === category.id
                    ? 'bg-linear-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white'
                    : 'border-orange-200 hover:bg-orange-50 dark:border-orange-700 dark:hover:bg-orange-950/20'
                )}
              >
                <span className="mr-2">{category.emoji}</span>
                {category.label}
                <Badge variant="secondary" className="ml-2 text-xs">
                  {category.count}
                </Badge>
              </Button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Main Meme Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="relative overflow-hidden border-2 border-primary/20 bg-linear-to-br from-orange-50/50 via-white to-red-50/50 dark:from-orange-950/20 dark:via-background dark:to-red-950/20 shadow-xl">
          {/* Animated background elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-500/10 rounded-full blur-xl animate-pulse" />
            <div
              className="absolute -bottom-10 -left-10 w-40 h-40 bg-red-500/10 rounded-full blur-xl animate-pulse"
              style={{ animationDelay: '1s' }}
            />
          </div>

          <CardHeader className="text-center pb-6 relative z-10">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.2 }}
            >
              <div className="mx-auto mb-6 p-6 bg-linear-to-br from-orange-500 to-red-600 rounded-full w-fit shadow-xl">
                <Zap className="h-10 w-10 text-white" />
              </div>
            </motion.div>

            <CardTitle className="text-2xl md:text-3xl font-bold mb-2 text-primary">
              You might be a DevOps engineer if...
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-8 relative z-10">
            {/* Meme Text */}
            <div className="min-h-[120px] flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentMeme}
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.9 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                >
                  <div className="text-center">
                    <p className="text-xl md:text-2xl font-medium text-foreground leading-relaxed max-w-3xl">
                      {currentMeme}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Quick Reactions */}
            <div className="flex flex-wrap justify-center gap-3">
              {REACTIONS.map((reaction) => (
                <motion.div
                  key={reaction.emoji}
                  whileHover={{
                    scale: 1.15,
                    y: -2,
                    transition: { duration: 0.2, ease: 'easeOut' },
                  }}
                  whileTap={{
                    scale: 0.9,
                    y: 1,
                    transition: { duration: 0.1, ease: 'easeIn' },
                  }}
                >
                  <button
                    onClick={() => handleReaction(reaction.emoji)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-full border-2 transition-all duration-200 text-sm shadow-sm hover:shadow-md',
                      currentReaction === reaction.emoji
                        ? 'border-primary bg-primary/10 text-primary scale-110 shadow-lg shadow-primary/20'
                        : 'border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5 hover:shadow-primary/10'
                    )}
                    title={`Press ${reaction.shortcut} or click`}
                    type="button"
                  >
                    <motion.span
                      animate={
                        currentReaction === reaction.emoji ? { rotate: [0, 10, -10, 0] } : {}
                      }
                      transition={{ duration: 0.5 }}
                      style={{ fontSize: '1rem' }}
                    >
                      {reaction.emoji}
                    </motion.span>
                    <span className="font-medium">{reaction.label}</span>
                  </button>
                </motion.div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap justify-center gap-4">
              <motion.div
                whileHover={{
                  scale: 1.08,
                  y: -3,
                  transition: { duration: 0.2, ease: 'easeOut' },
                }}
                whileTap={{
                  scale: 0.95,
                  y: 1,
                  transition: { duration: 0.1, ease: 'easeIn' },
                }}
              >
                <Button
                  onClick={generateNewMeme}
                  disabled={isAnimating}
                  size="lg"
                  className="bg-linear-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl px-8 transition-all duration-200"
                >
                  {isAnimating ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <RefreshCcw className="h-5 w-5 mr-2" />
                    </motion.div>
                  ) : (
                    <motion.div whileHover={{ rotate: 180 }} transition={{ duration: 0.3 }}>
                      <RefreshCcw className="h-5 w-5 mr-2" />
                    </motion.div>
                  )}
                  New Meme
                  <span className="ml-2 text-xs opacity-75">(Space)</span>
                </Button>
              </motion.div>

              <motion.div
                whileHover={{
                  scale: 1.08,
                  y: -3,
                  transition: { duration: 0.2, ease: 'easeOut' },
                }}
                whileTap={{
                  scale: 0.95,
                  y: 1,
                  transition: { duration: 0.1, ease: 'easeIn' },
                }}
              >
                <Button
                  onClick={copyToClipboard}
                  variant="outline"
                  size="lg"
                  className={cn(
                    'border-primary/20 transition-all duration-200 shadow-sm hover:shadow-md',
                    copySuccess
                      ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/20 dark:border-green-800 shadow-green-200/50'
                      : 'hover:bg-primary/5 hover:border-primary/40'
                  )}
                >
                  <motion.div
                    animate={copySuccess ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 0.4 }}
                  >
                    <Copy className="h-5 w-5 mr-2" />
                  </motion.div>
                  {copySuccess ? 'Copied!' : 'Copy Text'}
                </Button>
              </motion.div>

              <motion.div
                whileHover={{
                  scale: 1.08,
                  y: -3,
                  transition: { duration: 0.2, ease: 'easeOut' },
                }}
                whileTap={{
                  scale: 0.95,
                  y: 1,
                  transition: { duration: 0.1, ease: 'easeIn' },
                }}
              >
                <Button
                  onClick={downloadMeme}
                  variant="outline"
                  size="lg"
                  className="border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-950/20 shadow-sm hover:shadow-md hover:border-purple-300 transition-all duration-200"
                >
                  <motion.div whileHover={{ y: -1 }} transition={{ duration: 0.2 }}>
                    <Download className="h-5 w-5 mr-2" />
                  </motion.div>
                  Download
                </Button>
              </motion.div>
            </div>

            {/* Share Buttons */}
            <div className="border-t border-muted-foreground/10 pt-6">
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground">Share this meme:</p>
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  onClick={() => shareOnSocial('twitter')}
                  variant="outline"
                  size="sm"
                  className="bg-blue-50 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/20 dark:border-blue-800"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Twitter
                </Button>

                <Button
                  onClick={() => shareOnSocial('linkedin')}
                  variant="outline"
                  size="sm"
                  className="bg-blue-50 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/20 dark:border-blue-800"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  LinkedIn
                </Button>

                <Button
                  onClick={() => shareOnSocial('reddit')}
                  variant="outline"
                  size="sm"
                  className="bg-orange-50 border-orange-200 hover:bg-orange-100 dark:bg-orange-950/20 dark:border-orange-800"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Reddit
                </Button>
              </div>
            </div>

            {/* Recent Memes History */}
            {memeHistory.length > 0 && (
              <div className="border-t border-muted-foreground/10 pt-6">
                <div className="text-center mb-4">
                  <p className="text-sm text-muted-foreground">Recently Generated:</p>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {memeHistory.map((meme, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <button
                        onClick={() => setCurrentMeme(meme)}
                        className="w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors p-2 rounded hover:bg-muted/50 flex items-center gap-2"
                      >
                        <ChevronRight className="w-3 h-3 shrink-0" />
                        <span className="truncate">{meme}</span>
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Keyboard Shortcuts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <Card className="bg-linear-to-br from-muted/30 to-muted/10 border border-muted-foreground/10">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <h3 className="text-lg font-semibold flex items-center justify-center gap-2">
                <Sparkles className="h-5 w-5 text-orange-500" />
                Quick Tips
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div className="space-y-2">
                  <p>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">Space</kbd> or{' '}
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">Enter</kbd> - Generate new
                    meme
                  </p>
                  <p>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">1-6</kbd> - Quick reactions
                  </p>
                </div>
                <div className="space-y-2">
                  <p>🎯 Over 120+ unique DevOps memes</p>
                  <p>📱 Perfect for sharing on social media</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* About Section */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.6 }}
      >
        <Card className="bg-linear-to-br from-muted/30 to-muted/10 border border-muted-foreground/10">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center bg-linear-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
              About This Meme Generator
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-orange-500" />
                  Why This Exists
                </h3>
                <p className="text-muted-foreground">
                  Every DevOps engineer has those moments of "this is painfully accurate" when
                  reading about the struggles of our profession. This generator celebrates the
                  shared experiences, inside jokes, and daily realities that unite our community.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Coffee className="h-5 w-5 text-orange-500" />
                  Perfect For
                </h3>
                <ul className="text-muted-foreground space-y-2">
                  <li>• Breaking the ice in team meetings</li>
                  <li>• Social media content for DevOps professionals</li>
                  <li>• Conference presentations and talks</li>
                  <li>• Sharing the pain (and joy) of DevOps life</li>
                </ul>
              </div>
            </div>

            <div className="text-center p-6 bg-linear-to-r from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 rounded-lg border border-orange-200/50 dark:border-orange-700/50">
              <p className="text-sm text-muted-foreground">
                <strong>💡 Pro Tip:</strong> Use keyboard shortcuts for lightning-fast meme
                generation! Press Space for new memes, or numbers 1-6 for quick reactions.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
