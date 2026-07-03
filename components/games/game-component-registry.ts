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
import DockerTerminalSimulator from '@/components/games/docker-terminal-simulator';
import ForkBombSimulator from '@/components/games/fork-bomb-simulator';
import GitQuiz from '@/components/games/git-command-quiz';
import GitConceptsSimulator from '@/components/games/git-concepts-simulator';
import GitOpsWorkflow from '@/components/games/gitops-workflow';
import InfraTarot from '@/components/games/infra-tarot';
import JavascriptPromisesAsyncSimulator from '@/components/games/javascript-promises-async-simulator';
import K8sScheduler from '@/components/games/k8s-scheduler';
import KubernetesNetworkingCniSimulator from '@/components/games/kubernetes-networking-cni-simulator';
import KubernetesTerminalSimulator from '@/components/games/kubernetes-terminal-simulator';
import LatencyPercentilesSimulator from '@/components/games/latency-percentiles-simulator';
import LinuxTerminal from '@/components/games/linux-terminal';
import LoadBalancerSimulator from '@/components/games/load-balancer-simulator';
import MessageQueueSimulator from '@/components/games/message-queue-simulator';
import MicroservicesSimulator from '@/components/games/microservices-simulator';
import OAuthOidcFlowSimulator from '@/components/games/oauth-oidc-flow-simulator';
import PacketJourney from '@/components/games/packet-journey';
import PostgresTerminalSimulator from '@/components/games/postgres-terminal-simulator';
import PostgresWireProtocolSimulator from '@/components/games/postgres-wire-protocol-simulator';
import PromqlPlayground from '@/components/games/promql-playground';
import RateLimitSimulator from '@/components/games/rate-limit-simulator';
import RestVsGraphql from '@/components/games/rest-vs-graphql-simulator';
import ScalableSentry from '@/components/games/scalable-sentry';
import ScalingSimulator from '@/components/games/scaling-simulator';
import ServiceMeshSimulator from '@/components/games/service-mesh-simulator';
import SmtpFlowSimulator from '@/components/games/smtp-flow-simulator';
import SqlTerminalSimulator from '@/components/games/sql-terminal-simulator';
import SslTlsHandshakeSimulator from '@/components/games/ssl-tls-handshake-simulator';
import TcpVsUdpSimulator from '@/components/games/tcp-vs-udp';
import TerraformTerminalSimulator from '@/components/games/terraform-terminal-simulator';
import UptimeDefender from '@/components/games/uptime-defender';

export const GAME_COMPONENTS: Record<string, ComponentType> = {
  'tcp-vs-udp': TcpVsUdpSimulator,
  'dns-simulator': DnsSimulator,
  'docker-terminal-simulator': DockerTerminalSimulator,
  'kubernetes-terminal-simulator': KubernetesTerminalSimulator,
  'terraform-terminal-simulator': TerraformTerminalSimulator,
  'latency-percentiles-simulator': LatencyPercentilesSimulator,
  'kubernetes-networking-cni-simulator': KubernetesNetworkingCniSimulator,
  'javascript-promises-async-await-simulator': JavascriptPromisesAsyncSimulator,
  'git-concepts-simulator': GitConceptsSimulator,
  'load-balancer-simulator': LoadBalancerSimulator,
  'message-queue-simulator': MessageQueueSimulator,
  'oauth-oidc-flow-simulator': OAuthOidcFlowSimulator,
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
  'postgres-wire-protocol': PostgresWireProtocolSimulator,
  'sql-terminal-simulator': SqlTerminalSimulator,
  'postgres-terminal-simulator': PostgresTerminalSimulator,
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
  'smtp-flow-simulator': SmtpFlowSimulator,
  'fork-bomb-simulator': ForkBombSimulator,
};

export function getGameComponent(slug: string): ComponentType | undefined {
  return GAME_COMPONENTS[slug];
}
