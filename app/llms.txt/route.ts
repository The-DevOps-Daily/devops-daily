import { getAllPosts } from '@/lib/posts';
import { getAllCategories } from '@/lib/categories';
import { getAllGuides } from '@/lib/guides';
import { getAllExercises } from '@/lib/exercises';
import { getQuizMetadata } from '@/lib/quiz-loader';
import { getAllAdventDays } from '@/lib/advent';

export const dynamic = 'force-static';

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://devops-daily.com';

  const [posts, categories, guides, exercises, quizzes, adventDays] = await Promise.all([
    getAllPosts(),
    getAllCategories(),
    getAllGuides(),
    getAllExercises(),
    getQuizMetadata(),
    getAllAdventDays(),
  ]);

  const staticPages = [
    { title: 'Home', url: baseUrl },
    { title: 'Posts', url: `${baseUrl}/posts` },
    { title: 'Guides', url: `${baseUrl}/guides` },
    { title: 'Exercises', url: `${baseUrl}/exercises` },
    { title: 'Quizzes', url: `${baseUrl}/quizzes` },
    { title: 'Categories', url: `${baseUrl}/categories` },
    { title: 'Advent of DevOps', url: `${baseUrl}/advent-of-devops` },
    { title: 'Roadmap', url: `${baseUrl}/roadmap` },
    { title: 'Toolbox', url: `${baseUrl}/toolbox` },
    { title: 'Games', url: `${baseUrl}/games` },
  ];

  const postLinks = posts.map((post) => `- [${post.title}](${baseUrl}/posts/${post.slug}.md)`);

  const categoryLinks = categories.map(
    (category) => `- [${category.name}](${baseUrl}/categories/${category.slug})`
  );

  const guideLinks = guides.map(
    (guide) => `- [${guide.title}](${baseUrl}/guides/${guide.slug}.md)`
  );

  const guidePartLinks = guides.flatMap((guide) =>
    guide.parts.map((part) => `- [${part.title}](${baseUrl}/guides/${guide.slug}/${part.slug}.md)`)
  );

  const exerciseLinks = exercises.map(
    (exercise) => `- [${exercise.title}](${baseUrl}/exercises/${exercise.id})`
  );
  const quizLinks = quizzes.map((quiz) => `- [${quiz.title}](${baseUrl}/quizzes/${quiz.id})`);

  const adventLinks = adventDays.map(
    (day) => `- [Day ${day.day}: ${day.title}](${baseUrl}/advent-of-devops/${day.slug}.md)`
  );

  const md = `# DevOps Daily

> DevOps Daily is a community-driven platform that provides resources, guides, and quizzes to help you learn DevOps practices.

This file contains links to all the resources available on DevOps Daily.

## Pages
${staticPages.map((p) => `- [${p.title}](${p.url})`).join('\n')}

## Posts
${postLinks.join('\n')}

## Categories
${categoryLinks.join('\n')}

## Guides
${guideLinks.join('\n')}
${guidePartLinks.length ? `\n${guidePartLinks.join('\n')}` : ''}

## Advent of DevOps
${adventLinks.join('\n')}

## Quizzes
${quizLinks.join('\n')}

## Exercises
${exerciseLinks.join('\n')}
`;

  return new Response(md, { headers: { 'Content-Type': 'text/plain' } });
}
