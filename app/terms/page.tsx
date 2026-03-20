// app/terms/page.tsx
import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms and conditions for using DevOps Daily website and services. This page outlines the rules and regulations for using our site, including user contributions, acceptable use, and limitations of liability.',
  alternates: {
    canonical: '/terms',
  },
  openGraph: {
    title: 'Terms of Service - DevOps Daily',
    description:
      'Read the terms and conditions for using DevOps Daily website and services. This page outlines the rules and regulations for using our site, including user contributions, acceptable use, and limitations of liability.',
    type: 'website',
    url: '/terms',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Daily Terms of Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terms of Service - DevOps Daily',
    description:
      'Read the terms and conditions for using DevOps Daily website and services. This page outlines the rules and regulations for using our site, including user contributions, acceptable use, and limitations of liability.',
    images: ['/og-image.png'],
  },
};

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader title="Terms of Service" description="Last updated: March 20, 2026" />

      <div className="prose dark:prose-invert max-w-4xl mx-auto">
        <h2>1. Agreement to Terms</h2>
        <p>
          By accessing and using DevOps Daily (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;)
          website at devops-daily.com (the &quot;Site&quot;), you agree to be bound by these Terms
          of Service (&quot;Terms&quot;). If you disagree with any part of these terms, then you may
          not access the Site. These Terms apply to all visitors, users, and others who access the
          Site.
        </p>

        <h2>2. Use License</h2>
        <p>
          Permission is granted to temporarily download one copy of the materials on DevOps Daily
          for personal, non-commercial transitory viewing only. This is the grant of a license, not
          a transfer of title, and under this license you may not:
        </p>
        <ul>
          <li>Modify or copy the materials</li>
          <li>Use the materials for any commercial purpose or for any public display</li>
          <li>Attempt to reverse engineer any software contained on the Site</li>
          <li>Remove any copyright or other proprietary notations from the materials</li>
        </ul>
        <p>
          This license shall automatically terminate if you violate any of these restrictions and
          may be terminated by DevOps Daily at any time.
        </p>

        <h2>3. Content Ownership</h2>

        <h3>Our Content</h3>
        <p>
          Unless otherwise indicated, all content on the Site — including tutorials, guides,
          exercises, quizzes, code examples, graphics, logos, and software — is the property of
          DevOps Daily or its content contributors and is protected by international copyright laws.
        </p>

        <h3>Open Source and Code Examples</h3>
        <p>
          Code examples provided in tutorials and guides are offered for educational purposes. You
          may use them in your own projects, but the accompanying explanatory text, structure, and
          presentation remain our intellectual property.
        </p>

        <h3>User Contributions</h3>
        <p>
          If you submit content to our Site (such as comments via GitHub Discussions, pull requests,
          or guest posts), you grant us a non-exclusive, worldwide, royalty-free, irrevocable,
          sub-licensable license to use, reproduce, adapt, publish, translate, and distribute your
          content in any media.
        </p>

        <h2>4. Acceptable Use</h2>
        <p>You may not use our Site:</p>
        <ul>
          <li>For any unlawful purpose</li>
          <li>To solicit others to perform unlawful acts</li>
          <li>
            To violate any international, federal, provincial, or state regulations, rules, laws, or
            local ordinances
          </li>
          <li>
            To infringe upon or violate our intellectual property rights or the intellectual
            property rights of others
          </li>
          <li>
            To harass, abuse, insult, harm, defame, slander, disparage, intimidate, or discriminate
          </li>
          <li>To submit false or misleading information</li>
          <li>To upload or transmit viruses or any other type of malicious code</li>
          <li>To interfere with or circumvent the security features of the Site</li>
        </ul>

        <h2>5. Privacy</h2>
        <p>
          Your use of our Site is also governed by our Privacy Policy. Please review our Privacy
          Policy, which also governs the Site and informs users of our data collection practices.
        </p>

        <h2>6. Disclaimers</h2>

        <h3>General Disclaimer</h3>
        <p>
          The information on DevOps Daily is provided on an "as is" basis. DevOps Daily makes no
          warranties, expressed or implied, and hereby disclaims and negates all other warranties
          including, without limitation, implied warranties or conditions of merchantability,
          fitness for a particular purpose, or non-infringement of intellectual property.
        </p>

        <h3>Professional Disclaimer</h3>
        <p>
          The content on this Site is for informational and educational purposes only. DevOps
          tutorials, guides, and code examples are provided as learning resources and should not be
          construed as professional consulting advice. Always test configurations in non-production
          environments first, and seek the advice of qualified professionals for production
          infrastructure decisions.
        </p>

        <h3>Accuracy of Information</h3>
        <p>
          While we strive to provide accurate and up-to-date information, DevOps tools, cloud
          services, and best practices evolve rapidly. Command syntax, API versions, and
          configuration options may change. We make no representations about the completeness,
          reliability, or accuracy of this information. Always refer to official documentation for
          the most current details.
        </p>

        <h2>7. Limitations of Liability</h2>
        <p>
          In no event shall DevOps Daily or its suppliers be liable for any damages (including,
          without limitation, damages for loss of data or profit, or due to business interruption)
          arising out of the use or inability to use the materials on the Site, even if DevOps Daily
          or a DevOps Daily authorized representative has been notified orally or in writing of the
          possibility of such damage.
        </p>

        <h2>8. External Links</h2>
        <p>
          Our Site may contain links to external websites that are not provided or maintained by us.
          We do not guarantee the accuracy, relevance, timeliness, or completeness of any
          information on these external websites.
        </p>

        <h2>9. Indemnification</h2>
        <p>
          You agree to defend, indemnify, and hold harmless DevOps Daily and its licensee and
          licensors, and their employees, contractors, agents, officers and directors, from and
          against any and all claims, damages, obligations, losses, liabilities, costs or debt, and
          expenses (including but not limited to attorney's fees).
        </p>

        <h2>10. Termination</h2>
        <p>
          We may terminate or suspend your access to our Site immediately, without prior notice or
          liability, for any reason whatsoever, including without limitation if you breach the
          Terms.
        </p>

        <h2>11. Governing Law</h2>
        <p>
          These Terms shall be governed and construed in accordance with the laws of the State of
          Delaware, United States, without regard to its conflict of law provisions. Our failure to
          enforce any right or provision of these Terms will not be considered a waiver of those
          rights.
        </p>

        <h2>12. Changes to Terms</h2>
        <p>
          We reserve the right, at our sole discretion, to modify or replace these Terms at any
          time. If a revision is material, we will try to provide at least 30 days notice prior to
          any new terms taking effect.
        </p>

        <h2>13. Contact Information</h2>
        <p>If you have any questions about these Terms, please contact us at:</p>
        <ul>
          <li>Email: info@devops-daily.com</li>
        </ul>

        <h2>14. Entire Agreement</h2>
        <p>
          These Terms constitute the entire agreement between us regarding our Site and supersede
          and replace any prior agreements we might have between us regarding the Site.
        </p>

        <h2>15. Severability</h2>
        <p>
          If any provision of these Terms is held to be invalid or unenforceable by a court, the
          remaining provisions of these Terms will remain in effect.
        </p>
      </div>
    </div>
  );
}
