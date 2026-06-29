import { TimestampConverter } from '@/components/tools/timestamp-converter';
import { ToolShell } from '@/components/tools/tool-shell';
import { buildToolMetadata } from '@/lib/tools';

export const metadata = buildToolMetadata('timestamp-converter');

function Explainer() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">When you&apos;ll reach for this</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 font-semibold text-sm">Reading logs and database rows</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Logs, JWT <code className="font-mono">exp</code> claims, Kafka offsets, and{' '}
            <code className="font-mono">created_at</code> columns often store raw epoch numbers.
            Paste one in to see the actual date in UTC and your local time, plus whether it was
            recorded in seconds or milliseconds.
          </p>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">Seconds vs milliseconds</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Unix tools use seconds (<code className="font-mono">date +%s</code>); JavaScript and
            many APIs use milliseconds. Mixing them is a classic off-by-1000 bug. This tool detects
            which one you pasted by its magnitude and shows both, so a cron schedule or a TTL never
            lands a thousand times too early or too late.
          </p>
        </div>
      </div>
    </>
  );
}

export default function TimestampConverterPage() {
  return (
    <ToolShell slug="timestamp-converter" explainer={<Explainer />}>
      <TimestampConverter />
    </ToolShell>
  );
}
