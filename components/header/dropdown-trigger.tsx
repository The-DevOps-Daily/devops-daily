'use client';

import { useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DropdownMenu } from './dropdown-menu';
import { type NavSection } from './nav-items';

interface DropdownTriggerProps {
  label: string;
  sections: NavSection[];
  icon: React.ComponentType<{ className?: string }>;
}

export function DropdownTrigger({ label, sections, icon: Icon }: DropdownTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
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
        onClick={() => setIsOpen(!isOpen)}
      >
        <Icon className="w-4 h-4" />
        <span>{label}</span>
        <ChevronDown
          className={cn('w-4 h-4 transition-transform duration-300', isOpen && 'rotate-180')}
        />
      </button>

      <DropdownMenu sections={sections} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}
