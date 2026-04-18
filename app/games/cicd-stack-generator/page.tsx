import type { Metadata } from 'next';
import CICDStackGenerator from '../../../components/games/cicd-stack-generator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('cicd-stack-generator');
}

function CicdStackEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">How it works</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        The CI/CD Stack Generator randomly combines:
      </p>
      <ul className="mb-4 space-y-2 text-sm text-muted-foreground">
        <li>
          <strong className="text-foreground">CI/CD Tools:</strong> GitHub Actions, Jenkins, GitLab
          CI, and more.
        </li>
        <li>
          <strong className="text-foreground">Infrastructure Tools:</strong> Terraform, Ansible,
          Pulumi, and more.
        </li>
        <li>
          <strong className="text-foreground">Cloud Platforms:</strong> AWS, GCP, or even a
          Raspberry Pi.
        </li>
      </ul>
      <p className="mb-4 text-sm text-muted-foreground">
        Spin the wheels to get your perfect (or perfectly cursed) DevOps stack. Each combination
        receives a humorous rating that you can share with your team.
      </p>
      <p className="text-sm text-muted-foreground">
        This is just a fun game, but who knows, you might discover your next favorite tech stack.
      </p>
    </>
  );
}

export default function CICDStackGeneratorPage() {
  return (
    <SimulatorShell
      slug="cicd-stack-generator"
      educational={<CicdStackEducational />}
      shareText="Try the CI/CD Stack Generator! Get your perfect (or perfectly cursed) DevOps stack combination!"
    >
      <CICDStackGenerator />
    </SimulatorShell>
  );
}
