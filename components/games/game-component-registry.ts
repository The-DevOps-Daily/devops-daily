import type { ComponentType } from 'react';
import AwsVpcSimulator from '@/components/games/aws-vpc-simulator';
import BCDRSimulator from '@/components/games/bcdr-simulator';
import BugHunter from '@/components/games/bug-hunter';
import CachingSimulator from '@/components/games/caching-simulator';
import CardsAgainstDevOps from '@/components/games/cards-against-devops';
import CicdStackGenerator from '@/components/games/cicd-stack-generator';
import DatabaseReplicationShardingScaling from '@/components/games/database-replication-sharding-scaling';
import DbIndexingSimulator from '@/components/games/db-indexing-simulator';
import DbmsSimulator from '@/components/games/dbms-simulator';
import DdosSimulator from '@/components/games/ddos-simulator';
import DeploymentStrategies from '@/components/games/deployment-strategies-simulator';
import DevOpsMemes from '@/components/games/devops-memes';
import DevOpsScorecard from '@/components/games/devops-scorecard';
import DnsSimulator from '@/components/games/dns-simulator';
import ForkBombSimulator from '@/components/games/fork-bomb-simulator';
import GitQuiz from '@/components/games/git-command-quiz';
import GitOpsWorkflow from '@/components/games/gitops-workflow';
import InfraTarot from '@/components/games/infra-tarot';
import K8sScheduler from '@/components/games/k8s-scheduler';
import LinuxTerminal from '@/components/games/linux-terminal';
import LoadBalancerSimulator from '@/components/games/load-balancer-simulator';
import MicroservicesSimulator from '@/components/games/microservices-simulator';
import PacketJourney from '@/components/games/packet-journey';
import PromqlPlayground from '@/components/games/promql-playground';
import RateLimitSimulator from '@/components/games/rate-limit-simulator';
import RestVsGraphql from '@/components/games/rest-vs-graphql-simulator';
import ScalableSentry from '@/components/games/scalable-sentry';
import ScalingSimulator from '@/components/games/scaling-simulator';
import ServiceMeshSimulator from '@/components/games/service-mesh-simulator';
import SslTlsHandshakeSimulator from '@/components/games/ssl-tls-handshake-simulator';
import TcpVsUdpSimulator from '@/components/games/tcp-vs-udp';
import UptimeDefender from '@/components/games/uptime-defender';

export const GAME_COMPONENTS: Record<string, ComponentType> = {
  'tcp-vs-udp': TcpVsUdpSimulator,
  'dns-simulator': DnsSimulator,
  'load-balancer-simulator': LoadBalancerSimulator,
  'scaling-simulator': ScalingSimulator,
  'microservices-simulator': MicroservicesSimulator,
  'caching-simulator': CachingSimulator,
  'db-indexing-simulator': DbIndexingSimulator,
  'database-replication-sharding-scaling': DatabaseReplicationShardingScaling,
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
  'promql-playground': PromqlPlayground,
  'service-mesh-simulator': ServiceMeshSimulator,
  'fork-bomb-simulator': ForkBombSimulator,
};

export function getGameComponent(slug: string): ComponentType | undefined {
  return GAME_COMPONENTS[slug];
}
