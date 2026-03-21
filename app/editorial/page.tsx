import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = {
  title: 'Editorial Standards & Correction Policy',
  description:
    'Learn how DevOps Daily creates, reviews, and maintains technical content. Our editorial standards, fact-checking process, correction policy, and AI disclosure.',
  alternates: {
    canonical: '/editorial',
  },
  openGraph: {
    title: 'Editorial Standards & Correction Policy - DevOps Daily',
    description:
      'Learn how DevOps Daily creates, reviews, and maintains technical content. Our editorial standards, fact-checking process, and correction policy.',
    type: 'website',
    url: '/editorial',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DevOps Daily Editorial Standards',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Editorial Standards & Correction Policy - DevOps Daily',
    description:
      'How DevOps Daily creates, reviews, and maintains technical content.',
    images: ['/og-image.png'],
  },
};

export default function EditorialPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Editorial Standards & Correction Policy"
        description="Last updated: March 21, 2026"
      />

      <div className="prose dark:prose-invert max-w-4xl mx-auto">
        <h2>Our Mission</h2>
        <p>
          DevOps Daily exists to provide accurate, practical, and up-to-date technical education for
          DevOps engineers at every level. We believe in learning by doing, which is why our content
          emphasizes hands-on examples, real-world scenarios, and production-ready practices over
          theoretical abstractions.
        </p>

        <h2>How Content Is Created</h2>

        <h3>Content Types</h3>
        <p>We publish several types of educational content, each with its own creation process:</p>
        <ul>
          <li>
            <strong>Tutorials and Blog Posts:</strong> Focused articles on specific DevOps topics,
            tools, and techniques. Each post includes practical code examples that readers can follow
            along with.
          </li>
          <li>
            <strong>Comprehensive Guides:</strong> Multi-part, in-depth learning resources covering a
            technology from fundamentals to advanced topics. Guides are structured as sequential
            chapters.
          </li>
          <li>
            <strong>Hands-on Exercises:</strong> Step-by-step labs with commands, expected output, and
            validation criteria. Designed for active learning.
          </li>
          <li>
            <strong>Quizzes and Flashcards:</strong> Knowledge assessment tools with detailed
            explanations for each answer.
          </li>
          <li>
            <strong>Weekly News Digests:</strong> Curated roundups of DevOps news from primary
            sources, published weekly.
          </li>
        </ul>

        <h3>Creation Process</h3>
        <p>Every piece of content follows this workflow:</p>
        <ol>
          <li>
            <strong>Topic research:</strong> We identify topics based on community demand, emerging
            technologies, and gaps in existing coverage.
          </li>
          <li>
            <strong>Drafting:</strong> Content is written with a focus on accuracy and practical
            utility. Code examples are tested against current versions of the tools they reference.
          </li>
          <li>
            <strong>Technical review:</strong> Content is reviewed for technical accuracy,
            completeness, and clarity before publication.
          </li>
          <li>
            <strong>Publication:</strong> Content is published with proper metadata, Open Graph tags,
            and structured data for discoverability.
          </li>
        </ol>

        <h2>Fact-Checking and Technical Accuracy</h2>
        <p>
          DevOps tools, cloud services, and best practices evolve rapidly. We take the following steps
          to maintain accuracy:
        </p>
        <ul>
          <li>
            Code examples are tested against the specific tool versions mentioned in the article.
          </li>
          <li>
            Command syntax and configuration options are verified against official documentation.
          </li>
          <li>
            When referencing third-party tools or services, we link to primary sources rather than
            secondary aggregators.
          </li>
          <li>
            Posts that reference specific software versions include those versions in the content so
            readers know what was tested.
          </li>
        </ul>
        <p>
          Despite our best efforts, technology changes fast. If you find an inaccuracy, please report
          it using the &quot;Report Issue&quot; button on any content page or by opening an issue on
          our{' '}
          <a href="https://github.com/The-DevOps-Daily/devops-daily/issues">GitHub repository</a>.
        </p>

        <h2>Correction and Update Policy</h2>
        <p>We are committed to correcting errors promptly and transparently:</p>
        <ul>
          <li>
            <strong>Minor corrections</strong> (typos, formatting, broken links) are fixed without
            notice.
          </li>
          <li>
            <strong>Technical corrections</strong> (incorrect commands, wrong configuration values,
            outdated syntax) are updated and the <code>updatedAt</code> date is changed to reflect
            when the correction was made.
          </li>
          <li>
            <strong>Major corrections</strong> (fundamentally incorrect advice, security-impacting
            errors) are updated with a visible note at the top of the article explaining what was
            changed and why.
          </li>
        </ul>
        <p>
          All content changes are tracked in our public GitHub repository. Anyone can view the full
          history of changes to any piece of content.
        </p>

        <h2>Update Schedule</h2>
        <p>We maintain and refresh content on an ongoing basis:</p>
        <ul>
          <li>
            <strong>Weekly:</strong> New blog posts, news digests, and community content.
          </li>
          <li>
            <strong>Monthly:</strong> Review of popular posts for accuracy against latest tool
            releases.
          </li>
          <li>
            <strong>As needed:</strong> Immediate updates when a referenced tool ships a breaking
            change or deprecation.
          </li>
        </ul>

        <h2>AI-Assisted Content Disclosure</h2>
        <p>
          Some content on DevOps Daily is created with the assistance of AI tools. When AI is used, it
          is always under human editorial oversight:
        </p>
        <ul>
          <li>AI may be used to draft content, generate code examples, or suggest improvements.</li>
          <li>
            All AI-generated content is reviewed, tested, and edited by our team before publication.
          </li>
          <li>
            AI is never the sole author — a human editor verifies technical accuracy and ensures the
            content meets our standards.
          </li>
          <li>
            Code examples produced with AI assistance are tested in real environments before
            inclusion.
          </li>
        </ul>

        <h2>Sponsored and Affiliate Content</h2>
        <p>
          DevOps Daily may feature sponsored content or affiliate links. Our policy for handling these
          is straightforward:
        </p>
        <ul>
          <li>
            Sponsored posts are clearly labeled with a &quot;Sponsored&quot; badge at the top of the
            article.
          </li>
          <li>
            Affiliate links, if used, do not influence our editorial recommendations. We recommend
            tools based on their merit, not compensation.
          </li>
          <li>
            Our editorial team maintains full independence — sponsors do not have approval rights over
            content.
          </li>
          <li>
            For details on sponsorship opportunities, see our{' '}
            <a href="/sponsorship">Sponsorship page</a>.
          </li>
        </ul>

        <h2>Open Source Transparency</h2>
        <p>
          DevOps Daily is an open-source project. Our entire codebase, including all content, is
          publicly available on{' '}
          <a href="https://github.com/The-DevOps-Daily/devops-daily">GitHub</a>. This means:
        </p>
        <ul>
          <li>Anyone can verify our content and suggest improvements via pull requests.</li>
          <li>The full edit history of every article is publicly visible.</li>
          <li>
            Community contributions are welcome and follow our{' '}
            <a href="https://github.com/The-DevOps-Daily/devops-daily/blob/main/CONTRIBUTING.md">
              Contributing Guidelines
            </a>
            .
          </li>
        </ul>

        <h2>Contact Us</h2>
        <p>
          If you have questions about our editorial standards, want to report an error, or have
          feedback on our content:
        </p>
        <ul>
          <li>
            Email: <a href="mailto:info@devops-daily.com">info@devops-daily.com</a>
          </li>
          <li>
            GitHub:{' '}
            <a href="https://github.com/The-DevOps-Daily/devops-daily/issues">Open an issue</a>
          </li>
        </ul>
      </div>
    </div>
  );
}
