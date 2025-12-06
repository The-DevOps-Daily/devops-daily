'use client';

import { parseMarkdown } from '@/lib/markdown';
import { CodeBlockWrapper } from '@/components/code-block-wrapper';
import { HeadingWrapper } from '@/components/heading-with-anchor';
import { useEffect, useRef } from 'react';

interface NewsDigestContentProps {
  content: string;
}

export function NewsDigestContent({ content }: NewsDigestContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;

    // Find all h2 elements (section headers like "Kubernetes", "CI/CD", etc.)
    const h2Elements = contentRef.current.querySelectorAll('h2');

    h2Elements.forEach((h2) => {
      // Create a wrapper div for the section
      const sectionWrapper = document.createElement('div');
      sectionWrapper.className =
        'news-section-box mb-8 py-6 pl-12 pr-6 border rounded-lg bg-card hover:border-primary/30 transition-all';

      // Get all elements between this h2 and the next h2 (or end of content)
      const elementsInSection: Element[] = [];
      let currentElement = h2.nextElementSibling;

      while (currentElement && currentElement.tagName !== 'H2') {
        elementsInSection.push(currentElement);
        currentElement = currentElement.nextElementSibling;
      }

      // Insert wrapper before h2
      h2.parentNode?.insertBefore(sectionWrapper, h2);

      // Move h2 and all section elements into the wrapper
      sectionWrapper.appendChild(h2);
      elementsInSection.forEach((el) => {
        sectionWrapper.appendChild(el);
      });
    });

    // Find all h3 elements (individual news items) and wrap them with their content
    const h3Elements = contentRef.current.querySelectorAll('h3');

    h3Elements.forEach((h3) => {
      // Create a wrapper div for the news item
      const itemWrapper = document.createElement('div');
      itemWrapper.className =
        'news-item-box mb-6 last:mb-0 py-5 pl-10 pr-5 border rounded-md bg-muted/30 hover:bg-muted/50 hover:border-primary/20 transition-all';

      // Get all elements until the next h3 or h2
      const elementsInItem: Element[] = [];
      let currentElement = h3.nextElementSibling;

      while (currentElement && currentElement.tagName !== 'H3' && currentElement.tagName !== 'H2') {
        elementsInItem.push(currentElement);
        currentElement = currentElement.nextElementSibling;
      }

      // Insert wrapper before h3
      h3.parentNode?.insertBefore(itemWrapper, h3);

      // Move h3 and all item elements into the wrapper
      itemWrapper.appendChild(h3);
      elementsInItem.forEach((el) => {
        itemWrapper.appendChild(el);
      });
    });
  }, []);

  const htmlContent = parseMarkdown(content);

  return (
    <HeadingWrapper>
      <CodeBlockWrapper>
        <div
          ref={contentRef}
          className="prose prose-lg dark:prose-invert max-w-none
            prose-headings:scroll-mt-24
            prose-h2:text-2xl prose-h2:font-bold prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border
            prose-h3:text-lg prose-h3:font-semibold prose-h3:mb-3 prose-h3:text-foreground
            prose-pre:bg-muted prose-pre:text-muted-foreground
            prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-mono prose-code:text-sm
            prose-blockquote:border-l-primary prose-blockquote:bg-muted/10 prose-blockquote:my-6 prose-blockquote:py-2
            prose-img:rounded-lg prose-img:shadow-lg
            prose-a:text-primary hover:prose-a:text-primary/80 prose-a:transition-colors prose-a:no-underline hover:prose-a:underline
            prose-strong:text-foreground prose-strong:font-semibold
            prose-ul:list-none prose-ul:pl-0
            prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:mb-3
            prose-table:overflow-hidden prose-table:rounded-lg prose-table:shadow
            prose-th:bg-muted prose-td:border-border"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </CodeBlockWrapper>
    </HeadingWrapper>
  );
}
