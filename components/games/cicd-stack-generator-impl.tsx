'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const CI_CD_TOOLS = [
  'GitHub Actions',
  'Jenkins',
  'GitLab CI',
  'CircleCI',
  'Travis CI',
  'Drone CI',
  'Bamboo',
  'TeamCity',
  'Argo CD',
  'Spinnaker',
];

const INFRASTRUCTURE_TOOLS = [
  'Terraform',
  'Ansible',
  'Kustomize',
  'Pulumi',
  'CloudFormation',
  'Bash scripts',
  'Puppet',
  'Chef',
  'Helm',
  'Crossplane',
];

const CLOUD_PLATFORMS = [
  'AWS',
  'GCP',
  'Azure',
  'DigitalOcean',
  'IBM Cloud',
  'Oracle Cloud',
  'Heroku',
  'Raspberry Pi',
  'Kubernetes',
  'Bare Metal',
];

const FUNNY_RATINGS = [
  {
    text: 'Dream pipeline! Your deployments probably finish before you start them.',
    color: 'bg-green-500',
    emoji: '🚀',
    weight: 1,
    keywords: ['GitHub Actions', 'Terraform', 'AWS'],
  },
  {
    text: 'Enterprise-grade overkill. Are you deploying a blog or a banking system?',
    color: 'bg-blue-500',
    emoji: '🏦',
    weight: 1,
    keywords: ['Jenkins', 'IBM Cloud', 'TeamCity'],
  },
  {
    text: 'Your infrastructure is held together by vibes and prayers.',
    color: 'bg-red-500',
    emoji: '🙏',
    weight: 3,
    keywords: ['Bash scripts', 'Raspberry Pi', 'Bare Metal'],
  },
  {
    text: 'Hipster stack. You definitely argue about coffee brewing methods too.',
    color: 'bg-purple-500',
    emoji: '☕',
    weight: 2,
    keywords: ['Pulumi', 'Crossplane', 'Drone CI'],
  },
  {
    text: 'Classic enterprise setup: slow, reliable, and will survive a nuclear apocalypse.',
    color: 'bg-gray-500',
    emoji: '🦖',
    weight: 2,
    keywords: ['Jenkins', 'Puppet', 'IBM Cloud'],
  },
  {
    text: 'Modern cloud-native dream team. Your clusters probably self-heal.',
    color: 'bg-teal-500',
    emoji: '☁️',
    weight: 2,
    keywords: ['Kubernetes', 'Helm', 'AWS', 'GCP', 'Azure'],
  },
  {
    text: 'Your DevOps budget is clearly bigger than your feature budget.',
    color: 'bg-yellow-500',
    emoji: '💰',
    weight: 1,
    keywords: ['Spinnaker', 'TeamCity', 'Oracle Cloud'],
  },
  {
    text: "The 'it works on my machine' special. Good luck in production!",
    color: 'bg-orange-500',
    emoji: '🤷',
    weight: 3,
    keywords: ['Bash scripts', 'Bare Metal'],
  },
  {
    text: 'Startup stack supreme. Move fast and break... fewer things.',
    color: 'bg-emerald-500',
    emoji: '⚡',
    weight: 2,
    keywords: ['GitHub Actions', 'DigitalOcean', 'Terraform'],
  },
  {
    text: 'The time traveler special. Welcome to 2015!',
    color: 'bg-amber-500',
    emoji: '⏰',
    weight: 2,
    keywords: ['Travis CI', 'Chef', 'Heroku'],
  },
  {
    text: 'Maximum enterprise buzzword compliance achieved!',
    color: 'bg-blue-600',
    emoji: '👔',
    weight: 1,
    keywords: ['Jenkins', 'IBM Cloud', 'Ansible'],
  },
  {
    text: "The 'we wish we could afford cloud' setup.",
    color: 'bg-rose-500',
    emoji: '💸',
    weight: 2,
    keywords: ['Raspberry Pi', 'Bare Metal'],
  },
  {
    text: 'DevOps conference speaker starter pack!',
    color: 'bg-purple-600',
    emoji: '🎤',
    weight: 1,
    keywords: ['GitLab CI', 'Kubernetes', 'Terraform'],
  },
  {
    text: 'Container orchestration overload. You probably have a Kubernetes tattoo.',
    color: 'bg-cyan-500',
    emoji: '🐳',
    weight: 2,
    keywords: ['Kubernetes', 'Helm', 'Argo CD'],
  },
  {
    text: 'The reliable workhorse. Boring but bulletproof.',
    color: 'bg-slate-600',
    emoji: '🐎',
    weight: 3,
    keywords: ['Jenkins', 'AWS', 'Ansible'],
  },
  {
    text: 'GitOps guru detected. Everything is code, including your breakfast.',
    color: 'bg-indigo-600',
    emoji: '📝',
    weight: 2,
    keywords: ['Argo CD', 'GitLab CI', 'Terraform'],
  },
  {
    text: 'The minimalist approach. Less is more... until it breaks.',
    color: 'bg-stone-500',
    emoji: '🎯',
    weight: 2,
    keywords: ['Heroku', 'GitHub Actions'],
  },
  {
    text: 'Infrastructure as code perfectionist. Your YAML is probably beautiful.',
    color: 'bg-green-600',
    emoji: '✨',
    weight: 2,
    keywords: ['Terraform', 'Pulumi', 'CloudFormation'],
  },
  {
    text: 'The Swiss Army knife approach. One tool for everything!',
    color: 'bg-red-600',
    emoji: '🔧',
    weight: 2,
    keywords: ['GitLab CI', 'Ansible'],
  },
  // Catch-all ratings with higher probability
  {
    text: 'Solid choice! Your future self will thank you... probably.',
    color: 'bg-blue-500',
    emoji: '👍',
    weight: 4,
    keywords: [],
  },
  {
    text: 'Interesting combo! This could either be genius or chaos.',
    color: 'bg-indigo-500',
    emoji: '🤔',
    weight: 4,
    keywords: [],
  },
  {
    text: "Not bad! You clearly know what you're doing.",
    color: 'bg-green-500',
    emoji: '😎',
    weight: 4,
    keywords: [],
  },
  {
    text: "Creative stack! You're definitely thinking outside the box.",
    color: 'bg-purple-500',
    emoji: '🎨',
    weight: 4,
    keywords: [],
  },
];

