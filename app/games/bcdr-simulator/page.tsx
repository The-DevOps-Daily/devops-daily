import type { Metadata } from 'next';
import Image from 'next/image';
import BCDRSimulator from '@/components/games/bcdr-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('bcdr-simulator');
}

function BcdrEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">Understanding BCDR</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 font-semibold text-sm">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>RTO (Recovery Time Objective) and RPO (Recovery Point Objective)</li>
            <li>Hot, Warm, and Cold disaster recovery sites</li>
            <li>Backup frequency and data replication strategies</li>
            <li>Failover automation and manual procedures</li>
            <li>Cost vs. recovery time trade-offs</li>
            <li>Real-world disaster scenario planning</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">DR site types</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Hot Site:</strong> Real-time replication, instant
              failover. Highest cost but minimal downtime.
            </li>
            <li>
              <strong className="text-foreground">Warm Site:</strong> Regular backups, hours to
              recover. Balanced cost and recovery.
            </li>
            <li>
              <strong className="text-foreground">Cold Site:</strong> Basic infrastructure, days to
              recover. Lowest cost but longest downtime.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Key metrics</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">RTO:</strong> Maximum acceptable downtime after a
            disaster.
          </li>
          <li>
            <strong className="text-foreground">RPO:</strong> Maximum acceptable data loss (how far
            back your last backup is).
          </li>
          <li>
            <strong className="text-foreground">MTTR:</strong> Mean Time To Recovery. Average time
            to restore service.
          </li>
          <li>
            <strong className="text-foreground">MTPD:</strong> Maximum Tolerable Period of
            Disruption.
          </li>
        </ul>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Best practices</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>Align DR strategy with business criticality and budget.</li>
          <li>Test failover procedures regularly (at least quarterly).</li>
          <li>Document runbooks for all disaster scenarios.</li>
          <li>Use geographic diversity for DR sites.</li>
          <li>Automate failover where possible to reduce human error.</li>
        </ul>
      </div>

      <div className="mt-6 rounded-md border bg-background p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <a
            href="https://m.do.co/c/2a9bba940f39"
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="shrink-0"
          >
            <Image
              src="/acronis.svg"
              alt="Acronis"
              width={80}
              height={80}
              className="rounded-lg"
            />
          </a>
          <div className="flex-1 text-center sm:text-left">
            <h4 className="mb-2 font-semibold text-sm">Need a real BCDR solution?</h4>
            <p className="mb-3 text-sm text-muted-foreground">
              <strong className="text-foreground">Acronis Cyber Protect</strong> offers
              enterprise-grade backup and disaster recovery with anti-ransomware protection.
              Trusted by 500,000+ businesses worldwide.
            </p>
            <a
              href="https://m.do.co/c/2a9bba940f39"
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="inline-flex items-center gap-2 rounded-md border border-primary/30 px-3 py-1.5 text-sm font-mono text-primary transition-colors hover:bg-primary/10"
            >
              Learn more about Acronis
              <span aria-hidden="true">-&gt;</span>
            </a>
          </div>
        </div>
        <p className="mt-4 text-xs text-center text-muted-foreground/70">
          <em>
            This page contains an affiliate link. Using it helps support DevOps Daily at no extra
            cost to you.
          </em>
        </p>
      </div>
    </>
  );
}

export default function BCDRSimulatorPage() {
  return (
    <SimulatorShell
      slug="bcdr-simulator"
      educational={<BcdrEducational />}
      shareText="Check out this BCDR Simulator! Learn disaster recovery strategies interactively."
    >
      <BCDRSimulator />
    </SimulatorShell>
  );
}
