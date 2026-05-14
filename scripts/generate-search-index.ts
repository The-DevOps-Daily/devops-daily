// scripts/generate-search-index.ts
import fs from 'fs/promises';
import path from 'path';
import { getAllPosts } from '../lib/posts.js';
import { getAllGuides } from '../lib/guides.js';
import { getAllExercises } from '../lib/exercises.js';
import { getAllNews } from '../lib/news.js';
import { getActiveGames } from '../lib/games.js';
import { getAllChecklists } from '../lib/checklists.js';
import { getAllComparisons } from '../lib/comparisons.js';
import { getAllFlashCardSets } from '../lib/flashcard-loader.js';
import { TOOLS, CATEGORY_LABEL } from '../lib/tools.js';
import { interviewQuestions } from '../content/interview-questions/index.js';
import type { SearchItem } from '../lib/search-types.js';

// Static pages
const PAGES: SearchItem[] = [
  {
    id: 'page-home',
    type: 'page',
    title: 'Home',
    description: 'DevOps Daily - Latest news, tutorials, and guides',
    url: '/',
    icon: '🏠',
  },
  {
    id: 'page-posts',
    type: 'page',
    title: 'All Posts',
    description: 'Browse all blog posts',
    url: '/posts',
    icon: '📝',
  },
  {
    id: 'page-guides',
    type: 'page',
    title: 'Guides',
    description: 'Comprehensive DevOps guides',
    url: '/guides',
    icon: '📚',
  },
  {
    id: 'page-exercises',
    type: 'page',
    title: 'Exercises',
    description: 'Hands-on DevOps exercises',
    url: '/exercises',
    icon: '🧪',
  },
  {
    id: 'page-quizzes',
    type: 'page',
    title: 'Quizzes',
    description: 'Test your DevOps knowledge',
    url: '/quizzes',
    icon: '❓',
  },
  {
    id: 'page-games',
    type: 'page',
    title: 'Games',
    description: 'Interactive DevOps games',
    url: '/games',
    icon: '🎮',
  },
  {
    id: 'page-news',
    type: 'page',
    title: 'News',
    description: 'Latest DevOps news and updates',
    url: '/news',
    icon: '📰',
  },
  {
    id: 'page-roadmap',
    type: 'page',
    title: 'Learning Roadmap',
    description: 'Your path to DevOps mastery',
    url: '/roadmap',
    icon: '🗺️',
  },
  {
    id: 'page-junior-roadmap',
    type: 'page',
    title: 'Junior DevOps Roadmap',
    description: 'Beginner-friendly roadmap for aspiring DevOps engineers',
    url: '/roadmap/junior',
    icon: '🌱',
  },
  {
    id: 'page-devsecops-roadmap',
    type: 'page',
    title: 'DevSecOps Roadmap',
    description: 'Security-first roadmap for integrating security into DevOps practices',
    url: '/roadmap/devsecops',
    icon: '🔒',
  },
  {
    id: 'page-toolbox',
    type: 'page',
    title: 'Toolbox',
    description: 'Essential DevOps tools and resources',
    url: '/toolbox',
    icon: '🧰',
  },
  {
    id: 'page-categories',
    type: 'page',
    title: 'Categories',
    description: 'Browse content by category',
    url: '/categories',
    icon: '📑',
  },
  {
    id: 'page-checklists',
    type: 'page',
    title: 'Checklists',
    description: 'Interactive DevOps and security checklists',
    url: '/checklists',
    icon: '✅',
  },
  {
    id: 'page-comparisons',
    type: 'page',
    title: 'Comparisons',
    description: 'Side-by-side DevOps tool and platform comparisons',
    url: '/comparisons',
    icon: '⚖️',
  },
  {
    id: 'page-flashcards',
    type: 'page',
    title: 'Flashcards',
    description: 'DevOps flashcard sets for focused practice',
    url: '/flashcards',
    icon: '🧠',
  },
  {
    id: 'page-tools',
    type: 'page',
    title: 'Tools',
    description: 'Browser-based DevOps calculators, decoders, and utilities',
    url: '/tools',
    icon: '🛠️',
  },
  {
    id: 'page-interview-questions',
    type: 'page',
    title: 'Interview Questions',
    description: 'Practice DevOps interview questions by experience level',
    url: '/interview-questions',
    icon: '💬',
  },
  {
    id: 'page-interview-questions-junior',
    type: 'interview-question',
    title: 'Junior Interview Questions',
    description: 'Entry-level DevOps interview questions for beginners',
    url: '/interview-questions/junior',
    icon: '🌱',
  },
  {
    id: 'page-interview-questions-mid',
    type: 'interview-question',
    title: 'Mid-Level Interview Questions',
    description: 'Intermediate DevOps interview questions for experienced practitioners',
    url: '/interview-questions/mid',
    icon: '🚀',
  },
  {
    id: 'page-interview-questions-senior',
    type: 'interview-question',
    title: 'Senior Interview Questions',
    description: 'Advanced DevOps interview questions for senior engineers and architects',
    url: '/interview-questions/senior',
    icon: '🎯',
  },
];

