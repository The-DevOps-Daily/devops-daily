import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Keep the site's buttons, with wrapping labels at enlarged text sizes. */
export function comicButtonClasses(options?: Parameters<typeof buttonVariants>[0]) {
  return cn(
    buttonVariants(options),
    'whitespace-normal h-auto min-h-10 max-w-full py-2 [overflow-wrap:anywhere]'
  );
}
