'use client';

import { parseMarkdown } from '@/lib/markdown';
import { CodeBlockWrapper } from '@/components/code-block-wrapper';
import { HeadingWrapper } from '@/components/heading-with-anchor';
import { MarkdownContent, MarkdownHtml } from '@/components/markdown-content';
import { SolutionReveal } from '@/components/advent-solution-reveal';

interface AdventPostContentProps {
  content: string;
}

export function AdventPostContent({ content }: AdventPostContentProps) {
  // Split content by the "## Solution" heading
  const solutionHeadingRegex = /^## Solution$/m;
  const parts = content.split(solutionHeadingRegex);

  // If there's no solution section, render normally
  if (parts.length === 1) {
    return <MarkdownContent content={content} />;
  }

  // Split solution section from the rest
  const beforeSolution = parts[0];
  const solutionAndAfter = parts[1];

  // Find where the hidden content ends (after Explanation, before Result/Validation/Links/Share)
  // We want to hide: Solution, Explanation
  // We want to show: Result, Validation, Links, Share Your Success
  const nextVisibleSectionMatch = solutionAndAfter.match(/\n## (Result|Validation|Links|Share Your Success)/);
  const solutionContent = nextVisibleSectionMatch
    ? solutionAndAfter.substring(0, nextVisibleSectionMatch.index)
    : solutionAndAfter;
  const afterSolution = nextVisibleSectionMatch
    ? solutionAndAfter.substring(nextVisibleSectionMatch.index!)
    : '';

  // Parse each section
  const beforeHtml = parseMarkdown(beforeSolution);
  const solutionHtml = parseMarkdown('## Solution\n' + solutionContent);
  const afterHtml = afterSolution ? parseMarkdown(afterSolution) : '';

  return (
    <HeadingWrapper>
      <CodeBlockWrapper>
        {/* Content before solution */}
        <MarkdownHtml html={beforeHtml} />

        {/* Solution section - wrapped in reveal */}
        <SolutionReveal title="View Solution">
          <MarkdownHtml html={solutionHtml} />
        </SolutionReveal>

        {/* Content after solution */}
        {afterHtml && <MarkdownHtml html={afterHtml} />}
      </CodeBlockWrapper>
    </HeadingWrapper>
  );
}
