import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import { gitBlame } from '@/content/comics/git-blame/series';
import styles from './chapter-reader.module.css';

export function ChapterNavigation({ chapterId }: { chapterId: string }) {
  const index = gitBlame.chapters.findIndex((chapter) => chapter.slug === chapterId);
  const current = gitBlame.chapters[index];
  const previous = gitBlame.chapters[index - 1];
  const next = gitBlame.chapters[index + 1];
  return (
    <nav aria-label="Chapter navigation" className={styles.completion} data-comic-completion>
      <div className={styles.completionMain}>
        <p className={styles.chapterNumber}>git blame · Volume 1</p>
        <h2 className={styles.completionTitle}>End of Chapter {current?.number}</h2>
        <div className={styles.completionLinks}>
          <Link href="/comics/git-blame#chapters" className={styles.textLink}>
            <ArrowLeft size={18} aria-hidden="true" /> Series contents
          </Link>
          <a href="#chapter-title" className={styles.textLink}>
            <ArrowUp size={18} aria-hidden="true" /> Read again
          </a>
          {previous?.available && (
            <Link href={`/comics/git-blame/${previous.slug}`} className={styles.textLink}>
              Previous: {previous.title}
            </Link>
          )}
        </div>
      </div>
      {next && (
        <div className={styles.nextChapter}>
          <p className={styles.nextLabel}>Up next · Chapter {next.number}</p>
          <h3 className={styles.nextTitle}>
            {next.available ? (
              <Link href={`/comics/git-blame/${next.slug}`} className={styles.textLink}>
                {next.title} <ArrowRight size={18} aria-hidden="true" />
              </Link>
            ) : (
              next.title
            )}
          </h3>
          {next.available ? (
            <p className={styles.nextDescription}>{next.description}</p>
          ) : (
            <span className={styles.comingSoon}>Coming soon</span>
          )}
        </div>
      )}
    </nav>
  );
}
