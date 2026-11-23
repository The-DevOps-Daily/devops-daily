'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { ChevronRight, Gift, Info } from 'lucide-react';
import { Linkedin } from '@/components/icons/social-icons';
import { CertificateCanvas } from '@/components/advent-certificate/certificate-canvas';
import {
  ADVENTS,
  GIVEAWAY_PATH,
  LINKEDIN_PAGE_URL,
  adventTitle,
  certificatePath,
  formatCertificateDate,
  parseCertificateParams,
  type AdventKey,
} from '@/lib/advent-certificate';

const button =
  'inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium transition-colors';

/** The public certificate page. Everything on it comes from the URL. */
export function CertificateView({ adventKey }: { adventKey: AdventKey }) {
  const advent = ADVENTS[adventKey];
  const params = useSearchParams();
  const data = useMemo(() => parseCertificateParams(advent, params), [advent, params]);
  const title = adventTitle(advent);

  useEffect(() => {
    if (data) document.title = `${data.name}: ${title} certificate | DevOps Daily`;
  }, [data, title]);

  return (
    <div className="container mx-auto px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-4xl">
        <p className="mb-2 font-mono text-xs text-muted-foreground">{`// ${advent.path.slice(1)}/certificate`}</p>
        {data ? (
          <>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {data.name} finished {title}
            </h1>
            <p className="mt-3 text-muted-foreground">
              {data.days} of {advent.totalDays} days, issued {formatCertificateDate(data.date)}.
              Certificate ID <span className="font-mono text-foreground">{data.id}</span>.
            </p>
            <div className="mt-8 overflow-hidden rounded-md border border-border shadow-sm">
              <CertificateCanvas advent={advent} data={data} />
            </div>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title} certificate</h1>
            <p className="mt-3 text-muted-foreground">
              This certificate link is incomplete or was changed, so there is nothing to show. Ask
              the person to copy the link again from their certificate page.
            </p>
          </>
        )}

        <div className="mt-6 flex gap-3 rounded-md border border-border bg-muted/30 p-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-muted-foreground">
            <strong className="text-foreground">Self-reported.</strong> {advent.name} saves progress
            in the reader&apos;s own browser, and DevOps Daily does not check it. This page shows
            the name, days and date from its link.
          </p>
        </div>

        <div className="mt-10 rounded-md border bg-primary/5 px-6 py-8 text-center sm:px-8">
          <h2 className="text-2xl font-bold">Try {advent.name} yourself</h2>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
            {advent.pitch.charAt(0).toUpperCase() + advent.pitch.slice(1)}. Free, one a day, and
            every finisher can enter the giveaway.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href={advent.path}
              className={`${button} bg-primary text-primary-foreground hover:bg-primary/90`}
            >
              Start {advent.name}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href={LINKEDIN_PAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${button} bg-[#0A66C2] text-white hover:bg-[#0A66C2]/90`}
            >
              <Linkedin className="h-4 w-4" aria-hidden="true" />
              Follow DevOps Daily
            </a>
            <Link
              href={GIVEAWAY_PATH}
              className={`${button} border border-border hover:border-primary/50 hover:bg-muted/40`}
            >
              <Gift className="h-4 w-4" aria-hidden="true" />
              The giveaway
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Finished it?{' '}
            <Link href={certificatePath(advent)} className="text-primary hover:underline">
              Get your own certificate
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
