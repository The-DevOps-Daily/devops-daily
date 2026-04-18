import type { Metadata } from 'next';
import AwsVpcSimulator from '../../../components/games/aws-vpc-simulator';
import { SimulatorShell } from '@/components/games/simulator-shell';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('aws-vpc-simulator');
}

function AwsVpcEducational() {
  return (
    <>
      <h3 className="mb-4 text-xl font-semibold">Understanding AWS VPC Networking</h3>
      <p className="mb-6 text-sm text-muted-foreground">
        A Virtual Private Cloud (VPC) is your own isolated section of the AWS cloud where you can
        launch resources in a virtual network that you define. Think of it as your own private data
        center in the cloud, with complete control over your networking environment.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-3 font-semibold text-sm">Core Components</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">VPC (Virtual Private Cloud):</strong> Your
              isolated section of AWS cloud where you launch resources in a virtual network you
              define. Each VPC has its own IP address range (CIDR block), typically something like
              10.0.0.0/16.
            </li>
            <li>
              <strong className="text-foreground">Public Subnet:</strong> A subnet with a route to
              the Internet Gateway. Resources here can have public IPs and be directly accessible
              from the internet. Web servers and load balancers typically live here.
            </li>
            <li>
              <strong className="text-foreground">Private Subnet:</strong> A subnet with no direct
              internet access. Resources are protected from public exposure. Databases, application
              servers, and sensitive workloads typically live here.
            </li>
            <li>
              <strong className="text-foreground">Internet Gateway:</strong> Allows communication
              between your VPC and the internet. It&apos;s horizontally scaled, redundant, and
              highly available. You attach one IGW per VPC.
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-sm">Traffic Flow Concepts</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">NAT Gateway:</strong> Enables private subnet
              instances to access the internet (for updates, API calls) while remaining
              unreachable from outside. NAT Gateways must be placed in a public subnet and cost
              ~$0.045/hour plus data charges.
            </li>
            <li>
              <strong className="text-foreground">Route Table:</strong> Contains rules (routes)
              that determine where network traffic is directed. Public subnets route 0.0.0.0/0 to
              the IGW; private subnets route 0.0.0.0/0 to the NAT Gateway.
            </li>
            <li>
              <strong className="text-foreground">CIDR Block:</strong> IP address range for your
              VPC and subnets. The VPC might use 10.0.0.0/16 (65,536 IPs), with subnets like
              10.0.1.0/24 (256 IPs) for public and 10.0.2.0/24 for private.
            </li>
            <li>
              <strong className="text-foreground">Availability Zone:</strong> Isolated locations
              within a region for high availability. Best practice is to deploy subnets across
              multiple AZs (e.g., us-east-1a, us-east-1b) for fault tolerance.
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Common architecture patterns</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Public Web Server:</strong> IGW + Public Subnet +
            EC2 with public IP. Simple setup for static sites or APIs.
          </li>
          <li>
            <strong className="text-foreground">Three-Tier App:</strong> Public subnet (ALB) then
            Private subnet (App servers) then Private subnet (Database).
          </li>
          <li>
            <strong className="text-foreground">Private with NAT:</strong> Private EC2 instances
            that need outbound internet (updates, APIs) via NAT Gateway.
          </li>
        </ul>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Key concepts</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Public vs Private:</strong> Public subnets route
            0.0.0.0/0 to IGW; private subnets route to NAT.
          </li>
          <li>
            <strong className="text-foreground">NAT Gateway Cost:</strong> NAT Gateways cost
            ~$32/month plus data transfer. Consider NAT instances for dev environments.
          </li>
          <li>
            <strong className="text-foreground">Security Layers:</strong> Security Groups
            (stateful) plus NACLs (stateless) protect resources.
          </li>
          <li>
            <strong className="text-foreground">High Availability:</strong> Deploy across multiple
            AZs with subnets in each.
          </li>
          <li>
            <strong className="text-foreground">VPC Peering:</strong> Connect VPCs together for
            private communication across accounts or regions.
          </li>
          <li>
            <strong className="text-foreground">Elastic IP:</strong> Static public IP that can be
            associated with resources in public subnets.
          </li>
        </ul>
      </div>

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <h4 className="mb-2 font-semibold text-sm">Security best practices</h4>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Least Privilege:</strong> Only open necessary
            ports in Security Groups.
          </li>
          <li>
            <strong className="text-foreground">Defense in Depth:</strong> Use both Security
            Groups and NACLs.
          </li>
          <li>
            <strong className="text-foreground">Private by Default:</strong> Put resources in
            private subnets unless they need public access.
          </li>
          <li>
            <strong className="text-foreground">VPC Flow Logs:</strong> Enable flow logs to
            monitor and troubleshoot traffic.
          </li>
          <li>
            <strong className="text-foreground">Endpoints:</strong> Use VPC endpoints for AWS
            services to avoid internet traffic.
          </li>
        </ul>
      </div>
    </>
  );
}

export default function AwsVpcSimulatorPage() {
  return (
    <SimulatorShell
      slug="aws-vpc-simulator"
      educational={<AwsVpcEducational />}
      shareText="Check out this AWS VPC Networking Simulator! Learn how VPCs, subnets, and NAT gateways work."
    >
      <AwsVpcSimulator />
    </SimulatorShell>
  );
}
