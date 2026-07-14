import type { Metadata } from 'next';
import DockerUnderTheHoodSimulator from '@/components/games/docker-under-the-hood-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('docker-under-the-hood-simulator');
}

const seoLearningPoints = [
  'What actually happens when you run docker run -p 8080:80 nginx, layer by layer',
  'Why the docker CLI is just a REST client that talks to the daemon over a socket',
  'How dockerd delegates to containerd, and what containerd does with the image layers',
  'What an OCI runtime bundle is: a config.json plus a rootfs',
  'How runc turns that bundle into a running process using namespaces and cgroups',
  'Why a container is a normal host process, not a small virtual machine',
];

function DockerEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">
        About this &quot;how Docker works&quot; simulator
      </h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>The full path from your terminal down to the Linux kernel</li>
            <li>The real jobs of the CLI, dockerd, containerd, and runc, and why there are four of them</li>
            <li>What gets pulled from a registry, and that only missing layers are downloaded</li>
            <li>How the OCI bundle (config.json + rootfs) describes the container before it exists</li>
            <li>Which kernel features do the actual isolation: namespaces, cgroups, networking, mounts</li>
            <li>The real command at each step, so you can reproduce the whole thing yourself</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">The stack, top to bottom</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">docker CLI:</strong> turns your command into an API
              call over /var/run/docker.sock
            </li>
            <li>
              <strong className="text-foreground">dockerd:</strong> the engine; checks the image, prepares
              config, pulls if needed
            </li>
            <li>
              <strong className="text-foreground">containerd:</strong> unpacks layers, tracks state,
              prepares the runtime bundle
            </li>
            <li>
              <strong className="text-foreground">runc:</strong> creates the namespaces and cgroup, then
              execs your process
            </li>
            <li>
              <strong className="text-foreground">the kernel:</strong> the shared host kernel is the real
              boundary
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">A container is not a small VM</h4>
        <p className="text-sm text-muted-foreground">
          The single most important idea in the simulator is the last step. A VM boots a whole guest
          operating system on virtual hardware. A container does not: nginx is a normal process on your
          host, and the only thing separating it from everything else is a set of kernel features.
          Namespaces control what it can see, cgroups control what it can use, and both are just the
          host kernel doing bookkeeping. That is why a container starts in milliseconds while a VM takes
          seconds.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Try it on a real host</h4>
        <p className="text-sm text-muted-foreground">
          Every command in the simulator is real. The clean way to poke at namespaces and cgroups
          without touching your laptop is a throwaway Linux box: spin up a{' '}
          <a
            href="https://m.do.co/c/2a9bba940f39"
            rel="nofollow sponsored"
            className="font-medium text-primary underline underline-offset-2"
          >
            DigitalOcean droplet
          </a>
          , run the nginx container, then use lsns, runc list, and cat /sys/fs/cgroup to watch the same
          pieces the simulator shows. Delete the droplet when you are done.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Go deeper</h4>
        <p className="text-sm text-muted-foreground">
          The companion post,{' '}
          <a
            href="https://devops-daily.com/posts/how-docker-works-under-the-hood"
            className="font-medium text-primary underline underline-offset-2"
          >
            How Docker Really Works, From docker run to the Kernel
          </a>
          , walks the same path in depth with the commands to run on a real host, and explains why the
          split between dockerd, containerd, and runc exists at all.
        </p>
      </div>
    </>
  );
}

export default function DockerUnderTheHoodSimulatorPage() {
  return (
    <SimulatorShell
      slug="docker-under-the-hood-simulator"
      fallbackTitle="How Docker Works Under the Hood"
      fallbackDescription="Step through what really happens when you run docker run -p 8080:80 nginx: the CLI, dockerd, the registry pull, containerd, the OCI bundle, runc, and the shared Linux kernel, with the real command at every layer."
      educational={<DockerEducational />}
      seoLearningPoints={seoLearningPoints}
      shareText="What actually happens when you run a docker container? Step down the whole stack from the CLI to the kernel in this interactive simulator."
    >
      <DockerUnderTheHoodSimulator />
    </SimulatorShell>
  );
}
