import type React from 'react';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { ThemeProvider } from '@/components/theme-provider';
import { WebsiteSchema } from '@/components/schema-markup';
import { CookieBanner } from '@/components/cookie-banner';
import { GoogleAnalytics } from '@next/third-parties/google';
import { PWAInstaller } from '@/components/pwa-installer';
import { KonamiCodeListener } from '@/components/konami-code-listener';
import { BookPromotionPopup } from '@/components/book-promotion-popup';
import { SkipToContent } from '@/components/skip-to-content';
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // Optimize font loading
  variable: '--font-inter',
});

// Define viewport metadata separately for better type checking and organization
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export const metadata: Metadata = {
  title: {
    default: 'DevOps Daily - The latest DevOps news, tutorials, and guides',
    template: '%s | DevOps Daily',
  },
  description:
    'Stay up to date with the latest DevOps practices, tools, and techniques. Dive into our comprehensive guides and tutorials to level up your skills.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://devops-daily.com'),
  alternates: {
    canonical: '/',
    types: {
      'application/rss+xml': '/feed.xml',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'DevOps Daily',
    title: 'DevOps Daily - The latest DevOps news, tutorials, and guides',
    description:
      'Stay up to date with the latest DevOps practices, tools, and techniques. Dive into our comprehensive guides and tutorials to level up your skills.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Daily',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DevOps Daily - The latest DevOps news, tutorials, and guides',
    description:
      'Stay up to date with the latest DevOps practices, tools, and techniques. Dive into our comprehensive guides and tutorials to level up your skills.',
    images: ['/og-image.png'],
    creator: '@thedevopsdaily',
    site: '@thedevopsdaily',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  generator: 'Next.js',
  applicationName: 'DevOps Daily',
  referrer: 'origin-when-cross-origin',
  keywords: [
    'DevOps',
    'CI/CD',
    'Cloud',
    'Kubernetes',
    'Docker',
    'Tutorials',
    'Guides',
    'Infrastructure as Code',
  ],
  authors: [{ name: 'DevOps Daily Team', url: 'https://devops-daily.com/authors' }],
  category: 'Technology',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    other: [
      {
        rel: 'mask-icon',
        url: '/safari-pinned-tab.svg',
        color: '#3b82f6',
      },
    ],
  },
  manifest: '/site.webmanifest',
  verification: {
    // TODO: Add verification codes when ready:
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
    // bing: 'your-bing-verification-code',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <GoogleAnalytics gaId="G-DRHMSC6G9R" />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="DevOps Daily RSS Feed"
          href="/feed.xml"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <WebsiteSchema />
        <script
          src="https://analytics.ahrefs.com/analytics.js"
          data-key="DDU3onGEafDWd/obeLf2Pw"
          async
        ></script>
      </head>
      <body
        className={`${inter.className} min-h-screen flex flex-col bg-background text-foreground antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SkipToContent />
          <Header />
          <main id="main-content" className="flex-1">{children}</main>
          <Footer />
          <CookieBanner />
          <PWAInstaller />
          <BookPromotionPopup />
          <KonamiCodeListener />
          <KeyboardShortcuts />
        </ThemeProvider>
      </body>
    </html>
  );
}
