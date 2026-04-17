import { getAllPosts } from '@/lib/posts';
import { getAllGuides } from '@/lib/guides';
import { getAllExercises } from '@/lib/exercises';

export const dynamic = 'force-static';

/**
 * llms-full.txt provides the full text of key content so LLMs can ingest
 * actual answers rather than just a table of contents.
 *
 * We include:
 * - Full text of all blog posts (primary content)
 * - Full text of all guide parts
 * - Full text of all exercises
 *
 * Games, simulators, and other interactive content are intentionally
 * excluded since they are not text-based.
 */
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://devops-daily.com';

  const [posts, guides, exercises] = await Promise.all([
    getAllPosts(),
    getAllGuides(),
    getAllExercises(),
  ]);

  const sections: string[] = [];

  // Header
  sections.push('# DevOps Daily - Full Content Export');
  sections.push('');
  sections.push(
    '> Complete text content from DevOps Daily. This file is structured for LLM ingestion. Each piece of content is separated by a horizontal rule and prefixed with its canonical URL.'
  );
  sections.push('');
  sections.push(`Site: ${baseUrl}`);
  sections.push(`Generated: ${new Date().toISOString()}`);
  sections.push(
    `Content: ${posts.length} posts, ${guides.length} guides, ${exercises.length} exercises`
  );
  sections.push('');
  sections.push('---');
  sections.push('');

  // Blog posts
  sections.push('## Blog Posts');
  sections.push('');
  for (const post of posts) {
    const url = `${baseUrl}/posts/${post.slug}`;
    sections.push(`### ${post.title}`);
    sections.push('');
    sections.push(`URL: ${url}`);
    if (post.publishedAt || post.date) {
      sections.push(`Published: ${post.publishedAt || post.date}`);
    }
    if (post.category?.name) {
      sections.push(`Category: ${post.category.name}`);
    }
    if (post.tags && post.tags.length > 0) {
      sections.push(`Tags: ${post.tags.join(', ')}`);
    }
    sections.push('');
    sections.push(post.content || post.excerpt || '');
    sections.push('');
    sections.push('---');
    sections.push('');
  }

  // Guides
  sections.push('## Guides');
  sections.push('');
  for (const guide of guides) {
    const url = `${baseUrl}/guides/${guide.slug}`;
    sections.push(`### ${guide.title}`);
    sections.push('');
    sections.push(`URL: ${url}`);
    if (guide.description) {
      sections.push(`Description: ${guide.description}`);
    }
    sections.push('');

    // Include all parts if available
    if (guide.parts && guide.parts.length > 0) {
      for (const part of guide.parts) {
        sections.push(`#### ${part.title}`);
        sections.push('');
        sections.push(part.content || '');
        sections.push('');
      }
    } else if (guide.content) {
      sections.push(guide.content);
      sections.push('');
    }
    sections.push('---');
    sections.push('');
  }

  // Exercises
  sections.push('## Exercises');
  sections.push('');
  for (const exercise of exercises) {
    const url = `${baseUrl}/exercises/${exercise.id}`;
    sections.push(`### ${exercise.title}`);
    sections.push('');
    sections.push(`URL: ${url}`);
    if (exercise.description) {
      sections.push(`Description: ${exercise.description}`);
    }
    if (exercise.difficulty) {
      sections.push(`Difficulty: ${exercise.difficulty}`);
    }
    if (exercise.estimatedTime) {
      sections.push(`Time: ${exercise.estimatedTime}`);
    }
    sections.push('');

    // Include learning objectives if available
    if (exercise.learningObjectives && exercise.learningObjectives.length > 0) {
      sections.push('**Learning objectives:**');
      for (const obj of exercise.learningObjectives) {
        sections.push(`- ${obj}`);
      }
      sections.push('');
    }

    // Include steps
    if (exercise.steps && exercise.steps.length > 0) {
      sections.push('**Steps:**');
      sections.push('');
      for (let i = 0; i < exercise.steps.length; i++) {
        const step = exercise.steps[i];
        sections.push(`**Step ${i + 1}: ${step.title}**`);
        sections.push('');
        if (step.description) {
          sections.push(step.description);
          sections.push('');
        }
      }
    }

    sections.push('---');
    sections.push('');
  }

  const body = sections.join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
