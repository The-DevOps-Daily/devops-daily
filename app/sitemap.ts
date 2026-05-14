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
import { TOOLS } from '@/lib/tools';

export const dynamic = 'force-static';

function withLastModified(date?: string | Date | null) {
  return date ? { lastModified: new Date(date) } : {};
}

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

  const latestPostDate = posts[0]?.updatedAt || posts[0]?.date || posts[0]?.publishedAt;
  const latestGuideDate = guides[0]?.updatedAt || guides[0]?.publishedAt;
  const latestExerciseDate = exercises[0]?.updatedAt || exercises[0]?.publishedAt;
  const latestNewsDate = news[0]?.date || news[0]?.publishedAt;
  const latestComparisonDate = comparisons[0]?.updatedDate || comparisons[0]?.createdDate;
  const latestNewsletterDate = newsletters[0]?.date;

  // Static routes
  const routes = [
    {
      url: `${baseUrl}`,
      ...withLastModified(latestPostDate || latestNewsDate),
      changeFrequency: 'daily' as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/posts`,
      ...withLastModified(latestPostDate),
      changeFrequency: 'daily' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/guides`,
      ...withLastModified(latestGuideDate),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/exercises`,
      ...withLastModified(latestExerciseDate),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/quizzes`,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/news`,
      ...withLastModified(latestNewsDate),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/categories`,
      ...withLastModified(latestPostDate || latestGuideDate),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/roadmap`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/toolbox`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/tools`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/games`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
  ];

  // Post routes
  const postRoutes = posts.map((post) => ({
    url: `${baseUrl}/posts/${post.slug}`,
    ...withLastModified(post.updatedAt || post.date || post.publishedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Category routes
  const categoryRoutes = categories.map((category) => ({
    url: `${baseUrl}/categories/${category.slug}`,
    ...withLastModified(latestPostDate || latestGuideDate),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  // Guide routes
  const guideRoutes = guides.map((guide) => ({
    url: `${baseUrl}/guides/${guide.slug}`,
    ...withLastModified(guide.updatedAt || guide.publishedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Guide part routes
  const guidePartRoutes = guides.flatMap((guide) =>
    guide.parts.map((part) => ({
      url: `${baseUrl}/guides/${guide.slug}/${part.slug}`,
      ...withLastModified(guide.updatedAt || guide.publishedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }))
  );

  // Exercise routes
  const exerciseRoutes = exercises.map((exercise) => ({
    url: `${baseUrl}/exercises/${exercise.id}`,
    ...withLastModified(exercise.updatedAt || exercise.publishedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Quiz routes
  const quizRoutes = quizzes.map((quiz) => ({
    url: `${baseUrl}/quizzes/${quiz.id}`,
    ...withLastModified(quiz.createdDate),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // News routes
  const newsRoutes = news.map((digest) => ({
    url: `${baseUrl}/news/${digest.slug}`,
    ...withLastModified(digest.date || digest.publishedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  // Game routes (only active games, excludes coming soon)
  const gameRoutes = games.map((game) => ({
    url: `${baseUrl}${game.href}`,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Flashcard routes
  const flashcardRoutes = flashcards.map((set) => ({
    url: `${baseUrl}/flashcards/${set.id}`,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // Checklist routes
  const checklistRoutes = checklists.map((checklist) => ({
    url: `${baseUrl}/checklists/${checklist.slug}`,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // Interview question routes
  const interviewRoutes = interviewQuestions.map((q) => ({
    url: `${baseUrl}/interview-questions/${q.tier}/${q.slug}`,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // Comparison routes
  const comparisonRoutes = comparisons.map((c) => ({
    url: `${baseUrl}/comparisons/${c.slug}`,
    ...withLastModified(c.updatedDate || c.createdDate),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Newsletter routes
  const newsletterRoutes = newsletters.map((n) => ({
    url: `${baseUrl}/newsletters/${n.slug}`,
    ...withLastModified(n.date),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // Advent of DevOps routes
  const adventRoutes = adventDays.map((day) => ({
    url: `${baseUrl}/advent-of-devops/${day.slug}`,
    ...withLastModified(day.updatedAt || day.publishedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // Hacktoberfest routes
  const hacktoberfestRoutes = hacktoberfestDays.map((day) => ({
    url: `${baseUrl}/hacktoberfest/${day.slug}`,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // Tool routes (each tool has its own static page under /tools/<slug>)
  const toolRoutes = TOOLS.map((tool) => ({
    url: `${baseUrl}/tools/${tool.slug}`,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
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
    ...withLastModified(
      path === '/comparisons'
        ? latestComparisonDate
        : path === '/newsletters'
          ? latestNewsletterDate
          : undefined
    ),
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
    ...toolRoutes,
    ...contentPages,
  ];
}
