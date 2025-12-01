import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === 'development',
  fallbacks: {
    document: '/offline.html',
  },
  // Exclude Cloudflare config files, LLM-only content, and images from precaching
  // Images will be cached on-demand via runtime caching as users view them
  publicExcludes: [
    '!_headers',
    '!_redirects',
    '!robots.txt',
    '!sitemap.xml',
    '!**/*.md',  // Exclude markdown files (LLM-only)
    '!**/*.txt',  // Exclude text files to prevent .txt redirects
    '!**/*.{png,jpg,jpeg,svg,gif,webp,ico}',  // Don't precache images - use runtime caching instead
  ],
  workboxOptions: {
    disableDevLogs: true,
    // Ensure service worker can update properly
    skipWaiting: true,
    clientsClaim: true,
    // Runtime caching for HTML pages (navigation requests)
    runtimeCaching: [
      // Cache HTML pages (including paths without .html extension)
      {
        urlPattern: ({ request, url }) => {
          // Match navigation requests (clicking links, address bar)
          if (request.mode === 'navigate') return true;

          // Also match HTML files explicitly
          if (url.pathname.endsWith('.html')) return true;

          // Match paths that look like pages (no file extension)
          // e.g., /posts/docker-guide, /guides/kubernetes, /games/git-quiz
          const hasExtension = /\.[^/]+$/.test(url.pathname);
          const isApiRoute = url.pathname.startsWith('/api/');
          return !hasExtension && !isApiRoute;
        },
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pages-cache',
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          },
          networkTimeoutSeconds: 10,
        },
      },
      // Cache JSON data files
      {
        urlPattern: /\.json$/,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'data-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 24 * 60 * 60, // 1 day
          },
        },
      },
      // Cache images at runtime
      {
        urlPattern: /\.(png|jpg|jpeg|svg|gif|webp|ico)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'image-cache',
          expiration: {
            maxEntries: 500,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
        },
      },
      // Cache fonts (long-lived)
      {
        urlPattern: /\.(woff|woff2|ttf|otf|eot)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'font-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
          },
        },
      },
      // Cache JS/CSS with background updates
      {
        urlPattern: /\.(js|css)$/,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          },
        },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: false,
  // Enable Turbopack explicitly (default in Next.js 16)
  turbopack: {},
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withPWA(nextConfig);
