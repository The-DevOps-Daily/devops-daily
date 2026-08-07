import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://devops-daily.com';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/cdn-cgi/',
    },
    // Both are listed so every crawler that reads robots.txt finds the section
    // sitemaps without anyone submitting them by hand. The index points at one
    // file per content type; /sitemap.xml stays as the complete list.
    sitemap: [`${baseUrl}/sitemap.xml`, `${baseUrl}/sitemap-index.xml`],
  };
}