// Quizzes (load from filesystem)
async function getQuizzes(): Promise<SearchItem[]> {
  try {
    const quizzesDir = path.join(process.cwd(), 'content', 'quizzes');
    const files = await fs.readdir(quizzesDir);
    const quizFiles = files.filter((file) => file.endsWith('.json'));

    const quizzes: SearchItem[] = [];

    for (const file of quizFiles) {
      const content = await fs.readFile(path.join(quizzesDir, file), 'utf-8');
      const quiz = JSON.parse(content);

      quizzes.push({
        id: `quiz-${quiz.id}`,
        type: 'quiz',
        title: quiz.title,
        description: quiz.description || `${quiz.questions.length} questions`,
        url: `/quizzes/${quiz.id}`,
        category: quiz.category || 'General',
        tags: quiz.metadata?.tags || [],
        icon: '❓',
        date: quiz.metadata?.createdDate,
      });
    }

    return quizzes;
  } catch (error) {
    console.error('Error loading quizzes:', error);
    return [];
  }
}

async function generateSearchIndex() {
  console.log('🔍 Generating search index...\n');
  const startTime = Date.now();

  const searchIndex: SearchItem[] = [];

  // Add static pages
  console.log('📄 Adding pages...');
  searchIndex.push(...PAGES);
  console.log(`  ✓ Added ${PAGES.length} pages`);

  // Add games (dynamically loaded)
  console.log('🎮 Adding games...');
  const games = await getActiveGames();
  const gameItems: SearchItem[] = games.map((game) => ({
    id: `game-${game.id}`,
    type: 'game',
    title: game.title,
    description: game.description,
    url: game.href,
    category: game.category || 'Game',
    tags: game.tags,
    icon: '🎮',
  }));
  searchIndex.push(...gameItems);
  console.log(`  ✓ Added ${gameItems.length} games`);

  // Add posts
  console.log('📝 Adding posts...');
  const posts = await getAllPosts();
  const postItems: SearchItem[] = posts.slice(0, 1000).map((post) => ({
    id: `post-${post.slug}`,
    type: 'post',
    title: post.title,
    description: post.excerpt || '',
    url: `/posts/${post.slug}`,
    category: post.category?.name,
    tags: post.tags,
    icon: '📝',
    date: post.date || post.publishedAt,
  }));
  searchIndex.push(...postItems);
  console.log(`  ✓ Added ${postItems.length} posts (limited to 1000 most recent)`);

  // Add guides
  console.log('📚 Adding guides...');
  const guides = await getAllGuides();
  const guideItems: SearchItem[] = guides.map((guide) => ({
    id: `guide-${guide.slug}`,
    type: 'guide',
    title: guide.title,
    description: guide.description || guide.excerpt || '',
    url: `/guides/${guide.slug}`,
    category: guide.category?.name,
    tags: guide.tags,
    icon: '📚',
    date: guide.publishedAt,
  }));
  searchIndex.push(...guideItems);
  console.log(`  ✓ Added ${guideItems.length} guides`);

  // Add exercises
  console.log('🧪 Adding exercises...');
  const exercises = await getAllExercises();
  const exerciseItems: SearchItem[] = exercises.map((exercise) => ({
    id: `exercise-${exercise.id}`,
    type: 'exercise',
    title: exercise.title,
    description: exercise.description,
    url: `/exercises/${exercise.id}`,
    category: exercise.category?.name || exercise.difficulty,
    tags: [...(exercise.technologies || []), ...(exercise.tags || [])],
    icon: '🧪',
  }));
  searchIndex.push(...exerciseItems);
  console.log(`  ✓ Added ${exerciseItems.length} exercises`);

  // Add quizzes
  console.log('❓ Adding quizzes...');
  const quizzes = await getQuizzes();
  searchIndex.push(...quizzes);
  console.log(`  ✓ Added ${quizzes.length} quizzes`);

  // Add news (limited to recent)
  console.log('📰 Adding news...');
  try {
    const news = await getAllNews();
    const newsItems: SearchItem[] = news.slice(0, 50).map((item) => ({
      id: `news-${item.slug}`,
      type: 'news',
      title: item.title,
      description: `Week ${item.week}, ${item.year} digest`,
      url: `/news/${item.slug}`,
      category: 'News',
      icon: '📰',
      date: item.date || item.publishedAt,
    }));
    searchIndex.push(...newsItems);
    console.log(`  ✓ Added ${newsItems.length} news items (limited to 50 most recent)`);
  } catch (error) {
    console.log('  ⚠️ Could not load news items');
  }

  // Add checklists
  console.log('Adding checklists...');
  const checklists = await getAllChecklists();
  const checklistItems: SearchItem[] = checklists.map((checklist) => ({
    id: `checklist-${checklist.slug}`,
    type: 'checklist',
    title: checklist.title,
    description: checklist.description,
    url: `/checklists/${checklist.slug}`,
    category: checklist.category,
    tags: checklist.tags,
    icon: '✅',
  }));
  searchIndex.push(...checklistItems);
  console.log(`  ✓ Added ${checklistItems.length} checklists`);

  // Add comparisons
  console.log('⚖️ Adding comparisons...');
  const comparisons = await getAllComparisons();
  const comparisonItems: SearchItem[] = comparisons.map((comparison) => ({
    id: `comparison-${comparison.slug}`,
    type: 'comparison',
    title: comparison.title || `${comparison.toolA.name} vs ${comparison.toolB.name}`,
    description: comparison.description,
    url: `/comparisons/${comparison.slug}`,
    category: comparison.category,
    tags: comparison.tags,
    icon: '⚖️',
    date: comparison.updatedDate || comparison.createdDate,
  }));
  searchIndex.push(...comparisonItems);
  console.log(`  ✓ Added ${comparisonItems.length} comparisons`);

  // Add flashcards
  console.log('🧠 Adding flashcards...');
  const flashcards = await getAllFlashCardSets();
  const flashcardItems: SearchItem[] = flashcards.map((set) => ({
    id: `flashcard-${set.id}`,
    type: 'flashcard',
    title: set.title,
    description: set.description,
    url: `/flashcards/${set.id}`,
    category: set.category,
    tags: [set.difficulty],
    icon: '🧠',
  }));
  searchIndex.push(...flashcardItems);
  console.log(`  ✓ Added ${flashcardItems.length} flashcard sets`);

  // Add tools
  console.log('🛠️ Adding tools...');
  const toolItems: SearchItem[] = TOOLS.map((tool) => ({
    id: `tool-${tool.slug}`,
    type: 'tool',
    title: tool.title,
    description: tool.description,
    url: `/tools/${tool.slug}`,
    category: CATEGORY_LABEL[tool.category],
    tags: tool.keywords,
    icon: '🛠️',
  }));
  searchIndex.push(...toolItems);
  console.log(`  ✓ Added ${toolItems.length} tools`);

  // Add interview questions
  console.log('💬 Adding interview questions...');
  const interviewItems: SearchItem[] = interviewQuestions.map((question) => ({
    id: `interview-${question.tier}-${question.slug}`,
    type: 'interview-question',
    title: question.title,
    description: question.question,
    url: `/interview-questions/${question.tier}/${question.slug}`,
    category: question.category,
    tags: question.tags,
    icon: '💬',
  }));
  searchIndex.push(...interviewItems);
  console.log(`  ✓ Added ${interviewItems.length} interview questions`);

  // Calculate size
  const json = JSON.stringify(searchIndex);
  const sizeKB = (json.length / 1024).toFixed(2);

  // Write to public directory
  const outputPath = path.join(process.cwd(), 'public', 'search-index.json');
  await fs.writeFile(outputPath, json, 'utf-8');

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('\n✅ Search index generated successfully!');
  console.log(`📊 Statistics:`);
  console.log(`   - Total items: ${searchIndex.length}`);
  console.log(`   - Size: ${sizeKB} KB`);
  console.log(`   - Time: ${duration}s`);
  console.log(`   - Output: ${outputPath}\n`);

  // Show breakdown
  const breakdown = searchIndex.reduce(
    (acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log('📈 Content breakdown:');
  Object.entries(breakdown)
    .sort(([, a], [, b]) => b - a)
    .forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}`);
    });
}

generateSearchIndex().catch((error) => {
  console.error('❌ Error generating search index:', error);
  process.exit(1);
});
