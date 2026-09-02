import type { Metadata } from 'next';
import DockerEscape from '@/components/games/docker-escape';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('docker-escape');
}

const seoLearningPoints = [
  'Why mounting /var/run/docker.sock is equivalent to handing over root on the host',
  'What --privileged actually grants, and the two escapes it enables',
  'How --pid=host plus a capability combine into a full container escape',
  'Why SYS_ADMIN is close to root, even though it looks more careful than --privileged',
  'What the default AppArmor profile is quietly protecting you from',
  'What a hardened docker run command looks like when every flag is deliberate',
];

function DockerEscapeEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About this container security challenge</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>That most container escapes are one flag, not a kernel exploit</li>
            <li>How the Docker socket turns any container into host root</li>
            <li>Why two individually survivable flags can combine into something much worse</li>
            <li>What to grant instead, for each dangerous flag</li>
            <li>That a container is not a security boundary unless you make it one</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Why it matters</h4>
          <p className="text-sm text-muted-foreground">
            Image scanning gets the attention, but a scanner never looks at how the container is
            run. Every scenario here is something people genuinely ship, usually because a tutorial
            said to, and each one gives an attacker the host without needing a CVE.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            The last scenario has nothing wrong with it. Assuming every config is broken is its own
            failure mode.
          </p>
        </div>
      </div>
      <div className="mt-6 rounded-lg border p-4 text-sm text-muted-foreground">
        <p>
          Related reading:{' '}
          <a className="underline" href="/posts/why-your-base-image-has-1684-cves">
            why your base image reports thousands of CVEs
          </a>{' '}
          covers the other half of container security, the part scanners do look at. See also{' '}
          <a className="underline" href="/posts/ghostlock-cve-2026-43499-container-boundary">
            your container is not a security boundary
          </a>
          .
        </p>
      </div>
    </>
  );
}

export default function DockerEscapePage() {
  return (
    <SimulatorShell slug="docker-escape" educational={<DockerEscapeEducational />} seoLearningPoints={seoLearningPoints}>
      <DockerEscape />
    </SimulatorShell>
  );
}
