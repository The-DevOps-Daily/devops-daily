import { parseMarkdown } from '@/lib/markdown';
import { CodeBlockWrapper } from '@/components/code-block-wrapper';
import { HeadingWrapper } from '@/components/heading-with-anchor';

interface GuideContentProps {
  guide?: {
    title: string;
    description: string;
    content: string;
  };
  content?: string;
}

export function GuideContent({ guide, content }: GuideContentProps) {
  if (guide) {
    const htmlContent = parseMarkdown(guide.content);

    return (
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{guide.title}</h1>
        <p className="mt-4 text-xl text-muted-foreground">{guide.description}</p>
        <HeadingWrapper>
          <CodeBlockWrapper>
            <div
              className="mt-8 prose prose-lg dark:prose-invert max-w-none
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
      </div>
    );
  }

  if (content) {
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

  return null;
}
