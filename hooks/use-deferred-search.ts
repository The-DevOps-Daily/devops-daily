'use client';

import { useDeferredValue, useEffect, useRef, useState } from 'react';

/**
 * Search-box state shared by the content list components (posts, exercises,
 * games). useDeferredValue keeps the <input> updating at full priority while
 * the expensive filter pass over the list runs as a lower-priority render;
 * without it every keystroke blocked paint long enough to tip INP over 200ms
 * on mid-range mobile devices. Pass { focusShortcut: true } to focus the
 * returned input ref on Cmd+K / Ctrl+K.
 */
export function useDeferredSearch({ focusShortcut = false }: { focusShortcut?: boolean } = {}) {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    if (!focusShortcut) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusShortcut]);

  return { searchQuery, setSearchQuery, deferredSearchQuery, searchInputRef };
}
