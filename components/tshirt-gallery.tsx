'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import type { TshirtDesign } from '@/lib/tshirts';

type Variant = 'light' | 'dark';

export function TshirtGallery({ designs }: { designs: TshirtDesign[] }) {
  const [active, setActive] = useState<TshirtDesign | null>(null);
  const [variant, setVariant] = useState<Variant>('light');

  const close = useCallback(() => setActive(null), []);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [active, close]);

  const open = (d: TshirtDesign) => {
    setVariant('light');
    setActive(d);
  };

  const img = active ? (variant === 'light' ? active.png : active.pngDark) : '';
  const svg = active ? (variant === 'light' ? active.svg : active.svgDark) : '';
  const png = active ? (variant === 'light' ? active.png : active.pngDark) : '';

  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {designs.map((d) => (
          <div
            key={d.slug}
            className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/40"
          >
            <button
              type="button"
              onClick={() => open(d)}
              className="flex aspect-[4/5] items-center justify-center bg-[#f8fafc] p-6 transition-opacity hover:opacity-90"
              aria-label={`View ${d.title} larger`}
            >
              <img src={d.png} alt={d.title} loading="lazy" className="max-h-full max-w-full object-contain" />
            </button>
            <div className="flex items-center justify-between gap-2 border-t border-border p-3">
              <button
                type="button"
                onClick={() => open(d)}
                className="truncate text-left text-sm font-medium hover:text-primary"
                title={d.title}
              >
                {d.title}
              </button>
              <div className="flex shrink-0 gap-1.5">
                <a
                  href={d.svg}
                  download
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <Download className="h-3 w-3" /> SVG
                </a>
                <a
                  href={d.png}
                  download
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <Download className="h-3 w-3" /> PNG
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={active.title}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border p-4">
              <h2 className="truncate text-base font-semibold">{active.title}</h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              className="flex flex-1 items-center justify-center overflow-auto p-6"
              style={{ backgroundColor: variant === 'light' ? '#f8fafc' : '#0f172a' }}
            >
              <img src={img} alt={active.title} className="max-h-[55vh] max-w-full object-contain" />
            </div>

            <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex rounded-lg border border-border p-0.5 text-sm">
                <button
                  type="button"
                  onClick={() => setVariant('light')}
                  className={`rounded-md px-3 py-1.5 transition-colors ${variant === 'light' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Light shirt
                </button>
                <button
                  type="button"
                  onClick={() => setVariant('dark')}
                  className={`rounded-md px-3 py-1.5 transition-colors ${variant === 'dark' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Dark shirt
                </button>
              </div>
              <div className="flex gap-2">
                <a
                  href={svg}
                  download
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-primary/40"
                >
                  <Download className="h-4 w-4" /> SVG
                </a>
                <a
                  href={png}
                  download
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Download className="h-4 w-4" /> PNG
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
