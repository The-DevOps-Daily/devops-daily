import type { ComicChapterContent } from './types';
import styles from './chapter-reader.module.css';

export function TechnicalNotes({
  notes,
  print = false,
}: {
  notes: ComicChapterContent['technicalNotes'];
  print?: boolean;
}) {
  const body = (
    <div className={styles.notesBody}>
      <p>
        <strong>{notes.lead}</strong>
      </p>
      {notes.paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <ul>
        {notes.caveats.map((caveat) => (
          <li key={caveat}>{caveat}</li>
        ))}
      </ul>
      <p>{notes.footer}</p>
      <h3>Read further</h3>
      <ul>
        {notes.links.map((link) => (
          <li key={link.href}>
            <a
              href={
                print && link.href.startsWith('/')
                  ? `https://devops-daily.com${link.href}`
                  : link.href
              }
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
  if (print)
    return (
      <section className={styles.notes}>
        <h2 className="p-5">Under the Hood</h2>
        {body}
      </section>
    );
  return (
    <details className={styles.notes}>
      <summary>
        <h2>Under the Hood</h2>
      </summary>
      {body}
    </details>
  );
}
