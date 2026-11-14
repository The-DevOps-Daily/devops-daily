import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  className?: string;
}

export function PageHeader({ title, description, className }: PageHeaderProps) {
  return (
    <div className={cn('text-center py-8', className)}>
      <h1 className="text-4xl font-bold tracking-tight break-words">{title}</h1>
      {description && (
        <p className="mt-4 text-xl text-muted-foreground max-w-2xl mx-auto">{description}</p>
      )}
    </div>
  );
}
