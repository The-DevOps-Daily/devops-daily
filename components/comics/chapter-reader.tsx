import { ChapterCover } from './chapter-cover';
import { ComicScene } from './comic-scene';
import { TechnicalNotes } from './technical-notes';
import { ChapterNavigation } from './chapter-navigation';
import type { ComicChapterContent } from './types';
import styles from './chapter-reader.module.css';

export function ChapterReader({ chapter }: { chapter: ComicChapterContent }) {
  return (
    <article className={styles.chapter} aria-labelledby="chapter-title">
      <ChapterCover chapter={chapter} />
      <div className={styles.reader}>
        <div id="story" className={styles.scenes}>
          {chapter.scenes.map((scene, index) => (
            <ComicScene key={scene.id} scene={scene} priority={index === 0} />
          ))}
        </div>
        <div className="mt-8">
          <TechnicalNotes notes={chapter.technicalNotes} />
        </div>
        <ChapterNavigation chapterId={chapter.id} />
      </div>
    </article>
  );
}
