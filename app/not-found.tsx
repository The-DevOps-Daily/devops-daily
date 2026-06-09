import type { Metadata } from 'next';
import { NotFoundClient } from '@/components/not-found-client';

// The 404 UI needs window.location, so it lives in a client component; this
// server wrapper exists to give the page its own title instead of the
// layout's homepage default.
export const metadata: Metadata = {
  title: 'Page Not Found',
};

export default function NotFound() {
  return <NotFoundClient />;
}
