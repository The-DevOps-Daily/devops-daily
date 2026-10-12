'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ComicDialogue } from './types';
import styles from './comic-scene.module.css';

export function SpeechBubble({ dialogue }: { dialogue: ComicDialogue }) {
  const bubbleRef = useRef<HTMLLIElement>(null);
  const [outline, setOutline] = useState<{ width: number; height: number; path: string } | null>(
    null
  );

  useEffect(() => {
    const bubble = bubbleRef.current;
    const image = bubble?.closest('[data-comic-canvas]')?.querySelector('[data-comic-art]');
    if (!bubble || !image || !dialogue.tailTo) return;
    const target = dialogue.tailTo;
    const observer = new ResizeObserver(() => {
      if (getComputedStyle(bubble).position !== 'absolute') {
        setOutline(null);
        return;
      }
      const box = bubble.getBoundingClientRect();
      const art = image.getBoundingClientRect();
      const w = box.width;
      const h = box.height;
      const tipX = art.x + target.x * art.width - box.x;
      const tipY = art.y + target.y * art.height - box.y;
      if (tipY <= h + 8) {
        setOutline(null);
        return;
      }
      const r = 24;
      const root = Math.max(r + 16, Math.min(w - r - 16, tipX - 10));
      const half = 12;
      const length = tipY - h;
      // One closed contour joins the rounded box and curved tapered tail;
      // there is no overlapping border, cutout, detached triangle or arrowhead.
      const path = `M ${r} 1 H ${w - r} Q ${w - 1} 1 ${w - 1} ${r}
        V ${h - r} Q ${w - 1} ${h - 1} ${w - r} ${h - 1}
        H ${root + half}
        C ${root + half} ${h + length * 0.4} ${tipX + 8} ${tipY - 14} ${tipX} ${tipY}
        C ${tipX - 5} ${tipY - 14} ${root - half} ${h + length * 0.2} ${root - half} ${h - 1}
        H ${r} Q 1 ${h - 1} 1 ${h - r} V ${r} Q 1 1 ${r} 1 Z`;
      setOutline({ width: w, height: h, path });
    });
    observer.observe(bubble);
    observer.observe(image);
    return () => observer.disconnect();
  }, [dialogue.tailTo]);

  const position = {
    '--bubble-x': `${dialogue.position.x * 100}%`,
    '--bubble-y': `${dialogue.position.y * 100}%`,
    '--bubble-width': `${dialogue.position.width * 100}%`,
  } as CSSProperties;

  return (
    <li
      ref={bubbleRef}
      className={styles.bubble}
      style={position}
      data-outline={outline ? 'true' : undefined}
    >
      {outline && (
        <svg
          className={styles.outline}
          viewBox={`0 0 ${outline.width} ${outline.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
          data-comic-outline
        >
          <path d={outline.path} fill="#fffdf5" stroke="#273746" strokeWidth="2" />
        </svg>
      )}
      <span className={styles.speaker}>{dialogue.speaker}</span>
      <p>{dialogue.text}</p>
    </li>
  );
}
