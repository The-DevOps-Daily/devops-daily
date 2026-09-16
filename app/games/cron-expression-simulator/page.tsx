import type { Metadata } from 'next';
import CronExpressionSimulator from '@/components/games/cron-expression-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('cron-expression-simulator');
}

const seoLearningPoints = [
  'What the five fields are, and why a sixth one means you are not writing plain cron',
  'Why `*/7` is not every 7 minutes, and where the short gap appears',
  'Why day-of-month and day-of-week are OR and not AND, and the daily job that creates',
  'What `0 0 * * *` does that `* * * * *` does not',
  'How `@daily`, `@weekly` and the other macros expand, and where they are not supported',
  'What happens to a 01:30 job on the night the clock goes forward, and on the night it goes back',
  'Why the same expression fires at different moments in different timezones',
  'Which expressions are valid, accepted, and then never fire at all',
  'Why `L`, `W` and `#` work in some schedulers and not in cron',
  'How to read a schedule as dates rather than as five fields',
];

function CronEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About this cron expression simulator</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>That the useful answer is a list of dates, not a description of five fields</li>
            <li>That cron matches a clock rather than counting an interval forward, which is why steps can be uneven</li>
            <li>That the two day fields combine with OR, the mistake that turns a monthly job into a weekly one</li>
            <li>That daylight saving deletes an hour once a year and repeats one once a year, and your job is in it</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">How it works</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>The parser and the schedule are real and run in your browser. Nothing here is a canned answer.</li>
            <li>Change the timezone and the same expression moves, because the expression was never absolute.</li>
            <li>Set the start date, or jump straight to the next clock change, to watch a transition happen.</li>
            <li>Type your own expression. It is treated exactly like the examples.</li>
          </ul>
        </div>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        The behaviour here follows{' '}
        <a
          href="https://man7.org/linux/man-pages/man5/crontab.5.html"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          crontab(5)
        </a>
        , which is the Vixie cron most Linux systems ship. One detail is worth knowing before you rely on it:
        daylight saving is the part where implementations genuinely differ. This simulator shows the plain
        wall-clock reading, where a time that does not exist does not fire and a time that happens twice fires
        twice. Vixie cron special-cases some of that, and{' '}
        <a
          href="https://www.freedesktop.org/software/systemd/man/systemd.timer.html"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          systemd timers
        </a>{' '}
        do not behave like cron at all. If a job must not be skipped or doubled, schedule it in UTC or keep it
        away from the small hours.
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        Related: the{' '}
        <a href="/games/yaml-parsing-simulator" className="underline">
          YAML parsing simulator
        </a>{' '}
        for the other thing that reads your config differently from how you wrote it, and the{' '}
        <a href="/games/linux-terminal" className="underline">
          Linux terminal simulator
        </a>{' '}
        for where crontabs live.
      </p>
    </>
  );
}

export default function Page() {
  return (
    <SimulatorShell
      slug="cron-expression-simulator"
      educational={<CronEducational />}
      seoLearningPoints={seoLearningPoints}
    >
      <CronExpressionSimulator />
    </SimulatorShell>
  );
}
