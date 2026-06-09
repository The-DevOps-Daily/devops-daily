import type { Metadata } from 'next';

/**
 * Shared shape for content detail pages ([slug]/[id] routes). Every page
 * was repeating the same Metadata skeleton: absolute title (skipping the
 * '%s | DevOps Daily' layout template), canonical path, OpenGraph card with
 * a 1200x630 image, and a summary_large_image Twitter card. The variation
 * points (social title suffixes, article timestamps, Twitter handles) are
 * explicit inputs so each page keeps its exact previous output.
 */
export interface DetailPageMetadataInput {
  /** Route path, e.g. `/posts/${slug}`; used for the canonical URL and og:url. */
  path: string;
  /** Absolute <title>. Detail pages skip the layout's brand suffix. */
  title: string;
  description?: string;
  /** Social card image URL (callers resolve fallbacks like '/og-image.png'). */
  image: string;
  /** og:image alt text; defaults to the title. */
  imageAlt?: string;
  /** og/twitter title when it differs from the <title> (brand suffixes). */
  socialTitle?: string;
  ogType?: 'article' | 'website';
  /** Article-only OpenGraph fields; ignored unless ogType is 'article'. */
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    section?: string;
    tags?: string[];
  };
  siteName?: string;
  locale?: string;
  /** Sets twitter:site and twitter:creator. */
  twitterHandle?: string;
}

export function detailPageMetadata(input: DetailPageMetadataInput): Metadata {
  const {
    path,
    title,
    description,
    image,
    imageAlt,
    socialTitle = title,
    ogType = 'article',
    article,
    siteName,
    locale,
    twitterHandle,
  } = input;

  const images = [
    {
      url: image,
      width: 1200,
      height: 630,
      alt: imageAlt ?? title,
    },
  ];

  const shared = {
    title: socialTitle,
    description,
    url: path,
    images,
    ...(siteName ? { siteName } : {}),
    ...(locale ? { locale } : {}),
  };

  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: path,
    },
    openGraph:
      ogType === 'article'
        ? { type: 'article', ...shared, ...article }
        : { type: 'website', ...shared },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images: [image],
      ...(twitterHandle ? { site: twitterHandle, creator: twitterHandle } : {}),
    },
  };
}
