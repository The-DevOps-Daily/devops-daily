'use client';

import { useEffect, useState } from 'react';

/**
 * React state that reads its initial value from a URL query parameter and
 * writes back to the URL (via history.replaceState) on every change.
 * No server round-trip, no pushState, no polluting the history stack.
 * Skips both the initial read and writes during SSR.
 */
export function useUrlState(
  key: string,
  defaultValue: string,
): [string, (next: string) => void] {
  const [value, setValue] = useState<string>(defaultValue);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const v = params.get(key);
    if (v !== null) setValue(v);
    // Only run on mount; subsequent URL changes don't need to override local state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (value === defaultValue) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const query = params.toString();
    const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', newUrl);
  }, [key, value, defaultValue]);

  return [value, setValue];
}
