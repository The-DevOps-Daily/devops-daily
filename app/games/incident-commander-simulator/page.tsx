import type { Metadata } from 'next';
import Link from 'next/link';
import IncidentCommanderSimulator from '@/components/games/incident-commander-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('incident-commander-simulator');
}

const seoLearningPoints = [
  'Run an incident as the incident commander: coordinate, do not fix everything yourself',
  'Mitigate first with the smallest reversible change, then find the root cause',
  'Send investigations to responders and read the evidence they bring back',
  'Post status updates early and on a schedule, and keep them accurate',
  'Confirm the recovery holds before you resolve an incident',
  'Recognise database connection exhaustion and a bad feature flag rollout',
];

function IncidentCommanderEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About this incident commander simulator</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll practise</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Directing two responders instead of doing every task yourself</li>
            <li>Turning a vague alert into specific questions, and judging the answers</li>
            <li>Choosing a mitigation by scope, risk and how easily you can undo it</li>
            <li>Changing one thing at a time, so each step tells you something</li>
            <li>Writing status updates that are early, regular and true</li>
            <li>
              Telling &quot;the graph turned green once&quot; apart from a recovery that holds
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">How it works</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Turn-based:</strong> time only moves when you
              advance the clock, so reading the evidence costs nothing.
            </li>
            <li>
              <strong className="text-foreground">Your team:</strong> each responder works on one
              task at a time. Investigations and changes take simulated minutes.
            </li>
            <li>
              <strong className="text-foreground">The review:</strong> at the end you see the
              customer impact, how you communicated, any risky changes, and one decision worth
              revisiting.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Mitigate first, diagnose second</h4>
        <p className="text-sm text-muted-foreground">
          During an incident the first job is to stop the damage. A feature flag turned off, a
          rollback, or a smaller connection pool can restore service long before anyone understands
          the root cause. Pick the change that matches the evidence and is fastest and safest to
          undo, then investigate calmly once customers are fine.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Read more</h4>
        <p className="text-sm text-muted-foreground">
          The scenarios come from our{' '}
          <Link
            href="/posts/serverless-killed-your-connection-pool"
            className="text-primary underline-offset-4 hover:underline"
          >
            post on connection pools
          </Link>{' '}
          and our guide to{' '}
          <Link
            href="/posts/how-to-implement-progressive-delivery-with-feature-flags"
            className="text-primary underline-offset-4 hover:underline"
          >
            progressive delivery with feature flags
          </Link>
          . For the on-call side, read{' '}
          <Link
            href="/posts/on-call-rotation-escalation-policy-guide"
            className="text-primary underline-offset-4 hover:underline"
          >
            how to build an on-call rotation and escalation policy
          </Link>
          , and for a game about keeping services up under load, try{' '}
          <Link
            href="/games/uptime-defender"
            className="text-primary underline-offset-4 hover:underline"
          >
            Uptime Defender
          </Link>
          .
        </p>
      </div>
    </>
  );
}

export default function IncidentCommanderSimulatorPage() {
  return (
    <SimulatorShell
      slug="incident-commander-simulator"
      fallbackTitle="Incident Commander Simulator"
      fallbackDescription="Take the page as incident commander: direct two responders, read the evidence, choose a mitigation, keep customers updated, and confirm the recovery holds before you resolve."
      educational={<IncidentCommanderEducational />}
      seoLearningPoints={seoLearningPoints}
      shareText="Can you run a production incident? Take the page in the Incident Commander Simulator."
    >
      <IncidentCommanderSimulator />
    </SimulatorShell>
  );
}
