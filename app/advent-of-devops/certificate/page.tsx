import { CertificatePage, certificatePageMetadata } from '@/components/advent-certificate/pages';

export const metadata = certificatePageMetadata('devops');

export default function Page() {
  return <CertificatePage adventKey="devops" />;
}
