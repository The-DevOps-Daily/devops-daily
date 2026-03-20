import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Learn how DevOps Daily collects, uses, and protects your personal information',
  alternates: {
    canonical: '/privacy',
  },
  openGraph: {
    title: 'Privacy Policy - DevOps Daily',
    description: 'Learn how DevOps Daily collects, uses, and protects your personal information.',
    type: 'website',
    url: '/privacy',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Daily Privacy Policy',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Privacy Policy - DevOps Daily',
    description: 'Learn how DevOps Daily collects, uses, and protects your personal information.',
    images: ['/og-image.png'],
  },
};

export default function PrivacyPage() {
  return (
    <div className="container px-4 py-8 mx-auto">
      <PageHeader title="Privacy Policy" description="Last updated: March 20, 2026" />

      <div className="max-w-4xl mx-auto prose dark:prose-invert">
        <h2>Introduction</h2>
        <p>
          At DevOps Daily, we take your privacy seriously. This Privacy Policy explains how we
          collect, use, disclose, and safeguard your information when you visit our website
          devops-daily.com (the "Site"). Please read this privacy policy carefully.
        </p>

        <h2>Information We Collect</h2>

        <h3>Information You Provide to Us</h3>
        <p>We may collect information you provide directly to us, such as when you:</p>
        <ul>
          <li>Subscribe to our newsletter or RSS feed</li>
          <li>Contact us with questions or feedback</li>
          <li>Comment on our blog posts (if commenting is enabled)</li>
          <li>Submit content or contribute to our site</li>
        </ul>

        <h3>Information Automatically Collected</h3>
        <p>
          When you visit our Site, we automatically collect certain information about your device,
          including:
        </p>
        <ul>
          <li>IP address</li>
          <li>Browser type and version</li>
          <li>Operating system</li>
          <li>Pages you view and links you click</li>
          <li>Date and time of your visit</li>
          <li>Referring website address</li>
        </ul>

        <h2>How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Provide, maintain, and improve our Site</li>
          <li>Send you newsletters and updates (with your consent)</li>
          <li>Respond to your comments, questions, and requests</li>
          <li>Monitor and analyze usage patterns and trends</li>
          <li>Detect, prevent, and address technical issues</li>
          <li>Protect against fraudulent or illegal activity</li>
        </ul>

        <h2>Cookies and Tracking Technologies</h2>
        <p>
          We use cookies and similar tracking technologies to track activity on our Site and collect
          certain information. You can instruct your browser to refuse all cookies or to indicate
          when a cookie is being sent.
        </p>

        <h3>Types of Cookies We Use</h3>
        <ul>
          <li>
            <strong>Essential Cookies:</strong> Required for the Site to function properly
          </li>
          <li>
            <strong>Analytics Cookies:</strong> Help us understand how visitors use our Site
          </li>
          <li>
            <strong>Preference Cookies:</strong> Remember your settings and preferences
          </li>
        </ul>

        <h2>Third-Party Services</h2>
        <p>
          We may use third-party services that collect, monitor, and analyze visitor information:
        </p>

        <h3>Analytics</h3>
        <p>
          We use Ahrefs Analytics to track and analyze Site usage. This service may use cookies and
          similar technologies to collect information about how you use our Site. You can learn more
          about Ahrefs&apos; privacy practices on their website.
        </p>

        <h3>Comments</h3>
        <p>
          We use Giscus, a comments system powered by GitHub Discussions. When you leave a comment,
          you authenticate via GitHub, and your comment data is stored in GitHub Discussions on our
          public repository. GitHub&apos;s privacy policy governs the data collected through this
          service.
        </p>

        <h3>Content Delivery Networks (CDN)</h3>
        <p>
          We use Cloudflare Pages to host and deliver our Site. Cloudflare may collect basic
          technical information about your visits, including IP address and request metadata, as
          part of their service operation.
        </p>

        <h2>Data Security</h2>
        <p>
          We implement appropriate technical and organizational security measures to protect your
          personal information. However, no method of transmission over the Internet is 100% secure,
          and we cannot guarantee absolute security.
        </p>

        <h2>Data Retention</h2>
        <p>
          We retain personal information only for as long as necessary to fulfill the purposes
          outlined in this Privacy Policy, unless a longer retention period is required by law.
        </p>

        <h2>Your Rights</h2>
        <p>
          Depending on your location, you may have the following rights regarding your personal
          information:
        </p>
        <ul>
          <li>
            <strong>Access:</strong> Request a copy of the personal information we hold about you
          </li>
          <li>
            <strong>Correction:</strong> Request correction of inaccurate personal information
          </li>
          <li>
            <strong>Deletion:</strong> Request deletion of your personal information
          </li>
          <li>
            <strong>Portability:</strong> Request transfer of your personal information
          </li>
          <li>
            <strong>Objection:</strong> Object to our processing of your personal information
          </li>
        </ul>

        <h2>Children's Privacy</h2>
        <p>
          Our Site is not intended for children under 13 years of age. We do not knowingly collect
          personal information from children under 13.
        </p>

        <h2>International Data Transfers</h2>
        <p>
          Your information may be transferred to and processed in countries other than your own.
          These countries may have data protection laws that differ from your country.
        </p>

        <h2>Changes to This Privacy Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of any changes by
          posting the new Privacy Policy on this page and updating the "Last updated" date.
        </p>

        <h2>Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy or our privacy practices, please contact
          us at:
        </p>
        <ul>
          <li>Email: info@devops-daily.com</li>
        </ul>

        <h2>Legal Bases for Processing (GDPR)</h2>
        <p>
          If you are from the European Economic Area (EEA), our legal bases for processing your
          personal information include:
        </p>
        <ul>
          <li>Your consent</li>
          <li>Performance of a contract</li>
          <li>Compliance with legal obligations</li>
          <li>Protection of vital interests</li>
          <li>Legitimate interests</li>
        </ul>
      </div>
    </div>
  );
}
