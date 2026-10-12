import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function ComicDiscoveryCard() {
  return (
    <Link
      href="/comics/git-blame"
      className="group flex items-center gap-5 rounded-lg border bg-card p-5 hover:border-primary/40 [overflow-wrap:anywhere]"
    >
      <Image
        src="/comics/git-blame/chapter-01/scene-01-480.webp"
        alt=""
        width={480}
        height={600}
        unoptimized
        className="w-20 sm:w-24 shrink-0 rounded-md"
      />
      <div className="min-w-0">
        <h3 className="text-xl font-bold group-hover:text-primary">git blame</h3>
        <p className="mt-2 text-muted-foreground text-sm">
          Production is down. Everyone has a theory.
        </p>
        <p className="mt-3 inline-flex gap-2 items-center text-sm font-medium text-primary">
          Meet the ShipIt team <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
        </p>
      </div>
    </Link>
  );
}
