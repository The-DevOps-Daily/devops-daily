import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Cloud,
  Container,
  Code,
  Database,
  DollarSign,
  GitBranch,
  Server,
  Layers,
  Lock,
  Network,
  Shield,
  Terminal,
  Workflow,
  LucideIcon,
  SquareTerminal,
  ShipWheel,
  Infinity,
} from 'lucide-react';
import { getAllCategories } from '@/lib/categories';
import type { Category } from '@/lib/categories';

// Full list of icons: https://lucide.dev/icons
// Icon mapping
const iconComponents: Record<string, LucideIcon> = {
  Container,
  Code,
  Layers,
  Server,
  Database,
  DollarSign,
  Workflow,
  Cloud,
  GitBranch,
  Lock,
  Network,
  Shield,
  Terminal,
  SquareTerminal,
  ShipWheel,
  Infinity,
};

interface CategoryGridProps {
  /**
   * Categories to display. If not provided, they will be fetched.
   */
  categories?: Category[];
  className?: string;
  /**
   * Limit the number of categories displayed.
   */
  limit?: number;
  /**
   * When true a heading and description will be rendered.
   */
  showHeader?: boolean;
  /**
   * Title to show when `showHeader` is enabled.
   */
  title?: string;
  /**
   * Description to show when `showHeader` is enabled.
   */
  description?: string;
  /**
   * Show a "View All" button linking to /categories.
   */
  showViewAll?: boolean;
  /**
   * Custom grid class for layout of the cards.
   */
  gridClassName?: string;
}

export async function CategoryGrid({
  categories,
  className,
  limit,
  showHeader = false,
  title = 'Popular Categories',
  description = 'Explore our content by topic',
  showViewAll = false,
  gridClassName,
}: CategoryGridProps) {
  // Get categories if not provided
  const fetchedCategories = categories ?? (await getAllCategories());
  const categoriesWithContent = fetchedCategories.filter((category) => category.count > 0);
  const displayCategories =
    typeof limit === 'number' ? categoriesWithContent.slice(0, limit) : categoriesWithContent;

  const gridClasses = cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6', gridClassName);

  return (
    <section className={cn('', className)}>
      {showHeader && (
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
          {description && <p className="mt-4 text-lg text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className={gridClasses}>
        {displayCategories.map((category) => {
          // Get the icon component
          const IconComponent = (category.icon && iconComponents[category.icon]) || Terminal;

          return (
            <Link
              key={category.slug}
              href={`/categories/${category.slug}`}
              className="flex flex-col items-center p-6 transition-all border rounded-lg group bg-card border-border hover:border-primary/50 hover:shadow-md"
            >
              <div className={cn('p-3 rounded-full', category.color || 'bg-muted')}>
                <IconComponent className="w-6 h-6" />
              </div>
              <h3 className="mt-4 font-semibold">{category.name}</h3>
              <p className="mt-1 text-sm text-center text-muted-foreground">
                {category.description}
              </p>
              <div className="mt-4 text-sm text-muted-foreground">
                {category.count} {category.count === 1 ? 'item' : 'items'}
              </div>
            </Link>
          );
        })}

        {displayCategories.length === 0 && (
          <div className="py-12 text-center col-span-full">
            <p className="text-muted-foreground">No categories with content yet.</p>
          </div>
        )}
      </div>
      {showViewAll && (
        <div className="mt-10 text-center">
          <Button asChild variant="outline">
            <Link href="/categories">View All Categories</Link>
          </Button>
        </div>
      )}
    </section>
  );
}
