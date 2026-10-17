import { parseMarkdown } from '@/lib/markdown';
import { splitAdventSolution } from '@/lib/advent-solution';
import { CodeBlockWrapper } from '@/components/code-block-wrapper';
import { HeadingWrapper } from '@/components/heading-with-anchor';
import { MarkdownContent } from '@/components/markdown-content';
import { MarkdownHtml } from '@/components/markdown-html';
import { SolutionReveal } from '@/components/advent-solution-reveal';

interface AdventPostContentProps {
  content: string;
}

export function AdventPostContent({ content }: AdventPostContentProps) {
  // Solution and Explanation stay hidden; Result, Validation, Links and
  // Share Your Success stay visible after the reveal.
  const parts = splitAdventSolution(content);

  if (!parts) {
    return <MarkdownContent content={content} />;
  }

  return (
    <HeadingWrapper>
      <CodeBlockWrapper>
        <MarkdownHtml html={parseMarkdown(parts.before)} />

        <SolutionReveal title="View Solution">
          <MarkdownHtml html={parseMarkdown(parts.solution)} />
        </SolutionReveal>

        {parts.after && <MarkdownHtml html={parseMarkdown(parts.after)} />}
      </CodeBlockWrapper>
    </HeadingWrapper>
  );
}
