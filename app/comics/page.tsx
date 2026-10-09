import { BookOpen } from 'lucide-react';
import { PageHero } from '@/components/page-hero';
import { SeriesCard } from '@/components/comics/series-card';
import { comicMetadata } from '@/lib/comic-metadata';

export const metadata = comicMetadata(
  'DevOps Comics',
  'Illustrated stories about engineering life. Meet the ShipIt team in git blame, a DevOps Daily original comic series.',
  '/comics',
  '/comics/og/library.png'
);

export default function ComicsPage() {
  return (
    <div>
      <div className="[&_*]:animate-none">
        <PageHero
          title="DevOps Comics"
          accentWord="Comics"
          description="The deployments, incidents and small victories of life in engineering. Pull up a chair. There’s a story here for you."
          icon={BookOpen}
          breadcrumbs={[{ label: 'Comics' }]}
          badge="Illustrated stories"
        />
      </div>
      <section
        className="container mx-auto px-4 py-10 sm:py-16 max-w-6xl"
        aria-label="Comic series"
      >
        <SeriesCard />
      </section>
    </div>
  );
}
