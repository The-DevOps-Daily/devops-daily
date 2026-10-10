import type { Metadata } from 'next';
import { ComicScene } from '@/components/comics/comic-scene';
import { openingScene } from '@/content/comics/git-blame/proof';
import styles from './proof.module.css';

export const metadata: Metadata = {
  title: 'git blame — Opening scene proof',
  description: "A tiny Friday deployment. The opening of The Pod That Wouldn't Die.",
  alternates: { canonical: '/comics/git-blame/proof' },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function ComicProofPage() {
  return (
    <article className={styles.proof} aria-labelledby="chapter-title">
      <div className={styles.reader}>
        <header className={styles.header}>
          <p className={styles.publisher}>DevOps Daily presents</p>
          <p className={styles.series}>git blame</p>
          <p className={styles.tagline}>Production is down. Everyone has a theory.</p>
          <p className={styles.chapter}>Chapter 1 · Opening scene</p>
          <h1 id="chapter-title">The Pod That Wouldn&apos;t Die</h1>
          <p>A tiny Friday deployment turns green. Checkout has other ideas.</p>
        </header>
        <ComicScene scene={openingScene} priority />
        <p className={styles.endnote}>An opening scene from Volume 1: Everything Is Fine.</p>
      </div>
    </article>
  );
}
