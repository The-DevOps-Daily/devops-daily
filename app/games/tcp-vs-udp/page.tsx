import type { Metadata } from 'next';
import TcpVsUdpSimulator from '@/components/games/tcp-vs-udp';
import { generateGameMetadata } from '@/lib/game-metadata';

export async function generateMetadata(): Promise<Metadata> {
  return generateGameMetadata('tcp-vs-udp');
}

export default function TcpVsUdpPage() {
  return <TcpVsUdpSimulator />;
}
