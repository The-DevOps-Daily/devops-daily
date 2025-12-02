'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Share2,
  RotateCcw,
  Trophy,
  Star,
  TrendingUp,
  Target,
  Award,
  Sparkles,
  BarChart3,
  User,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Simple Progress component
const Progress = ({ value, className }: { value: number; className?: string }) => (
  <div className={cn('w-full bg-secondary rounded-full h-2', className)}>
    <div
      className="bg-primary h-2 rounded-full transition-all duration-300"
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

interface Skill {
  name: string;
  description?: string;
  score: number;
}

interface Category {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  skills: Skill[];
}

const SCORECARD_DATA: Category[] = [
  {
    id: 'foundational',
    name: 'Foundational Knowledge',
    icon: <Target className="h-5 w-5" />,
    color: 'from-blue-500 to-cyan-500',
    skills: [
      { name: 'Linux/Unix System Administration', score: 0 },
      { name: 'Networking Fundamentals (DNS, TCP/IP, HTTP)', score: 0 },
      { name: 'Scripting (Bash, Python, etc.)', score: 0 },
      { name: 'Version Control (Git, branching strategies)', score: 0 },
      { name: 'Agile and CI/CD Principles', score: 0 },
    ],
  },
  {
    id: 'iac',
    name: 'Infrastructure as Code',
    icon: <BarChart3 className="h-5 w-5" />,
    color: 'from-purple-500 to-pink-500',
    skills: [
      { name: 'Terraform or CloudFormation', score: 0 },
      { name: 'Ansible, Chef, or Puppet', score: 0 },
      { name: 'Kubernetes & Helm', score: 0 },
      { name: 'Docker and Containerization', score: 0 },
      { name: 'YAML/JSON configuration management', score: 0 },
    ],
  },
  {
    id: 'cloud',
    name: 'Cloud Platforms',
    icon: <Star className="h-5 w-5" />,
    color: 'from-green-500 to-emerald-500',
    skills: [
      { name: 'AWS (EC2, S3, IAM, RDS, etc.)', score: 0 },
      { name: 'Azure or Google Cloud Platform (GCP)', score: 0 },
      { name: 'Multi-cloud or hybrid cloud setups', score: 0 },
      { name: 'Cloud cost optimization (FinOps)', score: 0 },
    ],
  },
  {
    id: 'cicd',
    name: 'CI/CD Pipelines',
    icon: <TrendingUp className="h-5 w-5" />,
    color: 'from-orange-500 to-red-500',
    skills: [
      { name: 'Jenkins, GitLab CI, GitHub Actions', score: 0 },
      { name: 'Automated testing (unit, integration, etc)', score: 0 },
      { name: 'Deployment Strategies (blue-green, canary, etc)', score: 0 },
      { name: 'Monitoring and rollback mechanisms', score: 0 },
    ],
  },
  {
    id: 'monitoring',
    name: 'Monitoring and Logging',
    icon: <Trophy className="h-5 w-5" />,
    color: 'from-teal-500 to-blue-500',
    skills: [
      { name: 'Prometheus and Grafana', score: 0 },
      { name: 'ELK/EFK stack (Elasticsearch, Logstash/Fluentd, Kibana)', score: 0 },
      { name: 'Distributed Tracing (Jaeger, OpenTelemetry)', score: 0 },
      { name: 'Incident response and on-call practices', score: 0 },
    ],
  },
  {
    id: 'security',
    name: 'Security and Compliance',
    icon: <Award className="h-5 w-5" />,
    color: 'from-red-500 to-pink-500',
    skills: [
      { name: 'Secrets management (Vault, AWS Secrets Manager)', score: 0 },
      { name: 'Secure CI/CD pipelines', score: 0 },
      { name: 'Vulnerability Scanning (Snyk, Trivy, etc)', score: 0 },
      { name: 'Compliance frameworks (SOC 2, GDPR, etc)', score: 0 },
    ],
  },
  {
    id: 'soft',
    name: 'Soft Skills',
    icon: <User className="h-5 w-5" />,
    color: 'from-indigo-500 to-purple-500',
    skills: [
      { name: 'Communication and Collaboration', score: 0 },
      { name: 'Problem-solving and troubleshooting', score: 0 },
      { name: 'Documentation and knowledge sharing', score: 0 },
      { name: 'Mentoring and leadership', score: 0 },
    ],
  },
  {
    id: 'advanced',
    name: 'Advanced Topics',
    icon: <Sparkles className="h-5 w-5" />,
    color: 'from-violet-500 to-purple-500',
    skills: [
      { name: 'Site Reliability Engineering (SRE) practices', score: 0 },
      { name: 'Chaos Engineering', score: 0 },
      { name: 'Service Mesh (Istio, Linkerd)', score: 0 },
      { name: 'Event-driven Architecture (Kafka, RabbitMQ)', score: 0 },
    ],
  },
];

const SKILL_LEVELS = {
  1: { label: 'Beginner', description: 'Learning the basics', color: 'bg-red-500' },
  2: { label: 'Novice', description: 'Some hands-on experience', color: 'bg-orange-500' },
  3: {
    label: 'Intermediate',
    description: 'Comfortable with day-to-day tasks',
    color: 'bg-yellow-500',
  },
  4: {
    label: 'Advanced',
    description: 'Can mentor others and solve complex problems',
    color: 'bg-blue-500',
  },
  5: {
    label: 'Expert',
    description: 'Industry leader, innovating and teaching',
    color: 'bg-green-500',
  },
};

export default function DevOpsScorecard() {
  const [categories, setCategories] = useState<Category[]>(SCORECARD_DATA);
  const [currentStep, setCurrentStep] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [userName, setUserName] = useState('');
  const [userTitle, setUserTitle] = useState('');

  // Calculate scores
  const calculateCategoryScore = (category: Category) => {
    const totalScore = category.skills.reduce((sum, skill) => sum + skill.score, 0);
    const maxScore = category.skills.length * 5;
    return maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  };

  const calculateOverallScore = () => {
    const totalScore = categories.reduce(
      (sum, category) =>
        sum + category.skills.reduce((skillSum, skill) => skillSum + skill.score, 0),
      0
    );
    const maxScore = categories.reduce((sum, category) => sum + category.skills.length * 5, 0);
    return maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  };

  const getScoreLevel = (score: number) => {
    if (score >= 90) return { level: 'Expert', color: 'text-green-500', icon: '🚀' };
    if (score >= 75) return { level: 'Advanced', color: 'text-blue-500', icon: '⭐' };
    if (score >= 60) return { level: 'Intermediate', color: 'text-yellow-500', icon: '👍' };
    if (score >= 40) return { level: 'Developing', color: 'text-orange-500', icon: '📈' };
    return { level: 'Beginner', color: 'text-red-500', icon: '🌱' };
  };

  // Update skill score
  const updateSkillScore = (categoryId: string, skillIndex: number, score: number) => {
    setCategories((prev) =>
      prev.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              skills: category.skills.map((skill, index) =>
                index === skillIndex ? { ...skill, score } : skill
              ),
            }
          : category
      )
    );
  };

  // Reset scorecard
  const resetScorecard = () => {
    setCategories(SCORECARD_DATA);
    setCurrentStep(0);
    setShowResults(false);
    setUserName('');
    setUserTitle('');
  };

  // Generate scorecard
  const generateScorecard = () => {
    setShowResults(true);
  };

  // Share functionality
  const shareScorecard = () => {
    const overallScore = calculateOverallScore();
    const { level } = getScoreLevel(overallScore);

    const text = encodeURIComponent(
      `I just completed my DevOps Scorecard! 🚀\n\nOverall Level: ${level} (${overallScore.toFixed(1)}%)\n\nCheck your DevOps skills at DevOps Daily!`
    );
    const url = encodeURIComponent(window.location.href);

    // Create sharing popup
    const sharePopup = document.createElement('div');
    sharePopup.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
    sharePopup.innerHTML = `
      <div class="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-sm w-full shadow-xl">
        <h3 class="text-lg font-semibold mb-4 text-center">Share Your DevOps Scorecard</h3>
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

  if (showResults) {
    const overallScore = calculateOverallScore();
    const { level, color, icon } = getScoreLevel(overallScore);

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Results Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="text-6xl mb-4">{icon}</div>
          <h2 className="text-4xl font-bold">Your DevOps Scorecard</h2>
          {userName && (
            <div className="text-lg text-muted-foreground">
              {userName} {userTitle && `• ${userTitle}`}
            </div>
          )}
          <div className="flex items-center justify-center gap-2 text-lg">
            <span className="text-muted-foreground">Overall Level:</span>
            <span className={cn('font-bold text-2xl', color)}>{level}</span>
            <Badge variant="outline" className="text-lg px-3 py-1">
              {overallScore.toFixed(1)}%
            </Badge>
          </div>
        </motion.div>

        {/* Category Results */}
        <div className="grid gap-6 md:grid-cols-2">
          {categories.map((category, index) => {
            const categoryScore = calculateCategoryScore(category);
            const categoryLevel = getScoreLevel(categoryScore);

            return (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn('p-2 rounded-lg bg-linear-to-r text-white', category.color)}
                      >
                        {category.icon}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{category.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={categoryScore} className="flex-1 h-2" />
                          <Badge variant="outline" className="text-xs">
                            {categoryScore.toFixed(0)}%
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {category.skills.map((skill, skillIndex) => (
                        <div key={skillIndex} className="flex items-center justify-between text-sm">
                          <span className="flex-1 truncate">{skill.name}</span>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((rating) => (
                              <div
                                key={rating}
                                className={cn(
                                  'w-3 h-3 rounded-full',
                                  skill.score >= rating ? 'bg-primary' : 'bg-muted'
                                )}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className={cn('text-center mt-3 font-medium', categoryLevel.color)}>
                      {categoryLevel.level}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex gap-4 justify-center flex-wrap"
        >
          <Button
            onClick={shareScorecard}
            size="lg"
            className="bg-linear-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
          >
            <Share2 className="mr-2 h-4 w-4" />
            Share Results
          </Button>
          <Button onClick={resetScorecard} variant="outline" size="lg">
            <RotateCcw className="mr-2 h-4 w-4" />
            Take Again
          </Button>
        </motion.div>

        {/* Date stamp */}
        <div className="text-center text-sm text-muted-foreground">
          <Calendar className="inline-block mr-1 h-4 w-4" />
          Completed on {new Date().toLocaleDateString()}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <h2 className="text-4xl md:text-5xl font-bold bg-linear-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
          DevOps Scorecard
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Evaluate your DevOps skills across 8 key areas and discover your strengths and growth
          opportunities
        </p>

        {/* User Info */}
        <div className="max-w-md mx-auto space-y-3">
          <input
            type="text"
            placeholder="Your name (optional)"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            type="text"
            placeholder="Your title (optional)"
            value={userTitle}
            onChange={(e) => setUserTitle(e.target.value)}
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </motion.div>

      {/* Categories */}
      <div className="space-y-6">
        {categories.map((category, categoryIndex) => (
          <motion.div
            key={category.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: categoryIndex * 0.1 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={cn('p-3 rounded-lg bg-linear-to-r text-white', category.color)}>
                    {category.icon}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-xl">{category.name}</CardTitle>
                    <CardDescription>
                      Rate your experience level (1 = Beginner, 5 = Expert)
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-sm">
                    {calculateCategoryScore(category).toFixed(0)}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {category.skills.map((skill, skillIndex) => (
                    <div key={skillIndex} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium flex-1">{skill.name}</label>
                        {skill.score > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {SKILL_LEVELS[skill.score as keyof typeof SKILL_LEVELS]?.label}
                          </Badge>
                        )}
                      </div>

                      {/* Rating buttons */}
                      <div className="flex gap-2 flex-wrap">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <motion.button
                            key={rating}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => updateSkillScore(category.id, skillIndex, rating)}
                            className={cn(
                              'flex-1 min-w-12 h-12 rounded-lg border-2 transition-all flex items-center justify-center font-bold',
                              skill.score === rating
                                ? cn(
                                    'text-white',
                                    SKILL_LEVELS[rating as keyof typeof SKILL_LEVELS]?.color
                                  )
                                : 'border-border hover:border-primary bg-background'
                            )}
                            aria-label={`Rate ${skill.name} as ${SKILL_LEVELS[rating as keyof typeof SKILL_LEVELS]?.label}`}
                          >
                            {rating}
                          </motion.button>
                        ))}
                      </div>

                      {/* Show level description when rated */}
                      {skill.score > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="text-xs text-muted-foreground"
                        >
                          {SKILL_LEVELS[skill.score as keyof typeof SKILL_LEVELS]?.description}
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Generate Button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="sticky bottom-6 flex justify-center"
      >
        <Button
          onClick={generateScorecard}
          size="lg"
          className="bg-linear-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-lg"
          disabled={categories.every((cat) => cat.skills.every((skill) => skill.score === 0))}
        >
          <Trophy className="mr-2 h-4 w-4" />
          Generate My Scorecard
        </Button>
      </motion.div>
    </div>
  );
}
