import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getGameById, getAllGameIds } from '@/lib/games';
import { EmbedClient } from './embed-client';

// Import all game components
import TcpVsUdpSimulator from '@/components/games/tcp-vs-udp';
import DnsSimulator from '@/components/games/dns-simulator';
import LoadBalancerSimulator from '@/components/games/load-balancer-simulator';
import ScalingSimulator from '@/components/games/scaling-simulator';
import MicroservicesSimulator from '@/components/games/microservices-simulator';
import CachingSimulator from '@/components/games/caching-simulator';
import DbIndexingSimulator from '@/components/games/db-indexing-simulator';
import DbmsSimulator from '@/components/games/dbms-simulator';
import RateLimitSimulator from '@/components/games/rate-limit-simulator';
import K8sScheduler from '@/components/games/k8s-scheduler';
import LinuxTerminal from '@/components/games/linux-terminal';
import PacketJourney from '@/components/games/packet-journey';
import DeploymentStrategies from '@/components/games/deployment-strategies-simulator';
import GitOpsWorkflow from '@/components/games/gitops-workflow';
import CicdStackGenerator from '@/components/games/cicd-stack-generator';
import DdosSimulator from '@/components/games/ddos-simulator';
import AwsVpcSimulator from '@/components/games/aws-vpc-simulator';
import RestVsGraphql from '@/components/games/rest-vs-graphql-simulator';
import BugHunter from '@/components/games/bug-hunter';
import UptimeDefender from '@/components/games/uptime-defender';
import ScalableSentry from '@/components/games/scalable-sentry';
import GitQuiz from '@/components/games/git-command-quiz';
import DevOpsScorecard from '@/components/games/devops-scorecard';
import CardsAgainstDevOps from '@/components/games/cards-against-devops';
import InfraTarot from '@/components/games/infra-tarot';
import DevOpsMemes from '@/components/games/devops-memes';
import BCDRSimulator from '@/components/games/bcdr-simulator';
import SslTlsHandshakeSimulator from '@/components/games/ssl-tls-handshake-simulator';

// Map of game slugs to their components
const GAME_COMPONENTS: Record<string, React.ComponentType> = {
  'tcp-vs-udp': TcpVsUdpSimulator,
  'dns-simulator': DnsSimulator,
  'load-balancer-simulator': LoadBalancerSimulator,
  'scaling-simulator': ScalingSimulator,
  'microservices-simulator': MicroservicesSimulator,
  'caching-simulator': CachingSimulator,
  'db-indexing-simulator': DbIndexingSimulator,
  'dbms-simulator': DbmsSimulator,
  'rate-limit-simulator': RateLimitSimulator,
  'k8s-scheduler': K8sScheduler,
  'linux-terminal': LinuxTerminal,
  'packet-journey': PacketJourney,
  'deployment-strategies': DeploymentStrategies,
  'gitops-workflow': GitOpsWorkflow,
  'cicd-stack-generator': CicdStackGenerator,
  'ddos-simulator': DdosSimulator,
  'aws-vpc-simulator': AwsVpcSimulator,
  'rest-vs-graphql': RestVsGraphql,
  'bug-hunter': BugHunter,
  'uptime-defender': UptimeDefender,
  'scalable-sentry': ScalableSentry,
  'git-quiz': GitQuiz,
  'devops-scorecard': DevOpsScorecard,
  'cards-against-devops': CardsAgainstDevOps,
  'infra-tarot': InfraTarot,
  'devops-memes': DevOpsMemes,
  'bcdr-simulator': BCDRSimulator,
  'ssl-tls-handshake': SslTlsHandshakeSimulator,
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const gameIds = await getAllGameIds();
  return gameIds.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameById(slug);

  if (!game) {
    return { title: 'Game Not Found' };
  }

  return {
    title: `${game.title} - Embed`,
    description: game.description,
    robots: { index: false, follow: false },
  };
}

export default async function EmbedGamePage({ params }: PageProps) {
  const { slug } = await params;

  const game = await getGameById(slug);
  const GameComponent = GAME_COMPONENTS[slug];

  if (!game || !GameComponent) {
    notFound();
  }

  return <EmbedClient slug={slug} title={game.title} GameComponent={GameComponent} />;
}
