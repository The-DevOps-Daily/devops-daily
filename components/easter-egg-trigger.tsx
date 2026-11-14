'use client';

import { Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EasterEggTrigger({
  variant,
  onClick,
}: {
  variant: 'icon' | 'text';
  onClick: () => void;
}) {
  return variant === 'icon' ? (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="relative group"
      aria-label="Open terminal"
    >
      <Terminal className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
      <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
    </Button>
  ) : (
    <button
      onClick={onClick}
      className="text-xs text-muted-foreground hover:text-primary transition-colors font-mono group inline-flex items-center gap-1"
      aria-label="Open terminal"
    >
      <Terminal className="w-3 h-3 opacity-50 group-hover:opacity-100" />
      <span className="opacity-50 group-hover:opacity-100">~$</span>
    </button>
  );
}
