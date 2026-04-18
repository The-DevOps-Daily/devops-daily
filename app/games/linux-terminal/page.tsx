import type { Metadata } from 'next';
import LinuxTerminal from '@/components/games/linux-terminal';
import { SimulatorShell } from '@/components/games/simulator-shell';

export const metadata: Metadata = {
  title: 'Learn Linux - Interactive Terminal Tutorial | DevOps Daily',
  description:
    'Master essential Linux commands through interactive lessons. Practice pwd, ls, cd, cat, grep, chmod, and more in a simulated terminal environment.',
  alternates: {
    canonical: '/games/linux-terminal',
  },
  openGraph: {
    title: 'Learn Linux - Interactive Terminal Tutorial | DevOps Daily',
    description:
      'Master essential Linux commands through interactive lessons. Practice in a simulated terminal environment.',
    type: 'website',
    url: '/games/linux-terminal',
    images: [
      {
        url: '/images/games/linux-terminal-og.png',
        width: 1200,
        height: 630,
        alt: 'Learn Linux - Interactive Terminal Tutorial',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Learn Linux - Interactive Terminal Tutorial | DevOps Daily',
    description:
      'Master essential Linux commands through interactive lessons. Practice in a simulated terminal environment.',
    images: ['/images/games/linux-terminal-og.png'],
  },
};

function LinuxTerminalEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About this tutorial</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 font-semibold text-sm">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Navigate the Linux file system with confidence</li>
            <li>Create, copy, move, and delete files and directories</li>
            <li>View and search file contents with cat, grep, head, tail</li>
            <li>Understand and modify file permissions</li>
            <li>Use pipes and redirection to chain commands</li>
            <li>Check system resources with df, free, and env</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">Key commands covered</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Navigation:</strong> pwd, ls, cd
            </li>
            <li>
              <strong className="text-foreground">File Operations:</strong> touch, mkdir, cp, mv,
              rm
            </li>
            <li>
              <strong className="text-foreground">Viewing:</strong> cat, head, tail, grep, wc, find
            </li>
            <li>
              <strong className="text-foreground">System:</strong> whoami, hostname, df, free, env
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Tips for success</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            Use the <strong className="text-foreground">Up/Down arrow keys</strong> to navigate
            command history.
          </li>
          <li>
            Type <strong className="text-foreground">help</strong> to see all available commands.
          </li>
          <li>
            Type <strong className="text-foreground">clear</strong> to clear the terminal screen.
          </li>
          <li>
            Click the <strong className="text-foreground">Show Hint</strong> button if you get
            stuck.
          </li>
        </ul>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Why learn Linux?</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>Linux powers over 90% of the world&apos;s cloud infrastructure.</li>
          <li>Essential for DevOps, SRE, and backend development roles.</li>
          <li>Foundation for containerization (Docker, Kubernetes).</li>
          <li>Understanding Linux makes you a more effective developer.</li>
        </ul>
      </div>
    </>
  );
}

export default function LinuxTerminalPage() {
  return (
    <SimulatorShell
      slug="linux-terminal"
      fallbackTitle="Learn Linux - Interactive Tutorial"
      fallbackDescription="Practice Linux commands in an interactive terminal simulator. Learn essential commands for DevOps work through hands-on challenges."
      educational={<LinuxTerminalEducational />}
      shareText="Learn Linux commands interactively! Great tutorial for beginners."
    >
      <LinuxTerminal />
    </SimulatorShell>
  );
}
