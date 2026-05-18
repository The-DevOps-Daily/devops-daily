import { MarkdownContent } from '@/components/markdown-content';

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
    return (
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{guide.title}</h1>
        <p className="mt-4 text-xl text-muted-foreground">{guide.description}</p>
        <MarkdownContent content={guide.content} className="mt-8" />
      </div>
    );
  }

  if (content) {
    return <MarkdownContent content={content} />;
  }

  return null;
}
