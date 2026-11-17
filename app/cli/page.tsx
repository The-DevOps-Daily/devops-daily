import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BookOpen,
  ClipboardCheck,
  ExternalLink,
  Gamepad2,
  Layers,
  ShieldCheck,
  Siren,
  Stethoscope,
  Terminal,
} from 'lucide-react';
import { PageHero } from '@/components/page-hero';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { Button } from '@/components/ui/button';

const REPO = 'https://github.com/The-DevOps-Daily/devops-daily-cli';
const POST = '/posts/devops-daily-cli-learn-devops-from-your-terminal';
const COVER = '/images/posts/devops-daily-cli-learn-devops-from-your-terminal.jpg';
const title = 'DevOps Daily CLI: Learn DevOps From Your Terminal';
const description =
  'Read posts, take quizzes, study flashcards, work through checklists, solve the incident of the day and check your own hosts from the terminal. Free, open source, no account.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/cli' },
  openGraph: {
    title: `${title} | DevOps Daily`,
    description,
    type: 'website',
    url: '/cli',
    images: [{ url: COVER, width: 1200, height: 630, alt: 'DevOps Daily CLI' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${title} | DevOps Daily`,
    description,
    images: [COVER],
  },
};

const INSTALL = [
  { label: 'Homebrew', cmd: 'brew install The-DevOps-Daily/tap/devops-daily' },
  { label: 'npm', cmd: 'npx @devopsdaily/devops-daily-cli' },
  {
    label: 'Install script',
    cmd: 'curl -fsSL https://raw.githubusercontent.com/The-DevOps-Daily/devops-daily-cli/main/install.sh | sh',
  },
  {
    label: 'Go',
    cmd: 'go install github.com/The-DevOps-Daily/devops-daily-cli/cmd/devops-daily@latest',
  },
];

const FEATURES = [
  {
    icon: BookOpen,
    cmd: 'devops-daily read <slug>',
    text: 'Read any post in the terminal, with its links at the end. List them with posts --tag k8s.',
  },
  {
    icon: Layers,
    cmd: 'devops-daily quiz docker',
    text: 'Play the site quizzes. Your best score is kept on your machine.',
  },
  {
    icon: Stethoscope,
    cmd: 'devops-daily flashcards',
    text: 'Study a deck with simple spaced repetition.',
  },
  {
    icon: ClipboardCheck,
    cmd: 'devops-daily checklist',
    text: 'Tick off a checklist; progress is saved.',
  },
  {
    icon: Siren,
    cmd: 'devops-daily incident',
    text: "Today's real-world incident, then the fix with --fix.",
  },
  {
    icon: Gamepad2,
    cmd: 'devops-daily play dns',
    text: 'Open a simulator, a game or Opsville in your browser.',
  },
];

export default function CliPage() {
  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'CLI', url: '/cli' },
        ]}
      />
      <PageHero
        title="DevOps Daily CLI"
        accentWord="CLI"
        description="Learn DevOps from your terminal. Posts, quizzes, flashcards, checklists and the incident of the day, free and open source."
        icon={Terminal}
        breadcrumbs={[{ label: 'CLI' }]}
      />
      <div className="container mx-auto max-w-4xl space-y-12 px-4 py-10">
        <section aria-labelledby="try">
          <h2 id="try" className="text-2xl font-bold">
            Try it now, nothing to install
          </h2>
          <p className="mt-2 text-muted-foreground">
            The same menu runs over SSH. No account and no password; any SSH key works, or none.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg border bg-muted p-4 font-mono text-sm">
            <code>ssh ssh.devops-daily.com</code>
          </pre>
        </section>

        <section aria-labelledby="install">
          <h2 id="install" className="text-2xl font-bold">
            Install
          </h2>
          <p className="mt-2 text-muted-foreground">
            A small binary for macOS, Linux and Windows. The command is <code>devops-daily</code>,
            with the short alias <code>ddy</code>.
          </p>
          <div className="mt-4 space-y-3">
            {INSTALL.map((item) => (
              <div key={item.label}>
                <p className="text-sm font-medium">{item.label}</p>
                <pre className="mt-1 overflow-x-auto rounded-lg border bg-muted p-3 font-mono text-sm">
                  <code>{item.cmd}</code>
                </pre>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="what">
          <h2 id="what" className="text-2xl font-bold">
            What you can do
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.cmd} className="rounded-lg border bg-card p-4">
                <f.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                <code className="mt-2 block break-words font-mono text-sm font-semibold">
                  {f.cmd}
                </code>
                <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="private" className="rounded-lg border bg-card p-5">
          <h2 id="private" className="flex items-center gap-2 text-xl font-bold">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            Offline and private
          </h2>
          <p className="mt-2 text-muted-foreground">
            No telemetry and no account. After the first sync the CLI works offline, and your
            progress never leaves your machine. The code is open source under the MIT license.
          </p>
        </section>

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={POST}>Read the launch post</Link>
          </Button>
          <Button asChild variant="outline">
            <a href={REPO} target="_blank" rel="noopener noreferrer">
              Source on GitHub <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
            </a>
          </Button>
        </div>
      </div>
    </>
  );
}
