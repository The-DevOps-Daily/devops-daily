import type { Ref } from 'react';
import { parseMarkdown } from '@/lib/markdown';
import { cn } from '@/lib/utils';
import { CodeBlockWrapper } from '@/components/code-block-wrapper';
import { HeadingWrapper } from '@/components/heading-with-anchor';

const PROSE_CLASS =
  'prose prose-lg dark:prose-invert max-w-none prose-headings:scroll-mt-24 prose-pre:bg-muted prose-pre:text-muted-foreground prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-mono prose-code:text-sm prose-blockquote:border-l-primary prose-blockquote:bg-muted/10 prose-img:rounded-lg prose-img:shadow-lg prose-a:text-primary hover:prose-a:text-primary/80 prose-a:transition-colors prose-strong:text-foreground prose-ul:list-disc prose-ol:list-decimal prose-table:rounded-lg prose-table:shadow prose-th:bg-muted prose-td:border-border';

interface MarkdownHtmlProps {
  html: string;
  className?: string;
  htmlRef?: Ref<HTMLDivElement>;
}

export function MarkdownHtml({ html, className, htmlRef }: MarkdownHtmlProps) {
  return (
    <div
      ref={htmlRef}
      className={cn(PROSE_CLASS, className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <HeadingWrapper>
      <CodeBlockWrapper>
        <MarkdownHtml html={parseMarkdown(content)} className={className} />
      </CodeBlockWrapper>
    </HeadingWrapper>
  );
}
