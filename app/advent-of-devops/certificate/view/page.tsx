import {
  CertificateViewPage,
  certificateViewMetadata,
} from '@/components/advent-certificate/pages';

export const metadata = certificateViewMetadata('devops');

export default function Page() {
  return <CertificateViewPage adventKey="devops" />;
}
