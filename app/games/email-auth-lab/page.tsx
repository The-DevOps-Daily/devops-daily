import type { Metadata } from 'next';
import Link from 'next/link';
import EmailAuthLab from '@/components/games/email-auth-lab';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('email-auth-lab');
}

const seoLearningPoints = [
  'SPF checks the MAIL FROM identity against the IP that connects to the receiver',
  'DKIM verifies a signed body and headers using a selector key in DNS',
  'DMARC needs SPF or DKIM to both pass and align with the visible From domain',
  'Forwarding commonly breaks SPF while an unchanged aligned DKIM signature can survive',
  'Mailing lists can break DKIM and use From rewriting to preserve DMARC',
  'DMARC policy, alignment modes and pct change how a receiver handles failure',
];

function EmailAuthEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About the Email Authentication Lab</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll practise</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Publishing SPF for an ESP and recognizing its DNS lookup limit</li>
            <li>Signing with an aligned DKIM domain and placing the selector key in DNS</li>
            <li>Reading relaxed and strict SPF and DKIM alignment in a DMARC verdict</li>
            <li>Following how forwarding, list changes and From rewriting affect delivery</li>
            <li>Comparing monitoring, quarantine and reject DMARC policies</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">How it works</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Edit DNS and ESP settings:</strong> choose an SPF
              record, a DKIM signing domain, a selector key and DMARC policy.
            </li>
            <li>
              <strong className="text-foreground">Send three paths:</strong> compare direct
              delivery, an unchanged forward without SRS, and a mailing list that changes the
              message.
            </li>
            <li>
              <strong className="text-foreground">Read the receiver verdict:</strong> each path
              shows the identity checked, alignment, applied policy and inbox, spam-folder or
              rejection outcome.
            </li>
          </ul>
        </div>
      </div>
      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Model boundary</h4>
        <p className="text-sm text-muted-foreground">
          The lab follows RFC 7489&apos;s pct behavior so you can see its effect, even though the
          newer DMARCbis draft removes pct. It checks SPF&apos;s MAIL FROM identity, not HELO, and
          does not model SRS or ARC. ARC can let some receivers trust a list&apos;s or
          forwarder&apos;s earlier authentication results.
        </p>
      </div>
      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Sources</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href="https://www.rfc-editor.org/rfc/rfc7208"
            >
              RFC 7208, Sender Policy Framework
            </Link>
          </li>
          <li>
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href="https://www.rfc-editor.org/rfc/rfc6376"
            >
              RFC 6376, DomainKeys Identified Mail
            </Link>
          </li>
          <li>
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href="https://www.rfc-editor.org/rfc/rfc7489"
            >
              RFC 7489, Domain-based Message Authentication, Reporting, and Conformance
            </Link>
          </li>
          <li>
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href="https://www.rfc-editor.org/rfc/rfc8617"
            >
              RFC 8617, Authenticated Received Chain
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
}

export default function EmailAuthLabPage() {
  return (
    <SimulatorShell
      slug="email-auth-lab"
      fallbackTitle="Email Authentication Lab: SPF, DKIM and DMARC"
      fallbackDescription="Publish sender records, send mail directly and through a forwarder or list, then read SPF, DKIM and DMARC receiver verdicts."
      educational={<EmailAuthEducational />}
      seoLearningPoints={seoLearningPoints}
      shareText="Can you keep email authenticated through forwarding and a mailing list? Try the Email Authentication Lab."
    >
      <EmailAuthLab />
    </SimulatorShell>
  );
}
