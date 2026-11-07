import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SectionHeader } from '@/components/section-header';
import { careerNotes, careerSource, roadmapStages } from '@/lib/roadmap-data';
import type { ResolvedResource } from '@/lib/roadmap-resources';
import { ResourceLink } from './resource-list';

const usd = (n: number) => `$${n.toLocaleString('en-US')}`;
const date = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
const stageName = (id: string) => roadmapStages.find((s) => s.id === id)?.shortTitle ?? id;

export function CareerNotes({ reading }: { reading: ResolvedResource[] }) {
  return (
    <section aria-label="Career notes" className="scroll-mt-24" id="career-notes">
      <SectionHeader
        label="career notes"
        title="Career notes"
        description="US pay and job growth for the jobs this roadmap leads to. The BLS has no DevOps job title, so each row is the closest occupation it tracks. Pay in other countries can be very different."
      />
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">
            Pay range from the 10th to the 90th percentile, median pay and projected job growth
          </caption>
          <thead className="bg-muted/40 font-mono text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-normal">
                Occupation (BLS)
              </th>
              <th scope="col" className="px-4 py-2.5 font-normal">
                Roles on this roadmap
              </th>
              <th scope="col" className="px-4 py-2.5 font-normal">
                Pay, 10th to 90th percentile
              </th>
              <th scope="col" className="px-4 py-2.5 font-normal">
                Median
              </th>
              <th scope="col" className="px-4 py-2.5 font-normal">
                Jobs, {careerSource.projection.replace(' to ', '-')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {careerNotes.map((row) => (
              <tr key={row.occupation} className="align-top">
                <th scope="row" className="px-4 py-3 font-medium">
                  <a
                    href={row.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-border underline-offset-4 hover:text-primary hover:decoration-primary"
                  >
                    {row.occupation}
                    <span className="sr-only"> (BLS page, opens in a new tab)</span>
                  </a>
                </th>
                <td className="px-4 py-3">
                  {row.roles}
                  <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                    {row.stages.map(stageName).join(', ')}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                  {usd(row.low)} to {usd(row.high)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">{usd(row.median)}</td>
                <td className="px-4 py-3 tabular-nums">
                  {row.growth > 0 ? '+' : ''}
                  {row.growth}%
                  {row.growthNote && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {row.growthNote}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Source:{' '}
        <a
          href="https://www.bls.gov/ooh/computer-and-information-technology/home.htm"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4 hover:text-foreground"
        >
          {careerSource.name}
        </a>
        . Pay for {careerSource.payPeriod}, job projections for {careerSource.projection}, pages
        updated {date(careerSource.updated)}. We checked the numbers on {date(careerSource.checked)}
        .
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_2fr]">
        <div>
          <h3 className="font-mono text-xs text-muted-foreground">{'// getting the job'}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Practice the questions interviewers ask, and read how the role is changing.
          </p>
          <Link
            href="/interview-questions"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium hover:text-primary"
          >
            Browse interview questions
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {reading.map((resource) => (
            <li key={resource.href}>
              <ResourceLink resource={resource} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
