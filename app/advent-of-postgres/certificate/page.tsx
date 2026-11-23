import { CertificatePage, certificatePageMetadata } from '@/components/advent-certificate/pages';

export const metadata = certificatePageMetadata('postgres');

export default function Page() {
  return <CertificatePage adventKey="postgres" />;
}
