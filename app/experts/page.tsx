import Image from 'next/image';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { getAllExperts, getAllSpecialties } from '@/lib/experts';
import { Breadcrumb } from '@/components/breadcrumb';
import { BreadcrumbSchema } from '@/components/schema-markup';
import { Badge } from '@/components/ui/badge';
import { Mail, MapPin, DollarSign } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hire an Expert',
  description: 'Find experienced DevOps engineers, cloud architects, and infrastructure specialists for your project',
  alternates: {
    canonical: '/experts',
  },
  openGraph: {
    title: 'Hire DevOps Experts - Professional Consulting',
    description: 'Connect with experienced DevOps professionals for consulting, training, and implementation services.',
    type: 'website',
    url: '/experts',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Hire DevOps Experts',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hire DevOps Experts - Professional Consulting',
    description: 'Connect with experienced DevOps professionals for consulting, training, and implementation services.',
    images: ['/og-image.png'],
  },
};

export default async function ExpertsPage() {
  const experts = await getAllExperts();
  const allSpecialties = getAllSpecialties(experts);

  // Breadcrumb items
  const breadcrumbItems = [{ label: 'Experts', href: '/experts', isCurrent: true }];

  // Breadcrumb items for schema
  const schemaItems = [
    { name: 'Home', url: '/' },
    { name: 'Experts', url: '/experts' },
  ];

  return (
    <>
      <BreadcrumbSchema items={schemaItems} />

      <div className="container mx-auto px-4 py-8">
        <Breadcrumb items={breadcrumbItems} />

        <PageHeader
          title="Hire an Expert"
          description="Find experienced DevOps professionals for consulting, training, and implementation"
        />

        {allSpecialties.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Specialties:</h3>
            <div className="flex flex-wrap gap-2">
              {allSpecialties.map((specialty) => (
                <Badge key={specialty} variant="outline">
                  {specialty}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 my-8">
          {experts.map((expert) => (
            <Link
              key={expert.slug}
              href={`/experts/${expert.slug}`}
              className="group flex flex-col p-6 bg-card rounded-lg border border-border hover:border-primary/50 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-primary/20 group-hover:border-primary/40 transition-colors bg-muted flex-shrink-0">
                  {expert.avatar ? (
                    <Image src={expert.avatar} alt={expert.name} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-2xl font-bold text-muted-foreground">
                        {expert.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold group-hover:text-primary transition-colors">
                    {expert.name}
                  </h2>
                  {expert.title && (
                    <p className="text-sm text-muted-foreground mt-1">{expert.title}</p>
                  )}
                </div>
              </div>

              {expert.bio && (
                <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{expert.bio}</p>
              )}

              {expert.specialties && expert.specialties.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {expert.specialties.slice(0, 4).map((specialty) => (
                    <Badge key={specialty} variant="secondary" className="text-xs">
                      {specialty}
                    </Badge>
                  ))}
                  {expert.specialties.length > 4 && (
                    <Badge variant="secondary" className="text-xs">
                      +{expert.specialties.length - 4} more
                    </Badge>
                  )}
                </div>
              )}

              <div className="mt-auto space-y-2 text-sm text-muted-foreground">
                {expert.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{expert.location}</span>
                  </div>
                )}
                {expert.rate && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    <span>{expert.rate}</span>
                  </div>
                )}
                {expert.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{expert.email}</span>
                  </div>
                )}
              </div>

              {expert.availability && (
                <div className="mt-4 pt-4 border-t border-border">
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400">
                    {expert.availability}
                  </Badge>
                </div>
              )}
            </Link>
          ))}
        </div>

        {experts.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No experts available at the moment. Check back soon!</p>
          </div>
        )}
      </div>
    </>
  );
}
