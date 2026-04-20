import { K8sResourcesCalculator } from '@/components/tools/k8s-resources';
import { ToolShell } from '@/components/tools/tool-shell';
import { buildToolMetadata } from '@/lib/tools';

export const metadata = buildToolMetadata('k8s-resources');

function Explainer() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">How to size Kubernetes Pods</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 font-semibold text-sm">Start from real numbers</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Measure actual peak usage from a running Pod with <code className="font-mono">kubectl top pod</code> or Prometheus. Guessing leads to overprovisioning (wastes money) or underprovisioning (evictions and OOMKills).
          </p>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">Then add headroom</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Workloads have bursts your metrics didn&apos;t capture. 25-50% headroom is typical. If traffic is unpredictable, lean higher. If cost matters more than reliability, lean lower.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Why CPU limits are controversial</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Kubernetes throttles containers that exceed their CPU limit, even when the node has idle CPU. This can cause tail-latency spikes. Many teams set CPU requests (for scheduling fairness) and leave CPU limits unset. Memory limits are different because memory can&apos;t be throttled and has to be bounded somehow.
        </p>
      </div>
    </>
  );
}

export default function K8sResourcesPage() {
  return (
    <ToolShell slug="k8s-resources" explainer={<Explainer />}>
      <K8sResourcesCalculator />
    </ToolShell>
  );
}
