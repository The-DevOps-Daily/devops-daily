import type { Metadata } from 'next';
import DeploymentStrategiesSimulator from '../../../components/games/deployment-strategies-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('deployment-strategies');
}

function DeploymentStrategiesEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">Understanding Deployment Strategies</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 font-semibold text-sm">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>How different deployment strategies minimize risk and downtime</li>
            <li>Trade-offs between deployment speed, safety, and resource cost</li>
            <li>When to use each strategy based on your application needs</li>
            <li>How traffic routing changes during deployments</li>
            <li>The role of feature toggles in modern deployment practices</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">Deployment strategies compared</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Recreate:</strong> Simple but causes downtime.
              Terminate all, then deploy all.
            </li>
            <li>
              <strong className="text-foreground">Rolling Update:</strong> Kubernetes default.
              Gradual replacement, zero downtime.
            </li>
            <li>
              <strong className="text-foreground">Blue-Green:</strong> Two environments, instant
              switch, instant rollback.
            </li>
            <li>
              <strong className="text-foreground">Canary:</strong> Gradual traffic shift, real-user
              testing, data-driven rollout.
            </li>
            <li>
              <strong className="text-foreground">Feature Toggles:</strong> Decouple deployment
              from release, per-user targeting.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Real-world implementations</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Kubernetes:</strong> Native support for Rolling
            Updates and Recreate via Deployment spec.
          </li>
          <li>
            <strong className="text-foreground">Argo Rollouts:</strong> Advanced Blue-Green and
            Canary with automated analysis.
          </li>
          <li>
            <strong className="text-foreground">Istio/Linkerd:</strong> Service mesh traffic
            splitting for Canary deployments.
          </li>
          <li>
            <strong className="text-foreground">LaunchDarkly/Unleash:</strong> Feature flag
            platforms for toggle-based releases.
          </li>
          <li>
            <strong className="text-foreground">AWS CodeDeploy:</strong> Managed deployment
            service supporting multiple strategies.
          </li>
        </ul>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Best practices</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>Always have a rollback plan before deploying to production.</li>
          <li>Use health checks and readiness probes to verify new versions.</li>
          <li>Implement proper monitoring and alerting during deployments.</li>
          <li>Consider database migrations carefully. They often need special handling.</li>
          <li>Start with smaller blast radius (Canary) for critical services.</li>
          <li>Clean up feature flags after features are fully rolled out.</li>
        </ul>
      </div>
    </>
  );
}

export default function DeploymentStrategiesPage() {
  return (
    <SimulatorShell
      slug="deployment-strategies"
      educational={<DeploymentStrategiesEducational />}
      shareText="Check out this Deployment Strategies Simulator! Learn Blue-Green, Canary, Rolling Updates and more."
    >
      <DeploymentStrategiesSimulator />
    </SimulatorShell>
  );
}