export default function CICDStackGenerator() {
  const [reels, setReels] = useState([
    { spinning: false, value: CI_CD_TOOLS[0], displayItems: [...CI_CD_TOOLS] },
    { spinning: false, value: INFRASTRUCTURE_TOOLS[0], displayItems: [...INFRASTRUCTURE_TOOLS] },
    { spinning: false, value: CLOUD_PLATFORMS[0], displayItems: [...CLOUD_PLATFORMS] },
  ]);
  const [rating, setRating] = useState(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinCount, setSpinCount] = useState(0);
  const [spinHistory, setSpinHistory] = useState([]);

  // Shuffle function
  const shuffleArray = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // Get rating based on combo
  const getRating = (combo) => {
    // Find ratings that match keywords
    const matchingRatings = FUNNY_RATINGS.filter((rating) => {
      if (rating.keywords.length === 0) return true; // Catch-all ratings
      return rating.keywords.some((keyword) => combo.includes(keyword));
    });

    // If no specific matches, use catch-all ratings
    const ratingsToChooseFrom =
      matchingRatings.length > 0
        ? matchingRatings
        : FUNNY_RATINGS.filter((r) => r.keywords.length === 0);

    // Weighted random selection
    const weightedRatings = [];
    ratingsToChooseFrom.forEach((rating) => {
      for (let i = 0; i < rating.weight; i++) {
        weightedRatings.push(rating);
      }
    });

    return weightedRatings[Math.floor(Math.random() * weightedRatings.length)];
  };

  // Start spinning
  const startSpin = () => {
    if (isSpinning) return;

    setSpinCount((prev) => prev + 1);
    setIsSpinning(true);
    setRating(null);

    // Start all reels spinning with lots of items
    setReels((prevReels) =>
      prevReels.map((reel, index) => {
        const sourceArray =
          index === 0 ? CI_CD_TOOLS : index === 1 ? INFRASTRUCTURE_TOOLS : CLOUD_PLATFORMS;

        // Create a long list of items for smooth spinning
        const spinItems = [];
        for (let i = 0; i < 8; i++) {
          spinItems.push(...shuffleArray([...sourceArray]));
        }

        return {
          ...reel,
          spinning: true,
          displayItems: spinItems,
        };
      })
    );

    // Stop reels at different times for authentic feel
    [2000, 2800, 3600].forEach((delay, index) => {
      setTimeout(() => stopReel(index), delay);
    });
  };

  // Stop a specific reel
  const stopReel = (index) => {
    const sourceArray =
      index === 0 ? CI_CD_TOOLS : index === 1 ? INFRASTRUCTURE_TOOLS : CLOUD_PLATFORMS;

    const randomValue = sourceArray[Math.floor(Math.random() * sourceArray.length)];

    setReels((prevReels) => {
      const newReels = [...prevReels];
      newReels[index] = {
        ...newReels[index],
        spinning: false,
        value: randomValue,
      };

      // Check if all reels have stopped
      if (newReels.every((reel) => !reel.spinning)) {
        setTimeout(() => {
          const combo = newReels.map((reel) => reel.value);
          const newRating = getRating(combo);
          setRating(newRating);
          setIsSpinning(false);

          // Save to history
          setSpinHistory((prev) => [{ combo, rating: newRating }, ...prev.slice(0, 4)]);
        }, 500);
      }

      return newReels;
    });
  };

  // Share functionality
  const shareResult = () => {
    if (!rating) return;

    const combo = reels.map((r) => r.value).join(' | ');
    const text = encodeURIComponent(
      `I spun the CI/CD Stack Generator and got: ${combo}. The verdict: ${rating.emoji} ${rating.text} Try your luck at DevOps Daily!`
    );
    const url = encodeURIComponent(window.location.href);

    // Create sharing popup
    const sharePopup = document.createElement('div');
    sharePopup.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
    sharePopup.innerHTML = `
      <div class="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-sm w-full shadow-xl">
        <h3 class="text-lg font-semibold mb-4 text-center">Share Your Stack</h3>
        <div class="flex justify-center gap-4 mb-4">
          <a href="https://twitter.com/intent/tweet?text=${text}&url=${url}" 
             target="_blank" rel="noopener noreferrer"
             class="flex items-center justify-center w-12 h-12 bg-[#1DA1F2] text-white rounded-full hover:bg-[#1a91da] transition-colors">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
          <a href="https://www.linkedin.com/sharing/share-offsite/?url=${url}" 
             target="_blank" rel="noopener noreferrer"
             class="flex items-center justify-center w-12 h-12 bg-[#0A66C2] text-white rounded-full hover:bg-[#095fb8] transition-colors">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </a>
          <button onclick="navigator.clipboard.writeText(decodeURIComponent('${text}'))" 
                  class="flex items-center justify-center w-12 h-12 bg-gray-600 text-white rounded-full hover:bg-gray-700 transition-colors">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
            </svg>
          </button>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" 
                class="w-full py-2 px-4 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors">
          Close
        </button>
      </div>
    `;

    document.body.appendChild(sharePopup);

    // Close on backdrop click
    sharePopup.addEventListener('click', (e) => {
      if (e.target === sharePopup) {
        sharePopup.remove();
      }
    });
  };

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto my-8">
      <h1 className="text-3xl md:text-4xl font-bold mb-4 text-center">
        <span className="text-transparent bg-clip-text bg-linear-to-r from-green-500 via-blue-500 to-purple-500">
          CI/CD Stack Generator
        </span>
      </h1>

      <p className="text-center text-muted-foreground mb-8 max-w-2xl">
        Spin the wheels to get your perfect (or perfectly cursed) DevOps stack!
      </p>

      {/* Slot Machine */}
      <div className="relative w-full max-w-2xl bg-linear-to-b from-slate-800 to-slate-950 rounded-xl shadow-2xl border border-slate-700 p-6 mb-6">
        {/* Top decoration */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-3 w-32 h-6 bg-slate-700 rounded-full flex items-center justify-center">
          <div className="w-24 h-4 bg-linear-to-r from-red-500 via-amber-500 to-green-500 rounded-full animate-pulse"></div>
        </div>

        {/* Reels Container */}
        <div className="relative bg-slate-900 rounded-lg p-4 mb-6 overflow-hidden min-h-[200px]">
          {/* Selection highlight */}
          <div className="absolute left-0 right-0 top-1/2 h-16 -translate-y-1/2 bg-primary/20 border-y-2 border-primary/50 z-10 pointer-events-none rounded"></div>

          {/* Column separators */}
          <div className="absolute left-1/3 top-0 bottom-0 w-px bg-slate-700 z-10"></div>
          <div className="absolute left-2/3 top-0 bottom-0 w-px bg-slate-700 z-10"></div>

          {/* Column Headers */}
          <div className="grid grid-cols-3 gap-0 mb-2">
            <div className="text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
              CI/CD Tool
            </div>
            <div className="text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
              Infrastructure
            </div>
            <div className="text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
              Platform
            </div>
          </div>

          <div className="grid grid-cols-3 gap-0">
            {reels.map((reel, index) => (
              <div key={index} className="h-48 overflow-hidden bg-slate-800 relative">
                <AnimatePresence mode="wait">
                  {reel.spinning ? (
                    <motion.div
                      key={`spinning-${index}`}
                      className="absolute inset-0 flex flex-col"
                      initial={{ y: 0 }}
                      animate={{ y: -800 }}
                      transition={{
                        duration: 2.5,
                        ease: 'linear',
                        repeat: Infinity,
                      }}
                    >
                      {reel.displayItems.map((item, itemIndex) => (
                        <div
                          key={itemIndex}
                          className="h-12 flex items-center justify-center px-2 text-center font-medium text-white/90 text-sm leading-tight shrink-0 border-b border-slate-700/50"
                        >
                          {item}
                        </div>
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div
                      key={`stopped-${index}-${reel.value}`}
                      initial={{ scale: 0.8, opacity: 0, y: 20 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      transition={{
                        type: 'spring',
                        stiffness: 200,
                        damping: 20,
                      }}
                      className="h-full flex items-center justify-center text-center font-bold text-primary text-lg px-2 leading-tight"
                    >
                      {reel.value}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Subtle gradient overlay to create depth */}
                <div className="absolute inset-0 bg-linear-to-b from-slate-800/20 via-transparent to-slate-800/20 pointer-events-none" />
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-between items-center">
          <Button
            onClick={startSpin}
            disabled={isSpinning}
            size="lg"
            className={cn(
              'px-8 font-bold text-lg bg-linear-to-r from-amber-500 to-red-500 hover:from-amber-400 hover:to-red-400 shadow-lg',
              isSpinning && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isSpinning ? (
              <span className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <RefreshCcw className="h-5 w-5" />
                </motion.div>
                Spinning...
              </span>
            ) : (
              `${spinCount === 0 ? 'GENERATE STACK!' : 'SPIN AGAIN!'}`
            )}
          </Button>

          <Button
            variant="outline"
            size="lg"
            disabled={!rating}
            onClick={shareResult}
            className={cn(
              'border-slate-600 hover:bg-slate-800',
              !rating && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>
      </div>

      {/* Results */}
      <AnimatePresence mode="wait">
        {rating && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="w-full max-w-2xl"
          >
            <div
              className={cn(
                'rounded-xl p-8 text-white text-center shadow-xl border border-white/20',
                rating.color
              )}
            >
              <motion.div
                className="text-6xl mb-4"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              >
                {rating.emoji}
              </motion.div>
              <h3 className="text-2xl font-bold mb-3">Your Stack Rating</h3>
              <p className="text-lg leading-relaxed">{rating.text}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spin History */}
      {spinHistory.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full max-w-2xl mt-8"
        >
          <h3 className="text-lg font-semibold mb-4 text-center text-muted-foreground">
            Recent Spins
          </h3>
          <div className="space-y-3">
            {spinHistory.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-muted/50 rounded-lg p-4 flex items-center gap-3 backdrop-blur-sm"
              >
                <div
                  className={`w-8 h-8 rounded-full ${item.rating.color} flex items-center justify-center shrink-0 text-lg`}
                >
                  {item.rating.emoji}
                </div>
                <div className="flex-1 text-sm">
                  <div className="font-medium">{item.combo.join(' + ')}</div>
                  <div className="text-muted-foreground text-xs mt-1">{item.rating.text}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
