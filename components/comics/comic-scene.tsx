import Image from 'next/image';
import type { ComicSceneContent } from './types';
import { SpeechBubble } from './speech-bubble';
import { ShutdownRequestDiagram } from './shutdown-request-diagram';
import styles from './comic-scene.module.css';

export function ComicScene({
  scene,
  priority = false,
}: {
  scene: ComicSceneContent;
  priority?: boolean;
}) {
  return (
    <figure
      className={styles.scene}
      aria-labelledby={scene.caption ? `${scene.id}-caption` : undefined}
      aria-label={scene.caption ? undefined : scene.label}
      data-comic-scene={scene.id}
    >
      {scene.caption && (
        <figcaption id={`${scene.id}-caption`} className={styles.caption}>
          {scene.caption}
        </figcaption>
      )}
      <div className={styles.canvas} data-comic-canvas>
        <picture>
          <source
            type="image/webp"
            srcSet={scene.artwork.sources
              .map((source) => `${source.src} ${source.width}w`)
              .join(', ')}
            sizes="(min-width: 832px) 768px, calc(100vw - 32px)"
          />
          <Image
            data-comic-art
            className={styles.art}
            src={scene.artwork.src}
            alt={scene.artwork.alt}
            width={scene.artwork.width}
            height={scene.artwork.height}
            unoptimized
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
          />
        </picture>
        <ol className={styles.dialogue} aria-label="Scene dialogue" data-comic-dialogue>
          {scene.dialogue.map((dialogue) => (
            <SpeechBubble key={dialogue.id} dialogue={dialogue} />
          ))}
        </ol>
        {scene.diagram === 'shutdown-request' && <ShutdownRequestDiagram id={scene.id} />}
      </div>
    </figure>
  );
}
