import { parseMarkdown } from '@/lib/markdown';
import { CodeBlockWrapper } from '@/components/code-block-wrapper';
import { HeadingWrapper } from '@/components/heading-with-anchor';

interface PostContentProps {
  content: string;
}

export function PostContent({ content }: PostContentProps) {
  // Convert markdown to HTML
  const htmlContent = parseMarkdown(content);

  return (
    <HeadingWrapper>
      <CodeBlockWrapper>
        <div
          className="prose prose-lg dark:prose-invert max-w-none
            prose-headings:scroll-mt-24
            prose-pre:bg-muted prose-pre:text-muted-foreground
            prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-mono prose-code:text-sm
            prose-blockquote:border-l-primary prose-blockquote:bg-muted/10
            prose-img:rounded-lg prose-img:shadow-lg
            prose-a:text-primary hover:prose-a:text-primary/80 prose-a:transition-colors
            prose-strong:text-foreground
            prose-ul:list-disc prose-ol:list-decimal
            prose-table:rounded-lg prose-table:shadow
            prose-th:bg-muted prose-td:border-border"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </CodeBlockWrapper>
    </HeadingWrapper>
  );
}
