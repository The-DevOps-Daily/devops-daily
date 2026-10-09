import { ComicScene } from './comic-scene';
import type { ComicChapterContent } from './types';
import styles from './chapter-reader.module.css';

export function ChapterReader({ chapter }: { chapter: ComicChapterContent }) {
  return (
    <article className={styles.chapter} aria-labelledby="chapter-title">
      <div className={styles.reader}>
        <header className={styles.header}>
          <p className={styles.publisher}>DevOps Daily presents</p>
          <p className={styles.series}>git blame</p>
          <p className={styles.tagline}>Production is down. Everyone has a theory.</p>
          <p className={styles.volume}>Chapter 1 · {chapter.volume}</p>
          <h1 id="chapter-title">{chapter.title}</h1>
          <p>{chapter.description}</p>
        </header>
        <div className={styles.scenes}>
          {chapter.scenes.map((scene, index) => (
            <ComicScene key={scene.id} scene={scene} priority={index === 0} />
          ))}
        </div>
        <p className={styles.end}>End of Chapter 1</p>
        <details className={styles.notes}>
          <summary>
            <h2>Under the Hood</h2>
          </summary>
          <div className={styles.notesBody}>
            <p>
              <strong>{chapter.technicalNotes.lead}</strong>
            </p>
            {chapter.technicalNotes.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <ul>
              {chapter.technicalNotes.caveats.map((caveat) => (
                <li key={caveat}>{caveat}</li>
              ))}
            </ul>
            <p>{chapter.technicalNotes.footer}</p>
            <h3>Read further</h3>
            <ul>
              {chapter.technicalNotes.links.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </details>
      </div>
    </article>
  );
}
