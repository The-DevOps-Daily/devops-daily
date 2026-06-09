'use client';

import { useEffect, useState } from 'react';

/**
 * useState persisted to localStorage as JSON. The saved value is loaded in an
 * effect after mount (not during render) so server HTML and the first client
 * render stay identical; writes only start once the load for the current key
 * has finished, so the initial value never clobbers stored data. Call sites
 * with event-driven saves or multi-field blobs (command palette, exercise
 * progress) keep their bespoke handling.
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key);
      if (saved !== null) {
        setValue(JSON.parse(saved));
      }
    } catch {
      // Unreadable storage (private mode, corrupted JSON): keep the initial value
    }
    setLoadedKey(key);
  }, [key]);

  useEffect(() => {
    if (loadedKey !== key) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable: state still works for this session
    }
  }, [key, value, loadedKey]);

  return [value, setValue] as const;
}
