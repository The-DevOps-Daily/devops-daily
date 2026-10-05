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
  const [hiddenOn, setHiddenOn] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  // Simulator pages need the full screen, so the header slides away while scrolling down.
  const autoHide = /^\/games\/[^/]+/.test(pathname ?? '');

  useEffect(() => {
    if (!autoHide) return;
    // Measure from where the current scroll direction started, so slow trackpad scrolls count too.
    let lastY = window.scrollY;
    let anchorY = lastY;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        if ((y - lastY) * (lastY - anchorY) < 0) anchorY = lastY;
        if (y < 80) setHiddenOn(null);
        else if (y - anchorY > 24) setHiddenOn(pathname);
        else if (anchorY - y > 24) setHiddenOn(null);
        lastY = y;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, [autoHide, pathname]);

  const isHidden = autoHide && hiddenOn === pathname && !mobileMenuOpen && !focused;

  // Sticky elements below the header read its visible height from --site-header-h.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const root = document.documentElement;
    const update = () =>
      root.style.setProperty('--site-header-h', isHidden ? '0px' : `${el.offsetHeight}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isHidden]);

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
        'sticky top-0 z-40 bg-background/95 transition-transform duration-200 motion-reduce:transition-none print:hidden',
        isHidden && '-translate-y-full'
      )}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
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
