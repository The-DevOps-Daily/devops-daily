import type { Metadata } from 'next';
import Link from 'next/link';
import TerraformTerminalSimulator from '@/components/games/terraform-terminal-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('terraform-terminal-simulator');
}

function TerraformEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">Terraform basics, explained</h3>
      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        Terraform is an infrastructure as code (IaC) tool. Instead of clicking through a cloud
        console, you describe the infrastructure you want in configuration files, and Terraform
        figures out how to create, change, or destroy it to match. This lab teaches that loop
        hands-on. Below is the background to go with it.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">The building blocks (HCL)</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">provider:</strong> the plugin Terraform uses to
              talk to a platform, such as AWS, Azure, or GCP.
            </li>
            <li>
              <strong className="text-foreground">resource:</strong> a single piece of
              infrastructure, like an EC2 instance or an S3 bucket.
            </li>
            <li>
              <strong className="text-foreground">variable:</strong> an input you can change without
              editing the main config, such as region or instance size.
            </li>
            <li>
              <strong className="text-foreground">output:</strong> a value Terraform exposes after
              apply, like an instance IP, for you or other tools to read.
            </li>
            <li>
              <strong className="text-foreground">state:</strong> Terraform&apos;s record of what it
              created, so it knows what to change next time.
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">The core workflow</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">terraform init:</strong> download providers and
              prepare the directory. Run it first.
            </li>
            <li>
              <strong className="text-foreground">terraform validate:</strong> check the config is
              syntactically valid.
            </li>
            <li>
              <strong className="text-foreground">terraform plan:</strong> preview the changes.{' '}
              <span className="font-mono">+</span> create, <span className="font-mono">~</span>{' '}
              change, <span className="font-mono">-</span> destroy.
            </li>
            <li>
              <strong className="text-foreground">terraform apply:</strong> make the changes and
              write them to state.
            </li>
            <li>
              <strong className="text-foreground">terraform destroy:</strong> tear everything down so
              it stops costing money.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Try it in the lab</h4>
        <p className="text-sm text-muted-foreground">
          Run <code className="text-primary">terraform init</code>, then{' '}
          <code className="text-primary">plan</code> and{' '}
          <code className="text-primary">apply</code> to create the example resources. Then switch the
          config panel to <span className="font-mono">edit</span> mode, change{' '}
          <code className="text-primary">instance_type</code> in <span className="font-mono">variables.tf</span>,
          and run <code className="text-primary">terraform plan</code> again. Terraform shows a{' '}
          <span className="font-mono">~</span> in-place update because your config no longer matches
          state. Delete a resource block and plan shows a <span className="font-mono">-</span>{' '}
          destroy. That diff between desired and actual is the heart of how Terraform works.
        </p>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Common beginner gotchas</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>Always read the plan before you apply. The plan is your safety check.</li>
          <li>State is the source of truth. Never hand-edit it, and store it in a remote backend for teams.</li>
          <li>Some changes update in place; others force a replacement (shown as -/+ in a real plan).</li>
          <li>Keep secrets out of plaintext config and state. Use variables and a secrets manager.</li>
          <li>Run terraform destroy on throwaway environments so you do not pay for idle resources.</li>
        </ul>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 text-sm font-semibold">Browser-safe by design</h4>
        <p className="text-sm text-muted-foreground">
          This lab does not provision real infrastructure. It models a small AWS configuration (a
          security group, an EC2 instance, and an S3 bucket) in the browser so you can read and edit
          the HCL, run the full workflow, and see state change without an AWS account or any cost.
        </p>
      </div>

      <div className="mt-6">
        <h4 className="mb-3 text-sm font-semibold">Keep learning</h4>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <li>
            <Link href="/guides/introduction-to-terraform" className="text-primary hover:underline">
              Introduction to Terraform guide
            </Link>
          </li>
          <li>
            <Link href="/categories/terraform" className="text-primary hover:underline">
              All Terraform articles
            </Link>
          </li>
          <li>
            <Link href="/comparisons/terraform-vs-opentofu" className="text-primary hover:underline">
              Terraform vs OpenTofu
            </Link>
          </li>
          <li>
            <Link href="/comparisons/terraform-vs-pulumi" className="text-primary hover:underline">
              Terraform vs Pulumi
            </Link>
          </li>
          <li>
            <Link
              href="/comparisons/terraform-vs-cloudformation"
              className="text-primary hover:underline"
            >
              Terraform vs CloudFormation
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
}

export default function TerraformTerminalSimulatorPage() {
  return (
    <SimulatorShell
      slug="terraform-terminal-simulator"
      fallbackTitle="Terraform Basics Simulator"
      fallbackDescription="Learn Terraform basics in an interactive browser lab. Read and edit the HCL config, run init, plan, apply, and destroy, and watch state react to your changes. No AWS account needed."
      educational={<TerraformEducational />}
      shareText="Learn Terraform basics in the browser: edit the HCL, run plan and apply, and watch state change in this interactive lab."
      seoLearningPoints={[
        'What infrastructure as code (IaC) is and why teams use Terraform',
        'The HCL building blocks: provider, resource, variable, output, and state',
        'The core Terraform workflow: init, validate, plan, apply, and destroy',
        'How to read a plan: + create, ~ change in place, and - destroy',
        'How editing your config changes the plan against existing state',
        'Why you destroy throwaway environments to control cost',
      ]}
    >
      <TerraformTerminalSimulator />
    </SimulatorShell>
  );
}
