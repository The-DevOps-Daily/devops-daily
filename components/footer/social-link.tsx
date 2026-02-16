import Link from 'next/link';
import { type SocialLink as SocialLinkType } from './footer-data';
import { cn } from '@/lib/utils';

interface SocialLinkProps {
  link: SocialLinkType;
}

export function SocialLink({ link }: SocialLinkProps) {
  const Icon = link.icon;

  return (
    <Link
      href={link.href}
      className={cn(
        'group p-3 bg-linear-to-br border rounded-2xl transition-all duration-300 hover:shadow-lg hover:scale-110',
        link.colorFrom,
        link.colorTo,
        `hover:${link.colorFrom.replace('/10', '/20')}`,
        `hover:${link.colorTo.replace('/10', '/20')}`,
        link.borderColor
      )}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Icon className={cn('h-5 w-5', link.iconColor, link.iconHoverColor)} />
      <span className="sr-only">{link.name}</span>
    </Link>
  );
}
