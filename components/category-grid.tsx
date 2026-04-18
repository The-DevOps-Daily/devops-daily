import Link from 'next/link';
import { cn } from '@/lib/utils';
import { SectionHeader } from '@/components/section-header';
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

  const gridClasses = cn(
    'grid gap-px sm:grid-cols-2 lg:grid-cols-3 bg-border border rounded-md overflow-hidden',
    gridClassName
  );

  return (
    <section className={cn('', className)}>
      {showHeader && (
        <SectionHeader
          label="categories"
          title={title}
          description={description}
          viewAllHref={showViewAll ? '/categories' : undefined}
          viewAllLabel="Browse all"
        />
      )}
      <div className={gridClasses}>
        {displayCategories.map((category) => {
          const IconComponent = (category.icon && iconComponents[category.icon]) || Terminal;

          return (
            <Link
              key={category.slug}
              href={`/categories/${category.slug}`}
              className="group flex flex-col bg-card p-5 transition-colors hover:bg-muted/40"
            >
              <IconComponent
                className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors mb-3"
                strokeWidth={1.5}
              />
              <h3 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors">
                {category.name}
              </h3>
              {category.description && (
                <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2">
                  {category.description}
                </p>
              )}
              <div className="mt-3 text-[11px] font-mono tabular-nums text-muted-foreground/80">
                {category.count} {category.count === 1 ? 'item' : 'items'}
              </div>
            </Link>
          );
        })}

        {displayCategories.length === 0 && (
          <div className="py-12 text-center col-span-full bg-card">
            <p className="text-muted-foreground">No categories with content yet.</p>
          </div>
        )}
      </div>
    </section>
  );
}
