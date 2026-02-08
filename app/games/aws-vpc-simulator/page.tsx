import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import AwsVpcSimulator from '../../../components/games/aws-vpc-simulator';
import { Twitter, Facebook, Linkedin } from 'lucide-react';
import { generateGameMetadata } from '@/lib/game-metadata';
import { getGameById } from '@/lib/games';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('aws-vpc-simulator');
}

export default async function AwsVpcSimulatorPage() {
  const game = await getGameById('aws-vpc-simulator');
  const gameTitle = game?.title || 'AWS VPC Networking Simulator';

  const breadcrumbItems = [
    { label: 'Games', href: '/games' },
    { label: gameTitle, href: '/games/aws-vpc-simulator', isCurrent: true },
  ];

  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Games', url: '/games' },
    { name: gameTitle, url: '/games/aws-vpc-simulator' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container px-4 py-8 mx-auto">
        <Breadcrumb items={breadcrumbItems} />

        <div className="flex flex-col items-center mx-auto max-w-7xl">
          <h2 className="sr-only">
            AWS VPC Networking Simulator - Learn How Virtual Private Clouds Work
          </h2>
          <AwsVpcSimulator />

          {/* Educational Content */}
          <div className="w-full p-6 my-8 rounded-lg bg-muted/30">
            <h2 className="mb-4 text-2xl font-bold">Understanding AWS VPC Networking</h2>
            
            <p className="mb-6 text-muted-foreground">
              A Virtual Private Cloud (VPC) is your own isolated section of the AWS cloud where you can launch 
              resources in a virtual network that you define. Think of it as your own private data center in the cloud, 
              with complete control over your networking environment.
            </p>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-3 text-lg font-semibold">Core Components</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <strong className="text-orange-600">VPC (Virtual Private Cloud):</strong> Your
                    isolated section of AWS cloud where you launch resources in a virtual network you define. 
                    Each VPC has its own IP address range (CIDR block), typically something like 10.0.0.0/16.
                  </div>
                  <div>
                    <strong className="text-green-600">Public Subnet:</strong> A subnet with a route
                    to the Internet Gateway. Resources here can have public IPs and be directly accessible 
                    from the internet. Web servers and load balancers typically live here.
                  </div>
                  <div>
                    <strong className="text-blue-600">Private Subnet:</strong> A subnet with no direct 
                    internet access. Resources are protected from public exposure. Databases, application 
                    servers, and sensitive workloads typically live here.
                  </div>
                  <div>
                    <strong className="text-purple-600">Internet Gateway:</strong> Allows
                    communication between your VPC and the internet. It&apos;s horizontally scaled, redundant, 
                    and highly available. You attach one IGW per VPC.
                  </div>
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-lg font-semibold">Traffic Flow Concepts</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <strong className="text-cyan-600">NAT Gateway:</strong> Enables private subnet
                    instances to access the internet (for updates, API calls) while remaining unreachable 
                    from outside. NAT Gateways must be placed in a public subnet and cost ~$0.045/hour plus data charges.
                  </div>
                  <div>
                    <strong className="text-indigo-600">Route Table:</strong> Contains rules (routes)
                    that determine where network traffic is directed. Public subnets route 0.0.0.0/0 to the IGW; 
                    private subnets route 0.0.0.0/0 to the NAT Gateway.
                  </div>
                  <div>
                    <strong className="text-pink-600">CIDR Block:</strong> IP address range for your
                    VPC and subnets. The VPC might use 10.0.0.0/16 (65,536 IPs), with subnets like 
                    10.0.1.0/24 (256 IPs) for public and 10.0.2.0/24 for private.
                  </div>
                  <div>
                    <strong className="text-teal-600">Availability Zone:</strong> Isolated locations
                    within a region for high availability. Best practice is to deploy subnets across 
                    multiple AZs (e.g., us-east-1a, us-east-1b) for fault tolerance.
                  </div>
                </div>
              </div>
            </div>

            {/* Common Architecture Patterns */}
            <div className="p-4 mt-6 border rounded-lg bg-blue-50 dark:bg-blue-950/20 border-blue-500/20">
              <h3 className="mb-3 text-lg font-semibold">🏗️ Common Architecture Patterns</h3>
              <div className="grid gap-4 text-sm md:grid-cols-3">
                <div>
                  <strong className="text-blue-600">Public Web Server</strong>
                  <p className="mt-1 text-muted-foreground">IGW + Public Subnet + EC2 with public IP. Simple setup for static sites or APIs.</p>
                </div>
                <div>
                  <strong className="text-blue-600">Three-Tier App</strong>
                  <p className="mt-1 text-muted-foreground">Public subnet (ALB) → Private subnet (App servers) → Private subnet (Database).</p>
                </div>
                <div>
                  <strong className="text-blue-600">Private with NAT</strong>
                  <p className="mt-1 text-muted-foreground">Private EC2 instances that need outbound internet (updates, APIs) via NAT Gateway.</p>
                </div>
              </div>
            </div>

            {/* Key Concepts */}
            <div className="p-4 mt-4 border rounded-lg bg-orange-50 dark:bg-orange-950/20 border-orange-500/20">
              <h3 className="mb-2 text-lg font-semibold">💡 Key Concepts to Remember</h3>
              <ul className="space-y-1 text-sm">
                <li>• <strong>Public vs Private:</strong> Public subnets route 0.0.0.0/0 to IGW; private subnets route to NAT</li>
                <li>• <strong>NAT Gateway Cost:</strong> NAT Gateways cost ~$32/month + data transfer - consider NAT instances for dev environments</li>
                <li>• <strong>Security Layers:</strong> Security Groups (stateful) + NACLs (stateless) protect resources</li>
                <li>• <strong>High Availability:</strong> Deploy across multiple AZs with subnets in each</li>
                <li>• <strong>VPC Peering:</strong> Connect VPCs together for private communication across accounts or regions</li>
                <li>• <strong>Elastic IP:</strong> Static public IP that can be associated with resources in public subnets</li>
              </ul>
            </div>

            {/* Security Best Practices */}
            <div className="p-4 mt-4 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-500/20">
              <h3 className="mb-2 text-lg font-semibold">🔒 Security Best Practices</h3>
              <ul className="space-y-1 text-sm">
                <li>• <strong>Least Privilege:</strong> Only open necessary ports in Security Groups</li>
                <li>• <strong>Defense in Depth:</strong> Use both Security Groups and NACLs</li>
                <li>• <strong>Private by Default:</strong> Put resources in private subnets unless they need public access</li>
                <li>• <strong>VPC Flow Logs:</strong> Enable flow logs to monitor and troubleshoot traffic</li>
                <li>• <strong>Endpoints:</strong> Use VPC endpoints for AWS services to avoid internet traffic</li>
              </ul>
            </div>
          </div>

          {/* Share buttons */}
          <div className="w-full max-w-md my-8">
            <h3 className="mb-4 text-lg font-medium text-center">Share this simulator</h3>
            <div className="flex justify-center gap-4">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out this AWS VPC Networking Simulator! Learn how VPCs, subnets, and NAT gateways work.')}&url=${encodeURIComponent('https://devops-daily.com/games/aws-vpc-simulator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1DA1F2] text-white rounded-full hover:bg-[#1a91da] transition-colors"
              >
                <Twitter size={20} />
                <span className="sr-only">Share on Twitter</span>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://devops-daily.com/games/aws-vpc-simulator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#1877F2] text-white rounded-full hover:bg-[#166fe5] transition-colors"
              >
                <Facebook size={20} />
                <span className="sr-only">Share on Facebook</span>
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://devops-daily.com/games/aws-vpc-simulator')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-3 bg-[#0A66C2] text-white rounded-full hover:bg-[#095fb8] transition-colors"
              >
                <Linkedin size={20} />
                <span className="sr-only">Share on LinkedIn</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
