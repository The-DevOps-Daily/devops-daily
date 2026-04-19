import type { Metadata } from 'next';
import { CronParser } from '@/components/tools/cron-parser';
import { ToolShell } from '@/components/tools/tool-shell';

export const metadata: Metadata = {
  title: 'Cron Expression Parser | DevOps Daily',
  description:
    'Translate cron expressions to human-readable schedules and see the next 5 run times. Supports @yearly, @monthly, @daily, @hourly shortcuts.',
  alternates: { canonical: '/tools/cron-parser' },
  openGraph: {
    title: 'Cron Expression Parser',
    description: 'Decode cron expressions in your browser, preview the next 5 run times.',
    url: '/tools/cron-parser',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cron Expression Parser',
    description: 'Decode cron expressions in your browser.',
  },
};

function Explainer() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">Cron syntax cheat sheet</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 font-semibold text-sm">Five fields, in order</h4>
          <pre className="font-mono text-xs bg-muted/40 rounded-md p-3 leading-relaxed">
            {`* * * * *
┬ ┬ ┬ ┬ ┬
│ │ │ │ └─ day of week (0-6, Sun=0)
│ │ │ └─── month (1-12)
│ │ └───── day of month (1-31)
│ └─────── hour (0-23)
└───────── minute (0-59)`}
          </pre>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">Operators</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <code className="font-mono">*</code> any value
            </li>
            <li>
              <code className="font-mono">,</code> list of values, e.g. <code className="font-mono">1,15,30</code>
            </li>
            <li>
              <code className="font-mono">-</code> range, e.g. <code className="font-mono">1-5</code>
            </li>
            <li>
              <code className="font-mono">/</code> step, e.g. <code className="font-mono">*/15</code> every 15
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Shortcuts</h4>
        <ul className="space-y-1 text-sm text-muted-foreground font-mono">
          <li>
            <strong className="text-foreground">@yearly</strong> / <strong className="text-foreground">@annually</strong>: 0 0 1 1 *
          </li>
          <li>
            <strong className="text-foreground">@monthly</strong>: 0 0 1 * *
          </li>
          <li>
            <strong className="text-foreground">@weekly</strong>: 0 0 * * 0
          </li>
          <li>
            <strong className="text-foreground">@daily</strong> / <strong className="text-foreground">@midnight</strong>: 0 0 * * *
          </li>
          <li>
            <strong className="text-foreground">@hourly</strong>: 0 * * * *
          </li>
        </ul>
      </div>
    </>
  );
}

export default function CronParserPage() {
  return (
    <ToolShell slug="cron-parser" explainer={<Explainer />}>
      <CronParser />
    </ToolShell>
  );
}
