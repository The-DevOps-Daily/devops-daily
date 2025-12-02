#!/usr/bin/env node

// Usage: npx tsx scripts/quiz-dev.ts <command> [options]

import fs from 'fs/promises';
import path from 'path';
import { validateAllQuizzes, validateQuizConfig } from '../lib/quiz-validation';
import type { QuizConfig } from '../lib/quiz-types';

const QUIZZES_DIR = path.join(process.cwd(), 'content', 'quizzes');
const GAMES_DIR = path.join(process.cwd(), 'app', 'games');

// ANSI color codes for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'validate':
      await validateCommand(args.slice(1));
      break;
    case 'create':
      await createCommand(args.slice(1));
      break;
    case 'list':
      await listCommand();
      break;
    case 'stats':
      await statsCommand(args.slice(1));
      break;
    case 'help':
    default:
      showHelp();
      break;
  }
}

async function validateCommand(args: string[]) {
  console.log(colorize('🔍 Validating quiz configurations...', 'blue'));
  console.log();

  const results = await validateAllQuizzes(QUIZZES_DIR);
  let hasErrors = false;

  for (const [filename, result] of Object.entries(results)) {
    const quizName = filename.replace('.json', '');

    if (result.isValid) {
      console.log(colorize(`✅ ${quizName}`, 'green'));
    } else {
      console.log(colorize(`❌ ${quizName}`, 'red'));
      hasErrors = true;
    }

    // Show errors
    result.errors.forEach((error) => {
      console.log(colorize(`   ERROR: ${error.path} - ${error.message}`, 'red'));
    });

    // Show warnings
    result.warnings.forEach((warning) => {
      console.log(colorize(`   WARN:  ${warning.path} - ${warning.message}`, 'yellow'));
    });

    if (result.errors.length > 0 || result.warnings.length > 0) {
      console.log();
    }
  }

  if (hasErrors) {
    console.log(colorize('❌ Validation failed! Please fix the errors above.', 'red'));
    process.exit(1);
  } else {
    console.log(colorize('✅ All quiz configurations are valid!', 'green'));
  }
}

async function createCommand(args: string[]) {
  const quizId = args[0];

  if (!quizId) {
    console.log(colorize('❌ Please provide a quiz ID: npm run quiz:create <quiz-id>', 'red'));
    return;
  }

  console.log(colorize(`🆕 Creating new quiz: ${quizId}`, 'blue'));

  // Interactive prompts would go here - for now, create a template
  const template = createQuizTemplate(quizId);

  // Create quiz configuration file
  const configPath = path.join(QUIZZES_DIR, `${quizId}.json`);
  await fs.writeFile(configPath, JSON.stringify(template, null, 2));

  console.log(colorize(`✅ Quiz created successfully!`, 'green'));
  console.log(colorize(`   Config: ${configPath}`, 'cyan'));
  console.log();
  console.log(colorize('Next steps:', 'yellow'));
  console.log('1. Edit the quiz configuration with your questions');
  console.log('2. Add the route mapping in lib/quiz-utils.ts');
}

async function listCommand() {
  console.log(colorize('📚 Available Quizzes', 'blue'));
  console.log();

  try {
    const files = await fs.readdir(QUIZZES_DIR);
    const quizFiles = files.filter((f) => f.endsWith('.json'));

    if (quizFiles.length === 0) {
      console.log(colorize('No quizzes found in content/quizzes/', 'yellow'));
      return;
    }

    for (const file of quizFiles) {
      try {
        const content = await fs.readFile(path.join(QUIZZES_DIR, file), 'utf-8');
        const config = JSON.parse(content) as QuizConfig;

        console.log(colorize(`📖 ${config.title}`, 'green'));
        console.log(`   ID: ${config.id}`);
        console.log(`   Category: ${config.category}`);
        console.log(`   Questions: ${config.questions.length}`);
        console.log(`   Points: ${config.totalPoints || 'auto'}`);
        console.log(`   Time: ${config.metadata.estimatedTime}`);
        console.log();
      } catch (error) {
        console.log(colorize(`❌ ${file} - Invalid JSON`, 'red'));
      }
    }
  } catch (error) {
    console.log(colorize('❌ Could not read quizzes directory', 'red'));
  }
}

