import { CronParser } from '@/components/tools/cron-parser';
import { ToolShell } from '@/components/tools/tool-shell';
import { buildToolMetadata } from '@/lib/tools';

export const metadata = buildToolMetadata('cron-parser');

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
│ │ │ │ └─ day of week (0-7, Sun=0 and 7)
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
            <li>
              Names work too: <code className="font-mono">JAN-DEC</code> and{' '}
              <code className="font-mono">SUN-SAT</code>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">The one that catches everyone</h4>
        <p className="text-sm text-muted-foreground">
          When <strong>both</strong> the day-of-month and day-of-week fields are set, cron combines
          them with <strong>or</strong>, not <strong>and</strong>.{' '}
          <code className="font-mono">0 9 1 * MON</code> runs on the 1st of the month{' '}
          <em>and</em> on every Monday, not only on Mondays that fall on the 1st. A monthly job
          written that way quietly runs weekly. If only one of the two is set, it behaves as you
          would expect.
        </p>
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
