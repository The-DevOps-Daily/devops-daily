'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Search } from 'lucide-react';

// The dialog (cmdk and Radix) loads on first open, or while idle on desktop.
const loadDialog = () => import('./command-palette-dialog').then((m) => m.CommandPaletteDialog);
const CommandPaletteDialog = dynamic(loadDialog, { ssr: false });

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  // Mounted on first open and kept, so the index and recent searches stay loaded.
  const [used, setUsed] = useState(false);
  const show = () => {
    setUsed(true);
    setOpen(true);
  };

  useEffect(() => {
    if (!window.matchMedia('(min-width: 1024px)').matches) return;
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 2000));
    idle(() => void loadDialog());
  }, []);

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setUsed(true);
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={show}
        className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground bg-muted/50 hover:bg-muted rounded-lg transition-colors border border-border/50 hover:border-border"
      >
        <Search className="w-4 h-4" />
        <span>Search...</span>
        <kbd className="hidden md:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-xs font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Mobile trigger */}
      <button
        onClick={show}
        className="sm:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Search"
      >
        <Search className="w-5 h-5" />
      </button>

      {used && <CommandPaletteDialog open={open} setOpen={setOpen} />}
    </>
  );
}