async function statsCommand(args: string[]) {
  const quizId = args[0];

  if (quizId) {
    await showQuizStats(quizId);
  } else {
    await showAllStats();
  }
}

async function showQuizStats(quizId: string) {
  try {
    const configPath = path.join(QUIZZES_DIR, `${quizId}.json`);
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content) as QuizConfig;

    console.log(colorize(`📊 Quiz Statistics: ${config.title}`, 'blue'));
    console.log();

    const difficulties = config.questions.map((q) => q.difficulty);
    const points = config.questions.map((q) => q.points);
    const difficultyCount = {
      beginner: difficulties.filter((d) => d === 'beginner').length,
      intermediate: difficulties.filter((d) => d === 'intermediate').length,
      advanced: difficulties.filter((d) => d === 'advanced').length,
    };

    console.log(colorize('Basic Info:', 'cyan'));
    console.log(`  Total Questions: ${config.questions.length}`);
    console.log(`  Total Points: ${config.totalPoints || points.reduce((sum, p) => sum + p, 0)}`);
    console.log(
      `  Average Points: ${Math.round(points.reduce((sum, p) => sum + p, 0) / config.questions.length)}`
    );
    console.log(`  Estimated Time: ${config.metadata.estimatedTime}`);
    console.log();

    console.log(colorize('Difficulty Breakdown:', 'cyan'));
    console.log(
      `  Beginner: ${difficultyCount.beginner} (${Math.round((difficultyCount.beginner / config.questions.length) * 100)}%)`
    );
    console.log(
      `  Intermediate: ${difficultyCount.intermediate} (${Math.round((difficultyCount.intermediate / config.questions.length) * 100)}%)`
    );
    console.log(
      `  Advanced: ${difficultyCount.advanced} (${Math.round((difficultyCount.advanced / config.questions.length) * 100)}%)`
    );
    console.log();

    console.log(colorize('Questions:', 'cyan'));
    config.questions.forEach((q, i) => {
      const difficultyColor =
        q.difficulty === 'beginner' ? 'green' : q.difficulty === 'intermediate' ? 'yellow' : 'red';
      console.log(
        `  ${i + 1}. ${q.title} (${colorize(q.difficulty, difficultyColor)}, ${q.points}pts)`
      );
    });
  } catch (error) {
    console.log(colorize(`❌ Could not find quiz: ${quizId}`, 'red'));
  }
}

async function showAllStats() {
  console.log(colorize('📊 Quiz System Statistics', 'blue'));
  console.log();

  try {
    const files = await fs.readdir(QUIZZES_DIR);
    const quizFiles = files.filter((f) => f.endsWith('.json'));

    let totalQuestions = 0;
    let totalPoints = 0;
    const categories = new Set<string>();
    const difficulties = { beginner: 0, intermediate: 0, advanced: 0 };

    for (const file of quizFiles) {
      try {
        const content = await fs.readFile(path.join(QUIZZES_DIR, file), 'utf-8');
        const config = JSON.parse(content) as QuizConfig;

        totalQuestions += config.questions.length;
        totalPoints += config.totalPoints || config.questions.reduce((sum, q) => sum + q.points, 0);
        categories.add(config.category);

        config.questions.forEach((q) => {
          difficulties[q.difficulty]++;
        });
      } catch (error) {
        console.log(colorize(`❌ Error processing ${file}`, 'red'));
      }
    }

    console.log(colorize('Overview:', 'cyan'));
    console.log(`  Total Quizzes: ${quizFiles.length}`);
    console.log(`  Total Questions: ${totalQuestions}`);
    console.log(`  Total Points: ${totalPoints}`);
    console.log(`  Categories: ${Array.from(categories).join(', ')}`);
    console.log();

    console.log(colorize('Difficulty Distribution:', 'cyan'));
    console.log(
      `  Beginner: ${difficulties.beginner} (${Math.round((difficulties.beginner / totalQuestions) * 100)}%)`
    );
    console.log(
      `  Intermediate: ${difficulties.intermediate} (${Math.round((difficulties.intermediate / totalQuestions) * 100)}%)`
    );
    console.log(
      `  Advanced: ${difficulties.advanced} (${Math.round((difficulties.advanced / totalQuestions) * 100)}%)`
    );
  } catch (error) {
    console.log(colorize('❌ Could not analyze quiz statistics', 'red'));
  }
}

