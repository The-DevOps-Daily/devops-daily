import { ComicScene } from './comic-scene';
import { TechnicalNotes } from './technical-notes';
import { chapterOne } from '@/content/comics/git-blame/chapter-01';
import { gitBlame } from '@/content/comics/git-blame/series';
import styles from './print-edition.module.css';

export function PrintEdition() {
  return (
    <article className={styles.edition} data-comic-print>
      <section className={styles.cover}>
        <p>DevOps Daily presents</p>
        <p className={styles.series}>git blame</p>
        <p>{gitBlame.tagline}</p>
        <h1>{chapterOne.title}</h1>
        <p>Chapter 1 · Volume 1: {chapterOne.volume}</p>
        {gitBlame.preview && <p>Preview edition</p>}
        {/* Cover lettering remains selectable, separate from the original art. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/comics/git-blame/chapter-01/scene-01.jpg"
          alt="Sam and Maya at ShipIt."
          width="480"
          height="600"
        />
        <p className={styles.credit}>Published by DevOps Daily · devops-daily.com</p>
      </section>
      {chapterOne.scenes.map((scene, index) => (
        <section key={scene.id} className={styles.page} data-print-page>
          <p className={styles.folio}>
            git blame · Chapter 1{' '}
            <span>
              {index + 1} / {chapterOne.scenes.length}
            </span>
          </p>
          <ComicScene
            scene={{
              ...scene,
              // Native JPEGs avoid Chromium expanding WebP into huge PDF bitmaps.
              artwork: { ...scene.artwork, sources: [] },
            }}
            priority
          />
        </section>
      ))}
      <section className={styles.afterword}>
        <TechnicalNotes notes={chapterOne.technicalNotes} print />
        <p className={styles.credit}>
          ShipIt and its engineers are fictional. Published by DevOps Daily. Read online at{' '}
          <a href="https://devops-daily.com/comics/git-blame">devops-daily.com/comics/git-blame</a>.
        </p>
      </section>
    </article>
  );
}
