'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';
import { DropdownTrigger } from './dropdown-trigger';
import { mainNavigation, dropdownNavigation } from './nav-items';
import { Wrench, MoreHorizontal } from 'lucide-react';

export function DesktopNavigation() {
  return (
    <>
      {/* Desktop Navigation */}
      <div className="hidden lg:flex lg:items-center lg:gap-1">
        {/* Main Navigation Links */}
        {mainNavigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-300',
              'hover:bg-primary/8 hover:text-primary hover:shadow-sm',
              'relative'
            )}
          >
            <item.icon className="w-4 h-4" />
            <span>{item.label}</span>
            {item.badge && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-primary text-primary-foreground text-xs rounded-full font-medium">
                {item.badge}
              </span>
            )}
          </Link>
        ))}

        {/* Separator */}
        <div className="w-px h-6 mx-2 bg-border/50" />

        {/* Dropdown Navigation */}
        <DropdownTrigger label="Tools" sections={dropdownNavigation.tools} icon={Wrench} />
        <DropdownTrigger label="More" sections={dropdownNavigation.more} icon={MoreHorizontal} />
      </div>

      {/* Right side */}
      <div className="hidden lg:flex lg:flex-1 lg:justify-end lg:gap-x-3">
        <Link
          href="/search"
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 hover:bg-primary/8 hover:text-primary hover:shadow-sm"
        >
          <Search className="w-4 h-4" />
          <span>Search</span>
        </Link>
        <ThemeToggle />
      </div>
    </>
  );
}
