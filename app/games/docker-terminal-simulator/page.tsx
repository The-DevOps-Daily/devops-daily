import type { Metadata } from 'next';
import DockerTerminalSimulator from '@/components/games/docker-terminal-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('docker-terminal-simulator');
}

function DockerTerminalEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About this Docker simulator</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>How the Docker CLI talks to a local daemon</li>
            <li>The difference between images, containers, layers, and tags</li>
            <li>Container lifecycle commands: run, ps, logs, stop, start, exec, inspect</li>
            <li>How port publishing connects host traffic to container processes</li>
            <li>Why volumes and user-defined networks matter for stateful apps</li>
            <li>How Docker Compose coordinates a multi-container stack</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Key commands covered</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Basics:</strong> docker version, docker info,
              docker images
            </li>
            <li>
              <strong className="text-foreground">Containers:</strong> docker run, ps, logs, stop,
              start, exec, inspect
            </li>
            <li>
              <strong className="text-foreground">Builds:</strong> Dockerfile, docker build,
              docker history
            </li>
            <li>
              <strong className="text-foreground">State:</strong> docker volume, docker network,
              docker compose
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Browser-safe by design</h4>
        <p className="text-sm text-muted-foreground">
          This lab does not run real containers. It models Docker daemon state in the browser so you
          can safely practice commands, understand cause and effect, and build muscle memory before
          using Docker on your machine or in CI.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Why learn Docker?</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>Docker packages apps with their runtime dependencies.</li>
          <li>Containers make local development, CI, and production deployments more consistent.</li>
          <li>Docker fundamentals transfer directly to Kubernetes and cloud container platforms.</li>
        </ul>
      </div>
    </>
  );
}

export default function DockerTerminalSimulatorPage() {
  return (
    <SimulatorShell
      slug="docker-terminal-simulator"
      fallbackTitle="Docker Terminal Simulator"
      fallbackDescription="Practice Docker commands in an interactive browser terminal. Learn images, containers, logs, exec, builds, volumes, networks, and Docker Compose through guided lessons."
      educational={<DockerTerminalEducational />}
      shareText="Practice Docker commands in a browser with this interactive Docker Terminal Simulator."
    >
      <DockerTerminalSimulator />
    </SimulatorShell>
  );
}
