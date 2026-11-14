'use client';

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type NavSection } from './nav-items';

// The menu and framer-motion load on desktop while idle, never on phones.
let menuLoaded = false;
const loadDropdownMenu = () =>
  import('./dropdown-menu').then((m) => {
    menuLoaded = true;
    return m.DropdownMenu;
  });
const DropdownMenu = dynamic(loadDropdownMenu, { ssr: false });

interface DropdownTriggerProps {
  label: string;
  sections: NavSection[];
  icon: React.ComponentType<{ className?: string }>;
}

export function DropdownTrigger({ label, sections, icon: Icon }: DropdownTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Rendered from the first open on, so its code is not fetched before that.
  const [used, setUsed] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!window.matchMedia('(min-width: 1024px)').matches) return;
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 2000));
    idle(() => void loadDropdownMenu());
  }, []);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setUsed(true);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-300',
          'hover:bg-primary/8 hover:text-primary hover:shadow-sm',
          isOpen && 'bg-primary/8 text-primary shadow-sm'
        )}
        onClick={() => {
          setUsed(true);
          // A loaded menu closes on the mousedown outside it, so a click after
          // hover reopens it. Until its code is in, a click must open it too.
          setIsOpen(menuLoaded ? !isOpen : true);
        }}
      >
        <Icon className="w-4 h-4" />
        <span>{label}</span>
        <ChevronDown
          className={cn('w-4 h-4 transition-transform duration-300', isOpen && 'rotate-180')}
        />
      </button>

      {used && (
        <DropdownMenu sections={sections} isOpen={isOpen} onClose={() => setIsOpen(false)} />
      )}
    </div>
  );
}
