import Image from 'next/image';
import type { Sponsor } from '@/lib/sponsors';
import { cn } from '@/lib/utils';

interface SponsorLogoProps {
  sponsor: Sponsor;
  width: number;
  height: number;
  className?: string;
}

export function SponsorLogo({
  sponsor,
  width,
  height,
  className,
}: SponsorLogoProps) {
  const imageClassName = cn(className, sponsor.className);

  return (
    <>
      <Image
        src={sponsor.logo || '/placeholder.svg'}
        alt={sponsor.name}
        width={width}
        height={height}
        className={cn(imageClassName, sponsor.darkLogo && 'dark:hidden')}
      />
      {sponsor.darkLogo && (
        <Image
          src={sponsor.darkLogo}
          alt={sponsor.name}
          width={width}
          height={height}
          className={cn(imageClassName, 'hidden dark:block')}
        />
      )}
    </>
  );
}