function createQuizTemplate(quizId: string): QuizConfig {
  const title =
    quizId
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') + ' Quiz';

  return {
    id: quizId,
    title,
    description: `Test your knowledge of ${quizId.replace('-', ' ')} with practical scenarios and best practices`,
    category: quizId.split('-')[0].charAt(0).toUpperCase() + quizId.split('-')[0].slice(1),
    icon: 'Code',
    totalPoints: 30,
    theme: {
      primaryColor: 'blue',
      gradientFrom: 'from-blue-500',
      gradientTo: 'to-cyan-600',
    },
    metadata: {
      estimatedTime: '10-15 minutes',
      difficultyLevels: {
        beginner: 2,
        intermediate: 1,
        advanced: 0,
      },
    },
    questions: [
      {
        id: 'sample-question-1',
        title: 'Sample Question 1',
        description: 'This is a sample question to get you started.',
        situation: 'You need to solve a common problem in your domain.',
        options: [
          'Option A - Incorrect approach',
          'Option B - Correct approach',
          'Option C - Another incorrect approach',
          'Option D - Yet another incorrect approach',
        ],
        correctAnswer: 1,
        explanation:
          'Option B is correct because it follows best practices and solves the problem efficiently.',
        hint: 'Think about the most straightforward and maintainable solution.',
        difficulty: 'beginner',
        points: 10,
      },
      {
        id: 'sample-question-2',
        title: 'Sample Question 2',
        description: 'This is another sample question.',
        codeExample: '// Example code snippet\nconst example = "value";',
        options: ['First option', 'Second option', 'Third option', 'Fourth option'],
        correctAnswer: 0,
        explanation: 'Detailed explanation of why the first option is correct.',
        difficulty: 'intermediate',
        points: 15,
      },
      {
        id: 'sample-question-3',
        title: 'Sample Question 3',
        description: 'A third sample question to round out the template.',
        options: ['Option A', 'Option B', 'Option C'],
        correctAnswer: 2,
        explanation: 'Explanation for the third option being correct.',
        hint: 'Consider the edge cases and error handling.',
        difficulty: 'beginner',
        points: 5,
      },
    ],
  };
}

