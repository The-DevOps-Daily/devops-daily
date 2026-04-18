import Link from 'next/link';
import { type FooterSection as FooterSectionType } from './footer-data';

interface FooterSectionProps {
  section: FooterSectionType;
  /** Override the mono label; defaults to slugified section.title */
  label?: string;
}

export function FooterSection({ section, label }: FooterSectionProps) {
  const resolvedLabel =
    label ??
    section.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  return (
    <div className="space-y-3">
      <p className="text-xs font-mono text-muted-foreground">// {resolvedLabel}</p>
      <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
      <ul className="space-y-1.5">
        {section.links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
