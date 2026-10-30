import type { Metadata } from 'next';
import Link from 'next/link';
import OnCall from '@/components/games/on-call';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('on-call');
}

const seoLearningPoints = [
  'Practise diagnosing production incidents with a limited budget of moves',
  'Gather evidence before you guess: logs, metrics, kubectl, dig, curl and openssl output',
  'Tell a symptom apart from its root cause',
  'Recognise connection pool exhaustion, lock queues, replication lag and full disks',
  'Spot DNS, TLS, networking, queue, cache and deploy failures from their signals',
  'A new incident every day, with a streak and a spoiler-free result to share',
];

function OnCallEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About On-Call: The Daily Incident</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll practise</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Reading an alert and deciding which signal to check first</li>
            <li>Reading real-looking output from kubectl, psql, dig, curl, openssl and logs</li>
            <li>Telling a symptom, such as high CPU, apart from what caused it</li>
            <li>Ruling causes out with evidence instead of guessing</li>
            <li>Learning how each failure is fixed and how to stop it coming back</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">How it works</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">One incident a day:</strong> everyone gets the
              same incident, and a new one arrives at 00:00 UTC.
            </li>
            <li>
              <strong className="text-foreground">Six moves:</strong> opening a signal costs a move,
              and so does naming a cause. Your last move is kept for a diagnosis.
            </li>
            <li>
              <strong className="text-foreground">Feedback:</strong> green is the root cause, yellow
              is the right area but not the root cause, and grey is the wrong area.
            </li>
            <li>
              <strong className="text-foreground">Your streak:</strong> it stays in your browser.
              Copy the backup code to keep it if you clear your browser or switch devices.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Evidence first, then a diagnosis</h4>
        <p className="text-sm text-muted-foreground">
          Most wrong turns during an incident come from naming a cause too early. A busy database, a
          recent deploy or a noisy log line all look guilty. The fastest responders pick the one
          signal that would prove or rule out their first idea, read it, and only then act. The move
          budget in this game rewards exactly that.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Read more</h4>
        <p className="text-sm text-muted-foreground">
          To run a whole incident as the person in charge, try the{' '}
          <Link
            href="/games/incident-commander-simulator"
            className="text-primary underline-offset-4 hover:underline"
          >
            Incident Commander Simulator
          </Link>
          . For the process around the pager, read{' '}
          <Link
            href="/posts/on-call-rotation-escalation-policy-guide"
            className="text-primary underline-offset-4 hover:underline"
          >
            how to build an on-call rotation and escalation policy
          </Link>{' '}
          and{' '}
          <Link
            href="/posts/the-postmortem-nobody-reads"
            className="text-primary underline-offset-4 hover:underline"
          >
            how to write a postmortem people read
          </Link>
          . If a connection pool incident catches you out, read{' '}
          <Link
            href="/posts/serverless-killed-your-connection-pool"
            className="text-primary underline-offset-4 hover:underline"
          >
            what a connection pool really saves you
          </Link>
          .
        </p>
      </div>
    </>
  );
}

export default function OnCallPage() {
  return (
    <SimulatorShell
      slug="on-call"
      fallbackTitle="On-Call: The Daily Incident"
      fallbackDescription="A new production incident every day. Six moves to find the root cause."
      educational={<OnCallEducational />}
      seoLearningPoints={seoLearningPoints}
      shareText="I just played today's On-Call incident on DevOps Daily. Can you find the root cause in fewer moves?"
    >
      <OnCall />
    </SimulatorShell>
  );
}
