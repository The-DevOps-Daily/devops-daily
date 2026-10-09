import Link from 'next/link';
import { ArrowDown, Download } from 'lucide-react';
import { gitBlame } from '@/content/comics/git-blame/series';
import type { ComicChapterContent } from './types';
import styles from './chapter-reader.module.css';

export function ChapterCover({ chapter }: { chapter: ComicChapterContent }) {
  const number = gitBlame.chapters.find((item) => item.slug === chapter.id)?.number;
  return (
    <header className={styles.cover} data-comic-cover>
      <div className={styles.coverInner}>
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/comics">Comics</Link>
            </li>
            <li>
              <span aria-hidden="true">/</span>
              <Link href="/comics/git-blame">git blame</Link>
            </li>
            <li>
              <span aria-hidden="true">/</span>
              <span aria-current="page">Chapter {number}</span>
            </li>
          </ol>
        </nav>
        <div className={styles.masthead}>
          <Link href="/comics/git-blame" className={styles.seriesMark}>
            git blame
          </Link>
          <span className={styles.publisher}>A DevOps Daily original</span>
        </div>
        <div className={styles.coverMeta}>
          <span>Volume 1 · {chapter.volume}</span>
          {gitBlame.preview && <span className={styles.preview}>Preview edition</span>}
        </div>
        <p className={styles.chapterNumber}>Chapter {String(number).padStart(2, '0')}</p>
        <h1 id="chapter-title" className={styles.title}>
          {chapter.title}
        </h1>
        <p className={styles.description}>{chapter.description}</p>
        <div className={styles.coverActions}>
          <a href="#story" className={styles.primaryAction}>
            Start reading <ArrowDown size={18} aria-hidden="true" />
          </a>
          <a href={gitBlame.pdf} download className={styles.secondaryAction}>
            <Download size={18} aria-hidden="true" />{' '}
            {gitBlame.preview ? 'Download preview PDF' : 'Download PDF'}
          </a>
        </div>
      </div>
    </header>
  );
}
