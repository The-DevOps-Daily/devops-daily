import Link from 'next/link';
import { Award, ChevronRight, Gift } from 'lucide-react';
import { ADVENTS, GIVEAWAY_PATH, certificatePath, type AdventKey } from '@/lib/advent-certificate';

/** The short giveaway line under an Advent hero. */
export function GiveawayBanner({ adventKey }: { adventKey: AdventKey }) {
  const advent = ADVENTS[adventKey];
  return (
    <div className="container mx-auto px-4">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-md border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <Gift
            className="mt-0.5 h-5 w-5 shrink-0 text-primary"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <p className="text-sm">
            <strong>Finish it, get a certificate, win a prize.</strong>{' '}
            <span className="text-muted-foreground">
              Every finisher who enters gets our ebook, and we draw 6 winners for a year of DevOps
              Daily Pro or SMTPfast. Entries close on 31 December.
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={GIVEAWAY_PATH}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            The giveaway
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={certificatePath(advent)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3.5 py-2 text-sm font-medium hover:border-primary/50"
          >
            <Award className="h-4 w-4" aria-hidden="true" />
            Certificate
          </Link>
        </div>
      </div>
    </div>
  );
}
