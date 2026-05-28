import type { Metadata } from 'next';
import SmtpFlowSimulator from '@/components/games/smtp-flow-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('smtp-flow-simulator');
}

function SmtpEducationalContent() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About this SMTP simulator</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>How SMTP submission differs from server-to-server relay</li>
            <li>Why EHLO, STARTTLS, AUTH, MAIL FROM, RCPT TO, and DATA happen in order</li>
            <li>How SPF, DKIM, and DMARC affect sender trust and deliverability</li>
            <li>Why 4xx SMTP responses retry while 5xx responses usually fail permanently</li>
            <li>Where provider queues, logs, webhooks, and bounce handling fit into delivery</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Key concepts covered</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Submission:</strong> authenticated app-to-relay
              sending, usually on port 587
            </li>
            <li>
              <strong className="text-foreground">Relay:</strong> queued delivery from sender relay
              to recipient MX
            </li>
            <li>
              <strong className="text-foreground">Authentication:</strong> TLS, SMTP AUTH, SPF,
              DKIM, and DMARC
            </li>
            <li>
              <strong className="text-foreground">Delivery:</strong> remote acceptance, retry,
              bounce, and mailbox placement
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Sponsored by SMTPfast</h4>
        <p className="text-sm text-muted-foreground">
          SMTPfast is a developer-first email platform for transactional and marketing email. It
          provides SMTP/API sending, detailed logs, webhooks, and embeddable signup forms for teams
          that want to ship email without running their own mail infrastructure.
        </p>
      </div>
    </>
  );
}

export default function SmtpFlowSimulatorPage() {
  return (
    <SimulatorShell
      slug="smtp-flow-simulator"
      fallbackTitle="SMTP Flow Simulator"
      fallbackDescription="Visualize how SMTP email delivery works from app submission through TLS, authentication, sender DNS checks, recipient MX relay, retries, bounces, and inbox placement."
      educational={<SmtpEducationalContent />}
      shareText="Visualize how SMTP email delivery works, from EHLO and STARTTLS to SPF, DKIM, DMARC, retries, and inbox placement."
    >
      <SmtpFlowSimulator />
    </SimulatorShell>
  );
}
