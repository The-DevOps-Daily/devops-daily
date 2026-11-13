import { parseMarkdown } from '@/lib/markdown';
import { MarkdownHtml } from '@/components/markdown-html';
import { CodeBlockWrapper } from '@/components/code-block-wrapper';
import { ChartBlockWrapper } from '@/components/post-chart-blocks';
import { TerminalBlockWrapper, TabsBlockWrapper } from '@/components/post-interactive-blocks';
import { DiagramBlockWrapper } from '@/components/post-diagram-blocks';
import { GithubEmbedWrapper } from '@/components/post-github-embed';
import { HeadingWrapper } from '@/components/heading-with-anchor';

interface MarkdownContentProps {
  content: string;
  className?: string;
  /** A post a sponsor paid for: its outside links get rel="sponsored". */
  sponsored?: boolean;
}

export function MarkdownContent({ content, className, sponsored = false }: MarkdownContentProps) {
  return (
    <HeadingWrapper>
      <CodeBlockWrapper>
        <ChartBlockWrapper>
          <TerminalBlockWrapper>
            <TabsBlockWrapper>
              <DiagramBlockWrapper>
                <GithubEmbedWrapper>
                  <MarkdownHtml html={parseMarkdown(content, sponsored)} className={className} />
                </GithubEmbedWrapper>
              </DiagramBlockWrapper>
            </TabsBlockWrapper>
          </TerminalBlockWrapper>
        </ChartBlockWrapper>
      </CodeBlockWrapper>
    </HeadingWrapper>
  );
}
