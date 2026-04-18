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
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
