import {
  CertificateViewPage,
  certificateViewMetadata,
} from '@/components/advent-certificate/pages';

export const metadata = certificateViewMetadata('postgres');

export default function Page() {
  return <CertificateViewPage adventKey="postgres" />;
}
