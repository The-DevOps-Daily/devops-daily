import { MarkdownContent } from '@/components/markdown-content';

interface PostContentProps {
  content: string;
}

export function PostContent({ content }: PostContentProps) {
  return <MarkdownContent content={content} />;
}
