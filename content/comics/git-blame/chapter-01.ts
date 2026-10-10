import content from './chapter-01.json';
import type { ComicChapterContent } from '@/components/comics/types';

if (content.scenes.some((scene) => scene.diagram && scene.diagram !== 'shutdown-request')) {
  throw new Error('Unknown comic diagram');
}

export const chapterOne: ComicChapterContent = {
  ...content,
  scenes: content.scenes.map(({ diagram, ...scene }) => ({
    ...scene,
    ...(diagram ? { diagram: 'shutdown-request' as const } : {}),
  })),
};
