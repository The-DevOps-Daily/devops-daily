import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { type FooterSection as FooterSectionType } from './footer-data';

interface FooterSectionProps {
  section: FooterSectionType;
}

export function FooterSection({ section }: FooterSectionProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        {section.title}
      </h3>
      <ul className="space-y-3">
        {section.links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="group flex items-center justify-between text-muted-foreground hover:text-primary transition-all duration-300 py-2 px-3 rounded-xl hover:bg-primary/5"
            >
              <span className="font-medium">{link.label}</span>
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
