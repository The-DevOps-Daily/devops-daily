import type { Metadata } from 'next';
import Link from 'next/link';
import HttpVersionsLab from '@/components/games/http-versions-lab';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('http-versions-lab');
}

const seoLearningPoints = [
  'Compare HTTP/1.1 connection queues with HTTP/2 and HTTP/3 stream multiplexing',
  'Account for TCP and TLS setup round trips before an HTTP request can start',
  'See why TCP packet loss can block every HTTP/2 stream on one connection',
  'See how QUIC lets HTTP/3 recover a lost stream without blocking the others',
  'Read a request waterfall in milliseconds and round trips',
];

function HttpVersionsLabEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About the HTTP/1.1 vs HTTP/2 vs HTTP/3 Lab</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll practise</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Reading connection setup, queueing, and receiving time in a request waterfall</li>
            <li>Comparing browser HTTP/1.1 connection limits with stream multiplexing</li>
            <li>Recognising TCP head-of-line blocking when one HTTP/2 packet is lost</li>
            <li>Seeing why independent QUIC streams let HTTP/3 isolate that loss</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">How it works</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              The lab loads one HTML document, then twelve CSS, JavaScript, and image assets on a
              fixed link.
            </li>
            <li>
              It compares serial requests over browser HTTP/1.1 connections with multiplexed HTTP/2
              and HTTP/3 streams.
            </li>
            <li>
              A fixed lost model packet carries the second half of app.js and recovers after one
              extra round trip.
            </li>
            <li>
              A simplified model: DNS, server work, congestion control, priorities, caches, header
              compression, server push, and QUIC zero-RTT resumption are out of scope.
            </li>
          </ul>
        </div>
      </div>
      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Sources</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href="https://www.rfc-editor.org/rfc/rfc9112"
            >
              RFC 9112, HTTP/1.1
            </Link>
            : message framing and the HTTP/1.1 protocol.
          </li>
          <li>
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href="https://www.rfc-editor.org/rfc/rfc9113"
            >
              RFC 9113, HTTP/2
            </Link>
            : streams and multiplexed HTTP/2 framing.
          </li>
          <li>
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href="https://www.rfc-editor.org/rfc/rfc9114#section-1"
            >
              RFC 9114 section 1, HTTP/3
            </Link>
            : HTTP/3 over QUIC and its avoidance of TCP head-of-line blocking.
          </li>
          <li>
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href="https://www.rfc-editor.org/rfc/rfc9000#section-2.2"
            >
              RFC 9000 section 2.2, QUIC streams
            </Link>
            : independent stream delivery and loss recovery.
          </li>
          <li>
            <Link
              className="text-primary underline-offset-4 hover:underline"
              href="https://www.rfc-editor.org/rfc/rfc9001"
            >
              RFC 9001, TLS for QUIC
            </Link>
            : the TLS handshake carried by QUIC.
          </li>
        </ul>
      </div>
    </>
  );
}

export default function HttpVersionsLabPage() {
  return (
    <SimulatorShell
      slug="http-versions-lab"
      fallbackTitle="HTTP/1.1 vs HTTP/2 vs HTTP/3 Lab"
      fallbackDescription="Compare HTTP connection setup, request multiplexing, TCP head-of-line blocking, and QUIC loss recovery in one request waterfall."
      educational={<HttpVersionsLabEducational />}
      seoLearningPoints={seoLearningPoints}
      shareText="Can you see why HTTP/3 avoids TCP head-of-line blocking? Try the HTTP versions lab."
    >
      <HttpVersionsLab />
    </SimulatorShell>
  );
}
