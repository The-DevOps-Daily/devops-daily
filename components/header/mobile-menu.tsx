'use client';

import { memo, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';
import { X, ExternalLink } from 'lucide-react';
import { mainNavigation, dropdownNavigation } from './nav-items';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

// Opening the menu only flips CSS classes: the links are rendered while the page
// is idle and are memoized, so a tap does not mount or re-render ~40 links.
// Toggling `inert` restyles every element in the menu, so it never happens in
// the tap itself: it is removed after the opened menu has painted, and set,
// with aria-hidden, once the 200 ms slide-out has ended. Until then the
// closing panel is still visible and so stays focusable and announced.
const CLOSE_MS = 200;

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const [closed, setClosed] = useState(!isOpen);

  useEffect(() => {
    let frame = 0;
    let timer = 0;
    if (isOpen) {
      frame = requestAnimationFrame(() => {
        timer = window.setTimeout(() => setClosed(false), 0);
      });
    } else {
      timer = window.setTimeout(() => setClosed(true), CLOSE_MS);
    }
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [isOpen]);

  return (
    <div className="lg:hidden" aria-hidden={!isOpen && closed} inert={closed}>
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/40 transition-[opacity,visibility] duration-200 motion-reduce:transition-none',
          isOpen ? 'visible opacity-100' : 'pointer-events-none invisible opacity-0'
        )}
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Main menu"
        className={cn(
          'fixed inset-y-0 right-0 z-[60] w-full px-6 py-6 bg-background border-l shadow-xl sm:max-w-sm border-border/80 overflow-y-auto will-change-transform transition-[transform,visibility] duration-200 ease-out motion-reduce:transition-none',
          isOpen ? 'visible translate-x-0' : 'invisible translate-x-full'
        )}
      >
        <MenuContent onClose={onClose} />
      </div>
    </div>
  );
}

const MenuContent = memo(function MenuContent({ onClose }: { onClose: () => void }) {
  return (
    <>
      {/* Mobile menu header */}
      <div className="flex items-center justify-between mb-8">
        <Logo size={50} href="/" showText />
        <Button variant="ghost" size="sm" onClick={onClose} className="p-2">
          <span className="sr-only">Close menu</span>
          <X className="w-5 h-5" aria-hidden="true" />
        </Button>
      </div>

      {/* Mobile menu content */}
      <div className="flow-root">
        <div className="space-y-6">
          {/* Main Navigation */}
          <div className="space-y-3">
            <h3 className="px-3 mb-4 text-sm font-bold tracking-wide uppercase text-muted-foreground">
              Main
            </h3>
            {mainNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                className="flex items-center gap-4 px-4 text-base font-semibold leading-7 transition-all duration-300 border border-transparent rounded-2xl hover:bg-linear-to-r hover:from-primary/10 hover:to-purple-500/10 hover:shadow-md hover:border-primary/20"
                onClick={onClose}
              >
                <div className="p-3 border rounded-2xl bg-linear-to-br from-primary/15 to-purple-500/15 border-primary/20">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="px-1.5 py-0.5 bg-primary/10 border border-primary/20 text-primary text-[10px] font-mono tabular-nums rounded">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Tools Section */}
          <div className="space-y-3">
            <h3 className="px-3 mb-4 text-sm font-bold tracking-wide uppercase text-muted-foreground">
              Tools
            </h3>
            {dropdownNavigation.tools.flatMap((section) =>
              section.items.map((item, index) => (
                <Link
                  key={index + item.href}
                  href={item.href}
                  className="flex items-center gap-4 px-4 text-base font-semibold leading-7 transition-all duration-300 border border-transparent rounded-2xl hover:bg-linear-to-r hover:from-primary/10 hover:to-purple-500/10 hover:shadow-md hover:border-primary/20"
                  onClick={onClose}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noopener noreferrer' : undefined}
                >
                  <div
                    className={cn(
                      'p-3 rounded-2xl border',
                      item.featured
                        ? 'bg-linear-to-br from-primary/20 to-purple-500/20 border-primary/30'
                        : 'bg-linear-to-br from-muted to-muted/50 border-border/50'
                    )}
                  >
                    {item.icon && (
                      <item.icon
                        className={cn(
                          'w-6 h-6',
                          item.featured ? 'text-primary' : 'text-muted-foreground'
                        )}
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="px-3 py-1 text-xs font-bold text-white rounded-full bg-linear-to-r from-primary to-purple-600">
                          {item.badge}
                        </span>
                      )}
                      {item.external && <ExternalLink className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    {item.description && (
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* More Section */}
          <div className="space-y-3">
            <h3 className="px-3 mb-4 text-sm font-bold tracking-wide uppercase text-muted-foreground">
              More
            </h3>
            {dropdownNavigation.more.flatMap((section) =>
              section.items.map((item, index) => (
                <Link
                  key={index + item.href}
                  href={item.href}
                  className="flex items-center gap-4 px-4 text-base font-semibold leading-7 transition-all duration-300 border border-transparent rounded-2xl hover:bg-linear-to-r hover:from-primary/10 hover:to-purple-500/10 hover:shadow-md hover:border-primary/20"
                  onClick={onClose}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noopener noreferrer' : undefined}
                >
                  <div
                    className={cn(
                      'p-3 rounded-2xl border',
                      item.featured
                        ? 'bg-linear-to-br from-primary/20 to-purple-500/20 border-primary/30'
                        : 'bg-linear-to-br from-muted to-muted/50 border-border/50'
                    )}
                  >
                    {item.icon && (
                      <item.icon
                        className={cn(
                          'w-6 h-6',
                          item.featured ? 'text-primary' : 'text-muted-foreground'
                        )}
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="px-3 py-1 text-xs font-bold text-white rounded-full bg-linear-to-r from-primary to-purple-600">
                          {item.badge}
                        </span>
                      )}
                      {item.external && <ExternalLink className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    {item.description && (
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Theme toggle */}
          <div className="pt-8 border-t border-border/50">
            <div className="px-3">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </>
  );
});
