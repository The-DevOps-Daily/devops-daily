import type { Metadata } from 'next';
import BounceTriageSimulator from '@/components/games/bounce-triage-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('bounce-triage-simulator');
}

const seoLearningPoints = [
  'How to read an SMTP bounce: the reply code, the enhanced status code, and the diagnostic text',
  'The difference between a hard bounce, a soft bounce, a block, and a spam complaint',
  'Why the 4xx and 5xx class digit is a hint rather than the answer',
  'Which bounces to suppress permanently and which to retry with backoff',
  'Why suppressing a soft bounce quietly costs you real subscribers',
  'Why retrying a hard bounce damages your sending reputation every time',
  'What a 5.7.26 DMARC rejection and a 421 rate limit are really telling you',
];

function BounceTriageEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About this bounce triage simulator</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>How to read a real SMTP bounce without looking anything up</li>
            <li>Which failures are permanent and which will deliver on the next try</li>
            <li>Why some 5xx responses have nothing to do with the recipient</li>
            <li>What each mistake costs: lost subscribers, or lost reputation</li>
            <li>Where complaints fit, and why they are weighted so much more heavily</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">How to read a bounce</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">The reply code:</strong> 4xx is temporary, 5xx is
              permanent. Treat it as a hint, not a verdict
            </li>
            <li>
              <strong className="text-foreground">The enhanced status:</strong> 5.1.1 no such mailbox,
              4.2.2 over quota, 5.7.x policy or authentication
            </li>
            <li>
              <strong className="text-foreground">The diagnostic text:</strong> free-form, and usually
              the part that actually tells you what happened
            </li>
            <li>
              <strong className="text-foreground">The address itself:</strong> a surprising share of
              hard bounces are simple typos made at signup
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">The mistake that costs the most</h4>
        <p className="text-sm text-muted-foreground">
          Both triage errors are expensive, in opposite directions. Suppress a soft bounce and you
          permanently drop a real subscriber because their mailbox was briefly full. Retry a hard bounce
          and you damage your sending reputation every single time, because mailbox providers read
          repeated delivery to a known-dead address as a sign you are working from a purchased list.
          The 5xx responses that are really about content or rate are where most people go wrong: the 5
          looks permanent, so they get filed with the dead addresses and a fixable template problem
          turns into a shrinking list.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Doing this automatically in production</h4>
        <p className="text-sm text-muted-foreground">
          Nobody triages bounces by hand at volume. In production your provider posts a webhook for each
          bounce and complaint, and your handler classifies it and writes to a suppression list that the
          next send checks before it queues anything. The part worth caring about when you choose a
          provider is whether you get the receiving server&apos;s actual response, like the ones in this
          simulator, or just a category label. &quot;Bounced&quot; is not enough to act on:{' '}
          <span className="font-mono text-xs">550 5.1.1 user unknown</span> and{' '}
          <span className="font-mono text-xs">550 5.7.1 content rejected</span> are the same category
          and need opposite responses.{' '}
          <a
            href="https://smtpfa.st"
            className="font-medium text-primary underline underline-offset-2"
            rel="noopener"
          >
            SMTPfast
          </a>{' '}
          keeps the full diagnostic next to the message that caused it, and suppression is enforced on
          send rather than being advisory.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Go deeper</h4>
        <p className="text-sm text-muted-foreground">
          <a
            href="/posts/send-an-email-by-hand-raw-smtp"
            className="font-medium text-primary underline underline-offset-2"
          >
            Send an email by hand with raw SMTP
          </a>{' '}
          walks the conversation these codes come from, one command at a time. The{' '}
          <a
            href="/games/smtp-flow-simulator"
            className="font-medium text-primary underline underline-offset-2"
          >
            SMTP flow simulator
          </a>{' '}
          covers the same handshake interactively, and{' '}
          <a
            href="/posts/what-sending-a-developer-newsletter-actually-takes"
            className="font-medium text-primary underline underline-offset-2"
          >
            what sending a developer newsletter actually takes
          </a>{' '}
          covers the suppression list these bounces feed into.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Why learn it this way?</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>Bounce codes are only memorable once you have been wrong about one.</li>
          <li>Every response here is one a real mail server actually sends, wording included.</li>
          <li>
            Reading them quickly is the difference between a list that stays healthy and a sending
            domain that quietly stops reaching inboxes.
          </li>
        </ul>
      </div>
    </>
  );
}

export default function BounceTriageSimulatorPage() {
  return (
    <SimulatorShell
      slug="bounce-triage-simulator"
      fallbackTitle="Bounce Triage Simulator"
      fallbackDescription="Read a real SMTP bounce and decide what it is and what to do about it. Twelve genuine failures from Gmail, Outlook, Postfix and Proofpoint, with an explanation of what each code means and what getting it wrong costs you."
      educational={<BounceTriageEducational />}
      seoLearningPoints={seoLearningPoints}
      shareText="Can you triage an SMTP bounce? Twelve real ones: hard, soft, blocked or complaint, and what to do with each."
    >
      <BounceTriageSimulator />
    </SimulatorShell>
  );
}
