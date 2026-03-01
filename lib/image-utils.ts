import fs from 'fs';
import path from 'path';

export function getPostImagePath(slug: string, type: string = 'posts'): string {
  // Prefer SVG for web (smaller, scalable)
  const svgImagePath = `/images/${type}/${slug}.svg`;
  const svgPublicPath = path.join(process.cwd(), 'public', svgImagePath);

  if (fs.existsSync(svgPublicPath)) {
    return svgImagePath;
  }

  // Then PNG (fallback)
  const pngImagePath = `/images/${type}/${slug}.png`;
  const pngPublicPath = path.join(process.cwd(), 'public', pngImagePath);

  if (fs.existsSync(pngPublicPath)) {
    return pngImagePath;
  }

  // Check for other image formats (jpg, webp, etc.)
  const jpgImagePath = `/images/${type}/${slug}.jpg`;
  const jpgPublicPath = path.join(process.cwd(), 'public', jpgImagePath);

  if (fs.existsSync(jpgPublicPath)) {
    return jpgImagePath;
  }

  // Fallback to placeholder
  return '/images/placeholder.svg';
}

export function getGuideImagePath(slug: string): string {
  // Same logic for guides - prefer SVG for web
  const svgImagePath = `/images/guides/${slug}.svg`;
  const svgPublicPath = path.join(process.cwd(), 'public', svgImagePath);

  if (fs.existsSync(svgPublicPath)) {
    return svgImagePath;
  }

  const pngImagePath = `/images/guides/${slug}.png`;
  const pngPublicPath = path.join(process.cwd(), 'public', pngImagePath);

  if (fs.existsSync(pngPublicPath)) {
    return pngImagePath;
  }

  const jpgImagePath = `/images/guides/${slug}.jpg`;
  const jpgPublicPath = path.join(process.cwd(), 'public', jpgImagePath);

  if (fs.existsSync(jpgPublicPath)) {
    return jpgImagePath;
  }

  return '/images/placeholder.svg';
}

export function getExerciseImagePath(id: string): string {
  // Prefer SVG for web (smaller, scalable)
  const svgImagePath = `/images/exercises/${id}.svg`;
  const svgPublicPath = path.join(process.cwd(), 'public', svgImagePath);

  if (fs.existsSync(svgPublicPath)) {
    return svgImagePath;
  }

  // Then PNG (fallback)
  const pngImagePath = `/images/exercises/${id}.png`;
  const pngPublicPath = path.join(process.cwd(), 'public', pngImagePath);

  if (fs.existsSync(pngPublicPath)) {
    return pngImagePath;
  }

  // Check for other image formats (jpg, webp, etc.)
  const jpgImagePath = `/images/exercises/${id}.jpg`;
  const jpgPublicPath = path.join(process.cwd(), 'public', jpgImagePath);

  if (fs.existsSync(jpgPublicPath)) {
    return jpgImagePath;
  }

  // Fallback to placeholder
  return '/images/placeholder.svg';
}

export function getNewsImagePath(slug: string): string {
  return getPostImagePath(slug, 'news');
}

export function getAdventImagePath(slug: string): string {
  return getPostImagePath(slug, 'advent');
}

export function getSocialImagePath(
  slug: string,
  type: 'posts' | 'guides' | 'exercises' | 'news' | 'advent' | 'interview-questions'
): string {
  // Always prefer PNG for social media
  const pngImagePath = `/images/${type}/${slug}.png`;
  const pngPublicPath = path.join(process.cwd(), 'public', pngImagePath);

  if (fs.existsSync(pngPublicPath)) {
    return pngImagePath;
  }

  // Fallback to default og-image
  return '/og-image.png';
}

export function getImagePath(
  slug: string,
  type: 'posts' | 'guides' | 'exercises' | 'news' | 'advent' | 'interview-questions',
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

  return type === 'posts' ? getPostImagePath(slug) : getGuideImagePath(slug);
}
