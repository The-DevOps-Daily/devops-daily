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
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const root = document.documentElement;
    const update = () =>
      root.style.setProperty('--site-header-h', onSimulator ? '0px' : `${el.offsetHeight}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
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
