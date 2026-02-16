import Link from 'next/link';
import { type SocialLink as SocialLinkType } from './footer-data';

interface SocialLinkProps {
  link: SocialLinkType;
}

export function SocialLink({ link }: SocialLinkProps) {
  const Icon = link.icon;

  return (
    <Link
      href={link.href}
      className={`group p-3 bg-linear-to-br ${link.colorFrom} ${link.colorTo} ${link.colorFromHover} ${link.colorToHover} border ${link.borderColor} rounded-2xl transition-all duration-300 hover:shadow-lg hover:scale-110`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Icon className={`h-5 w-5 ${link.iconColor} ${link.iconHoverColor}`} />
      <span className="sr-only">{link.name}</span>
    </Link>
  );
}
