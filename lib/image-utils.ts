import fs from 'fs';
import path from 'path';

const WEB_IMAGE_EXTENSIONS = ['svg', 'png', 'jpg'];

function publicAssetExists(publicPath: string): boolean {
  return fs.existsSync(path.join(process.cwd(), 'public', publicPath));
}

function getExistingImagePath(type: string, slug: string, extensions: string[]): string | null {
  for (const extension of extensions) {
    const imagePath = `/images/${type}/${slug}.${extension}`;
    if (publicAssetExists(imagePath)) {
      return imagePath;
    }
  }

  return null;
}

export function getPostImagePath(slug: string, type: string = 'posts'): string {
  return getExistingImagePath(type, slug, WEB_IMAGE_EXTENSIONS) || '/images/placeholder.svg';
}

export function getGuideImagePath(slug: string): string {
  return getPostImagePath(slug, 'guides');
}

export function getExerciseImagePath(id: string): string {
  return getPostImagePath(id, 'exercises');
}

export function getNewsImagePath(slug: string): string {
  return getPostImagePath(slug, 'news');
}

export function getAdventImagePath(slug: string): string {
  return getPostImagePath(slug, 'advent');
}

export function getSocialImagePath(
  slug: string,
  type:
    | 'posts'
    | 'guides'
    | 'exercises'
    | 'news'
    | 'advent'
    | 'interview-questions'
    | 'comparisons'
    | 'games'
    | 'quizzes'
    | 'flashcards'
    | 'checklists'
    | 'tools'
): string {
  return getExistingImagePath(type, slug, ['png']) || '/og-image.png';
}

export function getImagePath(
  slug: string,
  type: 'posts' | 'guides' | 'exercises' | 'news' | 'advent' | 'interview-questions' | 'comparisons',
  usage: 'web' | 'social' = 'web'
): string {
  if (usage === 'social') {
    return getSocialImagePath(slug, type);
  }

  if (type === 'exercises') {
    return getExerciseImagePath(slug);
  }

  if (type === 'news') {
    return getNewsImagePath(slug);
  }

  if (type === 'advent') {
    return getAdventImagePath(slug);
  }

  return getPostImagePath(slug, type);
}
