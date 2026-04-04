import type { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/posts';
import { getAllCategories } from '@/lib/categories';
import { getAllGuides } from '@/lib/guides';
import { getAllExercises } from '@/lib/exercises';
import { getQuizMetadata } from '@/lib/quiz-loader';
import { getAllNews } from '@/lib/news';
import { getActiveGames } from '@/lib/games';
import { getAllFlashCardSets } from '@/lib/flashcard-loader';
import { getAllChecklists } from '@/lib/checklists';
import { interviewQuestions } from '@/content/interview-questions';
import { getAllAdventDays } from '@/lib/advent';
import { getAllComparisons } from '@/lib/comparisons';
import { getAllNewsletters } from '@/lib/newsletters';
import { getAllHacktoberfestDays } from '@/lib/hacktoberfest';

export const dynamic = 'force-static';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://devops-daily.com';

  // Get all content
  const [posts, categories, guides, exercises, quizzes, news, games, flashcards, adventDays, comparisons, newsletters, checklists, hacktoberfestDays] =
    await Promise.all([
      getAllPosts(),
      getAllCategories(),
      getAllGuides(),
      getAllExercises(),
      getQuizMetadata(),
      getAllNews(),
      getActiveGames(),
      getAllFlashCardSets(),
      getAllAdventDays(),
      getAllComparisons(),
      getAllNewsletters(),
      getAllChecklists(),
      getAllHacktoberfestDays(),
    ]);

  // Static routes
  const routes = [
    {
      url: `${baseUrl}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/posts`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/guides`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/exercises`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/quizzes`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/news`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/categories`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/roadmap`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/toolbox`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/games`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
  ];

  // Post routes
  const postRoutes = posts.map((post) => ({
    url: `${baseUrl}/posts/${post.slug}`,
    lastModified: new Date(post.updatedAt || post.date || new Date()),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Category routes
  const categoryRoutes = categories.map((category) => ({
    url: `${baseUrl}/categories/${category.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  // Guide routes
  const guideRoutes = guides.map((guide) => ({
    url: `${baseUrl}/guides/${guide.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Guide part routes
  const guidePartRoutes = guides.flatMap((guide) =>
    guide.parts.map((part) => ({
      url: `${baseUrl}/guides/${guide.slug}/${part.slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }))
  );

  // Exercise routes
  const exerciseRoutes = exercises.map((exercise) => ({
    url: `${baseUrl}/exercises/${exercise.id}`,
    lastModified: new Date(exercise.updatedAt || exercise.publishedAt || new Date()),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Quiz routes
  const quizRoutes = quizzes.map((quiz) => ({
    url: `${baseUrl}/quizzes/${quiz.id}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // News routes
  const newsRoutes = news.map((digest) => ({
    url: `${baseUrl}/news/${digest.slug}`,
    lastModified: new Date(digest.date || new Date()),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  // Game routes (only active games, excludes coming soon)
  const gameRoutes = games.map((game) => ({
    url: `${baseUrl}${game.href}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Flashcard routes
  const flashcardRoutes = flashcards.map((set) => ({
    url: `${baseUrl}/flashcards/${set.id}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // Checklist routes
  const checklistRoutes = checklists.map((checklist) => ({
    url: `${baseUrl}/checklists/${checklist.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // Interview question routes
  const interviewRoutes = interviewQuestions.map((q) => ({
    url: `${baseUrl}/interview-questions/${q.tier}/${q.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // Comparison routes
  const comparisonRoutes = comparisons.map((c) => ({
    url: `${baseUrl}/comparisons/${c.slug}`,
    lastModified: new Date(c.updatedDate || c.createdDate),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Newsletter routes
  const newsletterRoutes = newsletters.map((n) => ({
    url: `${baseUrl}/newsletters/${n.slug}`,
    lastModified: new Date(n.date || new Date()),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // Advent of DevOps routes
  const adventRoutes = adventDays.map((day) => ({
    url: `${baseUrl}/advent-of-devops/${day.slug}`,
    lastModified: new Date(day.updatedAt || day.publishedAt || new Date()),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // Hacktoberfest routes
  const hacktoberfestRoutes = hacktoberfestDays.map((day) => ({
    url: `${baseUrl}/hacktoberfest/${day.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // Static content pages
  const contentPages = [
    '/about',
    '/editorial',
    '/privacy',
    '/terms',
    '/sponsorship',
    '/roadmaps',
    '/roadmaps/junior',
    '/roadmaps/devsecops',
    '/books',
    '/books/devops-survival-guide',
    '/flashcards',
    '/checklists',
    '/interview-questions',
    '/advent-of-devops',
    '/hacktoberfest',
    '/comparisons',
    '/newsletters',
    '/search',
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));

  return [
    ...routes,
    ...postRoutes,
    ...categoryRoutes,
    ...guideRoutes,
    ...guidePartRoutes,
    ...exerciseRoutes,
    ...quizRoutes,
    ...newsRoutes,
    ...gameRoutes,
    ...flashcardRoutes,
    ...checklistRoutes,
    ...interviewRoutes,
    ...adventRoutes,
    ...hacktoberfestRoutes,
    ...comparisonRoutes,
    ...newsletterRoutes,
    ...contentPages,
  ];
}
