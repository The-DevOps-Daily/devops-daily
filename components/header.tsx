'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';
import { Menu, Search } from 'lucide-react';
import { DesktopNavigation } from './header/desktop-navigation';
import { MobileMenu } from './header/mobile-menu';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  // On a simulator page the header scrolls away with the page instead of sticking,
  // so it never covers or shifts the game.
  const onSimulator = /^\/games\/[^/]+/.test(pathname ?? '');

  // Sticky elements below the header read its height from --site-header-h.
  // --site-header-visible is the part of the header on screen: on a simulator
  // page it shrinks to 0 as the header scrolls away, and the simulator stage
  // (components/games/sim) leaves room for it.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      frame = 0;
      const height = el.offsetHeight;
      const visible = onSimulator
        ? Math.min(height, Math.max(0, Math.round(el.getBoundingClientRect().bottom)))
        : height;
      root.style.setProperty('--site-header-h', onSimulator ? '0px' : `${height}px`);
      root.style.setProperty('--site-header-visible', `${visible}px`);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (onSimulator) window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [onSimulator]);

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = 'unset';
      };
    }
  }, [mobileMenuOpen]);

  return (
    <header
      ref={headerRef}
      className={cn(
        'z-40 bg-background/95 print:hidden',
        onSimulator ? 'relative' : 'sticky top-0'
      )}
    >
      <nav className="container flex items-center justify-between p-4 mx-auto lg:px-8">
        {/* Logo */}
        <div className="flex lg:flex-1">
          <Logo size={55} href="/" showText />
        </div>

        {/* Mobile menu button */}
        <div className="flex lg:hidden">
          <Link
            href="/search"
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </Link>
          <Button variant="ghost" size="sm" onClick={() => setMobileMenuOpen(true)} className="p-2">
            <span className="sr-only">Open main menu</span>
            <Menu className="w-5 h-5" aria-hidden="true" />
          </Button>
        </div>

        {/* Desktop Navigation */}
        <DesktopNavigation />
      </nav>

      {/* Mobile Menu */}
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </header>
  );
}
