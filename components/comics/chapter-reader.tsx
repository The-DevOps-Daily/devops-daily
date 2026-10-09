import { BookOpen, Download } from 'lucide-react';
import { PageHero } from '@/components/page-hero';
import { comicButtonClasses as buttonVariants } from '@/components/comics/button-style';
import { gitBlame } from '@/content/comics/git-blame/series';
import { ComicScene } from './comic-scene';
import { TechnicalNotes } from './technical-notes';
import { ChapterNavigation } from './chapter-navigation';
import type { ComicChapterContent } from './types';
import styles from './chapter-reader.module.css';

export function ChapterReader({ chapter }: { chapter: ComicChapterContent }) {
  const number = gitBlame.chapters.find((item) => item.slug === chapter.id)?.number;
  return (
    <article className={styles.chapter} aria-labelledby="chapter-title">
      <div className="[&_*]:animate-none">
        <PageHero
          title={chapter.title}
          titleId="chapter-title"
          description={chapter.description}
          icon={BookOpen}
          breadcrumbs={[
            { label: 'Comics', href: '/comics' },
            { label: 'git blame', href: '/comics/git-blame' },
            { label: `Chapter ${number}` },
          ]}
          badge={`Chapter ${number} · ${chapter.volume}${gitBlame.preview ? ' · Preview' : ''}`}
        >
          <div className="flex flex-wrap gap-4 items-center">
            <p className="text-sm text-muted-foreground">
              A story from <strong>git blame</strong> · {chapter.scenes.length} scenes
            </p>
            <a
              href={gitBlame.pdf}
              download
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <Download className="size-4" aria-hidden="true" />{' '}
              {gitBlame.preview ? 'Download preview PDF' : 'Download PDF'}
            </a>
          </div>
        </PageHero>
      </div>
      <div className={styles.reader}>
        <div className={styles.scenes}>
          {chapter.scenes.map((scene, index) => (
            <ComicScene key={scene.id} scene={scene} priority={index === 0} />
          ))}
        </div>
        <p className={styles.end}>End of Chapter {number}</p>
        <ChapterNavigation chapterId={chapter.id} />
        <div className="mt-8">
          <TechnicalNotes notes={chapter.technicalNotes} />
        </div>
        <p className="mt-8 text-center text-sm">
          <a href="#chapter-title" className="underline underline-offset-4">
            Back to the beginning
          </a>
        </p>
      </div>
    </article>
  );
}
