'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Keyboard, Command } from 'lucide-react';

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Global',
    shortcuts: [
      { keys: ['⌘/Ctrl', 'K'], description: 'Open search' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close modal / dialog' },
      { keys: ['/'], description: 'Focus search (when not in input)' },
    ],
  },
  {
    title: 'Quizzes',
    shortcuts: [
      { keys: ['1-4'], description: 'Select answer option' },
      { keys: ['Enter'], description: 'Submit selected answer' },
      { keys: ['N'], description: 'Next question' },
      { keys: ['H'], description: 'Toggle hint' },
      { keys: ['R'], description: 'Restart quiz' },
    ],
  },
  {
    title: 'Games',
    shortcuts: [
      { keys: ['Space'], description: 'Start / Pause' },
      { keys: ['R'], description: 'Reset game' },
      { keys: ['→'], description: 'Next step (step-by-step games)' },
      { keys: ['←'], description: 'Previous step' },
      { keys: ['Esc'], description: 'Exit / Reset' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Tab'], description: 'Move to next focusable element' },
      { keys: ['Shift', 'Tab'], description: 'Move to previous element' },
      { keys: ['Enter'], description: 'Activate focused element' },
    ],
  },
];

export function KeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger if user is typing in an input
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }

    // "?" or Shift+/ to open shortcuts help
    if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
      e.preventDefault();
      setIsOpen(true);
    }

    // Escape to close
    if (e.key === 'Escape' && isOpen) {
      setIsOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these keyboard shortcuts to navigate the site more efficiently.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <span key={keyIdx} className="flex items-center">
                          <kbd className="px-2 py-1 text-xs font-semibold bg-muted border border-border rounded">
                            {key}
                          </kbd>
                          {keyIdx < shortcut.keys.length - 1 && (
                            <span className="mx-1 text-muted-foreground">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground text-center border-t pt-4">
          Press <kbd className="px-1.5 py-0.5 bg-muted border rounded">?</kbd> anytime to show this help
        </div>
      </DialogContent>
    </Dialog>
  );
}
