import type { Metadata } from 'next';
import RateLimitSimulator from '../../../components/games/rate-limit-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('rate-limit-simulator');
}

function RateLimitEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">Understanding Rate Limiting</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 font-semibold text-sm">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>How rate limiting protects APIs from abuse</li>
            <li>Different backoff strategies and when to use them</li>
            <li>Reading and understanding rate limit headers</li>
            <li>Handling HTTP 429 responses gracefully</li>
            <li>Optimizing request patterns for better throughput</li>
            <li>Real-world API rate limiting examples</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">Backoff strategies</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Fixed Delay:</strong> Simple but can cause
              thundering herd.
            </li>
            <li>
              <strong className="text-foreground">Linear Backoff:</strong> Predictable increase in
              delay.
            </li>
            <li>
              <strong className="text-foreground">Exponential Backoff:</strong> Rapidly reduces
              load on servers.
            </li>
            <li>
              <strong className="text-foreground">Jittered Exponential:</strong> Prevents
              synchronized retries.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Pro tips</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>Always implement exponential backoff with jitter for production systems.</li>
          <li>Monitor rate limit headers to anticipate throttling before it happens.</li>
          <li>Use circuit breakers to prevent cascading failures.</li>
          <li>Consider different rate limits for different user tiers (free vs paid).</li>
        </ul>
      </div>
    </>
  );
}

export default function RateLimitSimulatorPage() {
  return (
    <SimulatorShell
      slug="rate-limit-simulator"
      educational={<RateLimitEducational />}
      shareText="Check out this Rate Limit Simulator! Perfect for learning API throttling and backoff strategies."
    >
      <RateLimitSimulator />
    </SimulatorShell>
  );
}
