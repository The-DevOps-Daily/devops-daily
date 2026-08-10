import type React from 'react';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { ThemeProvider } from '@/components/theme-provider';
import { OrganizationSchema, WebsiteSchema } from '@/components/schema-markup';
import { CookieBanner } from '@/components/cookie-banner';
import { PWAInstaller } from '@/components/pwa-installer';
import { SkipToContent } from '@/components/skip-to-content';
import Script from 'next/script';
import { SiteAnalytics } from '@/components/site-analytics';
import { DeferredSiteExtras } from '@/components/deferred-site-extras';

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
  authors: [{ name: 'DevOps Daily Team', url: 'https://devops-daily.com/experts' }],
  category: 'Technology',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/site.webmanifest',
  verification: {
    // TODO: Add verification codes when ready:
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
    // bing: 'your-bing-verification-code',
  },
  other: {
    'facebook-domain-verification': 'j9iuktnx8kdm881pb70zvbkjept48t',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google Consent Mode v2. Must run before gtag.js, so it lives here
            rather than in SiteAnalytics: `beforeInteractive` is only supported
            in the root layout.

            Analytics storage starts denied, so GA loads for every visitor but
            sets no cookies until someone allows it. That gives cookieless
            pings for everyone and full data after consent.

            Before this, GA did not load at all without consent, so the site
            counted only the few people who clicked the banner. Real traffic
            was ~7k uniques a day while GA reported a couple of hundred. */}
        <Script id="consent-mode-default" strategy="beforeInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;
var c=null;try{c=localStorage.getItem('cookie-consent');if(c===null&&localStorage.getItem('cookieAccepted')==='true'){c='accepted';}}catch(e){}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:c==='accepted'?'granted':'denied',functionality_storage:'granted',personalization_storage:'denied',security_storage:'granted',wait_for_update:500});`}
        </Script>
        <link
          rel="alternate"
          type="application/rss+xml"
          title="DevOps Daily RSS Feed"
          href="/feed.xml"
        />
        <OrganizationSchema />
        <WebsiteSchema />
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
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer />
          <CookieBanner />
          <PWAInstaller />
          <SiteAnalytics />
          <DeferredSiteExtras />
        </ThemeProvider>
      </body>
    </html>
  );
}
