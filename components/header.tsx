'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef, useCallback, startTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';
import { Menu, Search } from 'lucide-react';
import { DesktopNavigation } from './header/desktop-navigation';
import { MobileMenu } from './header/mobile-menu';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMenuMounted, setMobileMenuMounted] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
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

  // Render the hidden mobile menu once the page is idle, so a tap on the menu
  // button only has to show it (INP on mobile). As a transition the render
  // yields to a tap that comes in meanwhile.
  useEffect(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) return;
    const mount = () => startTransition(() => setMobileMenuMounted(true));
    if ('requestIdleCallback' in window) {
      const handle = window.requestIdleCallback(mount, { timeout: 4000 });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = setTimeout(mount, 2000);
    return () => clearTimeout(timer);
  }, []);

  const openMobileMenu = useCallback(() => {
    setMobileMenuMounted(true);
    setMobileMenuOpen(true);
  }, []);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  // Close mobile menu on Escape, on Cmd/Ctrl+K, which opens search (z-50) that
  // would otherwise sit under the open menu, and when the window grows to the
  // desktop layout, which hides the menu.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) {
        setMobileMenuOpen(false);
      }
    };
    const desktop = window.matchMedia('(min-width: 1024px)');
    const handleDesktop = () => {
      if (desktop.matches) setMobileMenuOpen(false);
    };

    if (mobileMenuOpen) {
      document.addEventListener('keydown', handleKeyDown);
      desktop.addEventListener('change', handleDesktop);
      document.body.style.overflow = 'hidden';
      // Hides the cookie banner under the menu, so Tab cannot reach it (globals.css).
      document.body.dataset.mobileMenu = 'open';
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        desktop.removeEventListener('change', handleDesktop);
        document.body.style.overflow = 'unset';
        delete document.body.dataset.mobileMenu;
      };
    }
  }, [mobileMenuOpen]);

  return (
    <header
      ref={headerRef}
      className={cn(
        'bg-background/95 print:hidden',
        onSimulator ? 'relative' : 'sticky top-0',
        // The open mobile menu lives in the header's stacking context, so the
        // header rises above other fixed layers (bottom bars, popups) and
        // drops back once the 200 ms slide-out is over.
        mobileMenuOpen ? 'z-[70]' : 'z-40 [transition:z-index_0s_200ms]'
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
          <Button
            ref={menuButtonRef}
            variant="ghost"
            size="sm"
            onClick={openMobileMenu}
            className="p-2"
          >
            <span className="sr-only">Open main menu</span>
            <Menu className="w-5 h-5" aria-hidden="true" />
          </Button>
        </div>

        {/* Desktop Navigation */}
        <DesktopNavigation />
      </nav>

      {/* Mobile Menu */}
      {mobileMenuMounted && (
        <MobileMenu
          isOpen={mobileMenuOpen}
          onClose={closeMobileMenu}
          returnFocusRef={menuButtonRef}
        />
      )}
    </header>
  );
}
