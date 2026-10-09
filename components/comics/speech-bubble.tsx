import type { CSSProperties } from 'react';
import type { ComicDialogue } from './types';
import styles from './comic-scene.module.css';

export function SpeechBubble({ dialogue }: { dialogue: ComicDialogue }) {
  const position = {
    '--bubble-x': `${dialogue.position.x * 100}%`,
    '--bubble-y': `${dialogue.position.y * 100}%`,
    '--bubble-width': `${dialogue.position.width * 100}%`,
  } as CSSProperties;

  return (
    <li className={styles.bubble} style={position} data-tail={dialogue.tailDirection}>
      <span className={styles.speaker}>{dialogue.speaker}</span>
      <p>{dialogue.text}</p>
    </li>
  );
}
