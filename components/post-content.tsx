import { MarkdownContent } from '@/components/markdown-content';

interface PostContentProps {
  content: string;
  sponsored?: boolean;
}

export function PostContent({ content, sponsored }: PostContentProps) {
  return <MarkdownContent content={content} sponsored={sponsored} />;
}