function createPageTemplate(quizId: string, config: QuizConfig): string {
  const componentName = quizId
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  return `import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import GenericQuiz from '@/components/games/generic-quiz';
import { getQuizById } from '@/lib/quiz-loader';
import { ArrowLeft, Twitter, Facebook, Linkedin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: '${config.title} - Learn ${config.category} Concepts',
  description: '${config.description}',
  openGraph: {
    title: '${config.title} - DevOps Daily',
    description: '${config.description}',
    type: 'website',
    images: [
      {
        url: '/images/games/${quizId}-og.svg',
        width: 1200,
        height: 630,
        alt: '${config.title}',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '${config.title} - DevOps Daily',
    description: '${config.description}',
    images: ['/images/games/${quizId}-og.svg'],
  },
};

export default async function ${componentName}QuizPage() {
  // Load the quiz configuration
  const quizConfig = await getQuizById('${quizId}');
  
  if (!quizConfig) {
    notFound();
  }

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: '${config.title}', href: '/games/${quizId}-quiz', isCurrent: true },
  ];

  // Breadcrumb items for schema
  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: '${config.title}', url: '/games/${quizId}-quiz' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container mx-auto px-4 py-8">
        <Breadcrumb items={breadcrumbItems} />

        <div className="flex flex-col items-center max-w-6xl mx-auto">
          {/* Quiz Component */}
          <GenericQuiz quizConfig={quizConfig} />

          {/* Share buttons */}
          <div className="my-8 w-full max-w-md">
            <h3 className="text-center text-lg font-medium mb-4">Share this quiz</h3>
            <div className="flex justify-center gap-4">
              <a
                href={\`https://twitter.com/intent/tweet?text=\${encodeURIComponent('Test your ${config.category} skills with this interactive quiz!')}&url=\${encodeURIComponent('https://devops-daily.com/games/${quizId}-quiz')}\`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1DA1F2] text-white rounded-full hover:bg-[#1a91da] transition-colors"
              >
                <Twitter size={20} />
                <span className="sr-only">Share on Twitter</span>
              </a>
              <a
                href={\`https://www.facebook.com/sharer/sharer.php?u=\${encodeURIComponent('https://devops-daily.com/games/${quizId}-quiz')}\`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1877F2] text-white rounded-full hover:bg-[#166fe5] transition-colors"
              >
                <Facebook size={20} />
                <span className="sr-only">Share on Facebook</span>
              </a>
              <a
                href={\`https://www.linkedin.com/sharing/share-offsite/?url=\${encodeURIComponent('https://devops-daily.com/games/${quizId}-quiz')}\`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#0A66C2] text-white rounded-full hover:bg-[#095fb8] transition-colors"
              >
                <Linkedin size={20} />
                <span className="sr-only">Share on LinkedIn</span>
              </a>
            </div>
          </div>

          {/* Quiz Info */}
          <div className="w-full bg-muted/30 rounded-lg p-6 my-4">
            <h2 className="text-2xl font-bold mb-4">About ${config.title}</h2>
            <p className="mb-4">
              ${config.description}
            </p>

            <div className="mt-6 p-4 bg-primary-50 dark:bg-primary-950/20 rounded-lg border border-primary-500/20">
              <h3 className="text-lg font-semibold mb-2">💡 Learning Tip</h3>
              <p className="text-sm">
                This quiz is designed to test practical knowledge through real-world scenarios. 
                Focus on understanding the reasoning behind each answer to improve your skills.
              </p>
            </div>
          </div>

          {/* Back to games button */}
          <div className="mt-8">
            <Button asChild variant="outline">
              <Link href="/games">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Games
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}`;
}

function showHelp() {
  console.log(colorize('🎮 Quiz Development CLI', 'blue'));
  console.log();
  console.log(colorize('Usage:', 'cyan'));
  console.log('  npx tsx scripts/quiz-dev.ts <command> [options]');
  console.log();
  console.log(colorize('Commands:', 'cyan'));
  console.log('  validate                 Validate all quiz configurations');
  console.log('  create <quiz-id>         Create a new quiz with template');
  console.log('  list                     List all available quizzes');
  console.log('  stats [quiz-id]          Show statistics for quiz(es)');
  console.log('  help                     Show this help message');
  console.log();
  console.log(colorize('Examples:', 'cyan'));
  console.log('  npx tsx scripts/quiz-dev.ts validate');
  console.log('  npx tsx scripts/quiz-dev.ts create aws-fundamentals');
  console.log('  npx tsx scripts/quiz-dev.ts stats git-commands');
  console.log('  npx tsx scripts/quiz-dev.ts list');
}

// Run main if this is the entry point
main().catch(console.error);

export { main, validateCommand, createCommand, listCommand, statsCommand };
