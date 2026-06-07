import type { Metadata } from 'next';
import TerraformTerminalSimulator from '@/components/games/terraform-terminal-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('terraform-terminal-simulator');
}

function TerraformEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">About this Terraform simulator</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">What you&apos;ll learn</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>How HCL configuration maps to real cloud resources</li>
            <li>The core workflow: init, validate, plan, apply, destroy</li>
            <li>Why plan shows + create, ~ change, and - destroy before anything runs</li>
            <li>How state tracks the resources Terraform manages</li>
            <li>How variables and outputs parameterize and expose your config</li>
            <li>Why tearing down throwaway infrastructure keeps costs down</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Key commands covered</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Setup:</strong> terraform init, validate, fmt
            </li>
            <li>
              <strong className="text-foreground">Changes:</strong> terraform plan, apply
            </li>
            <li>
              <strong className="text-foreground">State:</strong> terraform state list, show, output
            </li>
            <li>
              <strong className="text-foreground">Cleanup:</strong> terraform destroy
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Browser-safe by design</h4>
        <p className="text-sm text-muted-foreground">
          This lab does not provision real infrastructure. It models a small AWS configuration (a
          security group, an EC2 instance, and an S3 bucket) in the browser so you can read the HCL,
          run the Terraform workflow, and see state change without an AWS account or any cost.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Why learn Terraform?</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>Terraform defines infrastructure as code you can review, version, and reuse.</li>
          <li>The plan and apply workflow makes changes predictable and auditable.</li>
          <li>The same workflow applies across AWS, Azure, GCP, and hundreds of other providers.</li>
        </ul>
      </div>
    </>
  );
}

export default function TerraformTerminalSimulatorPage() {
  return (
    <SimulatorShell
      slug="terraform-terminal-simulator"
      fallbackTitle="Terraform Terminal Simulator"
      fallbackDescription="Practice the Terraform workflow in an interactive browser lab. Read the HCL config, run init, plan, apply, inspect state, and destroy against a safe in-browser AWS example."
      educational={<TerraformEducational />}
      shareText="Practice the Terraform init, plan, apply, and destroy workflow in this interactive browser simulator."
    >
      <TerraformTerminalSimulator />
    </SimulatorShell>
  );
}
