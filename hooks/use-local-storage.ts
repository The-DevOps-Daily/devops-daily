'use client';

import { useEffect, useRef, useState } from 'react';

const SYNC_EVENT = 'local-storage-sync';

/**
 * useState persisted to localStorage as JSON. The saved value is loaded in an
 * effect after mount (not during render) so server HTML and the first client
 * render stay identical; writes only start once the load for the current key
 * has finished, so the initial value never clobbers stored data. Instances
 * with the same key on one page stay in sync. Call sites with event-driven
 * saves or multi-field blobs (command palette, exercise progress) keep their
 * bespoke handling.
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  // The JSON last read or written, so a sync never echoes back as a new write.
  const lastJson = useRef<string | null>(null);

  useEffect(() => {
    const load = () => {
      try {
        const saved = window.localStorage.getItem(key);
        if (saved !== null && saved !== lastJson.current) {
          lastJson.current = saved;
          setValue(JSON.parse(saved));
        }
      } catch {
        // Unreadable storage (private mode, corrupted JSON): keep the current value
      }
    };
    load();
    setLoadedKey(key);

    const onSync = (event: Event) => {
      if ((event as CustomEvent<string>).detail === key) load();
    };
    window.addEventListener(SYNC_EVENT, onSync);
    return () => window.removeEventListener(SYNC_EVENT, onSync);
  }, [key]);

  useEffect(() => {
    if (loadedKey !== key) return;
    try {
      const json = JSON.stringify(value);
      if (json === lastJson.current) return;
      lastJson.current = json;
      window.localStorage.setItem(key, json);
      window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: key }));
    } catch {
      // Storage full or unavailable: state still works for this session
    }
  }, [key, value, loadedKey]);

  return [value, setValue] as const;
}
