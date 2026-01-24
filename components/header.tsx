'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';
import {
  Menu,
  X,
  ChevronDown,
  BookOpen,
  FileText,
  Map,
  Target,
  Gamepad2,
  Wrench,
  Users,
  FolderOpen,
  Tags,
  Zap,
  Trophy,
  Briefcase,
  Settings,
  ExternalLink,
  Sparkles,
  MoreHorizontal,
  Home,
  Layers,
  Activity,
  Heart,
  Newspaper,
  Library,
  Calendar,
  Gift,
  ListChecks,
  Search,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  external?: boolean;
  badge?: string;
  featured?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
  color?: string;
}

// Color themes for different sections
const sectionColors = {
  primary: {
    bg: 'bg-primary/10',
    border: 'border-primary/30',
    text: 'text-primary',
    gradient: 'from-primary to-purple-600',
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-600',
    gradient: 'from-blue-500 to-blue-600',
  },
  green: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-600',
    gradient: 'from-green-500 to-emerald-600',
  },
  orange: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-600',
    gradient: 'from-orange-500 to-amber-600',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-600',
    gradient: 'from-purple-500 to-violet-600',
  },
  teal: {
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/30',
    text: 'text-teal-600',
    gradient: 'from-teal-500 to-cyan-600',
  },
} as const;

// Main navigation items (no dropdowns)
const mainNavigation = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Posts', href: '/posts', icon: FileText },
  { label: 'Guides', href: '/guides', icon: BookOpen },
  { label: 'News', href: '/news', icon: Newspaper, badge: 'New' },
];

// Dropdown navigation data
const dropdownNavigation: Record<string, NavSection[]> = {
  tools: [
    {
      title: 'DevOps Tools',
      icon: Wrench,
      description: 'Curated tools and resources',
      color: 'blue',
      items: [
        {
          label: 'DevOps Toolbox',
          href: '/toolbox',
          description: 'Essential DevOps tools collection',
          icon: Wrench,
          featured: false,
        },
        {
          label: 'DevOps Books',
          href: '/books',
          description: 'Curated DevOps & SRE books',
          icon: Library,
        },
        {
          label: 'Interactive Games',
          href: '/games',
          description: 'DevOps games and simulators',
          icon: Gamepad2,
        },
        {
          label: 'Checklists',
          href: '/checklists',
          description: 'Interactive security & DevOps checklists',
          icon: ListChecks,
        },
      ],
    },
    {
      title: 'Learning Resources',
      icon: Map,
      description: 'Structured learning paths',
      color: 'green',
      items: [
        {
          label: 'Practical Exercises',
          href: '/exercises',
          description: 'Hands-on DevOps exercises',
          icon: Target,
        },
        {
          label: 'DevOps Roadmap',
          href: '/roadmap',
          description: 'Your journey to DevOps mastery',
          icon: Map,
          featured: false,
        },
        {
          label: 'Quizzes & Tests',
          href: '/quizzes',
          description: 'Test your DevOps knowledge',
          icon: Trophy,
        },
        {
          label: 'Interview Questions',
          href: '/interview-questions',
          description: 'Practice DevOps interview Q&A',
          icon: Briefcase,
          badge: 'New',
        },
      ],
    },
  ],
  more: [
    {
      title: 'Explore Content',
      icon: FolderOpen,
      description: 'Discover by topic and author',
      color: 'purple',
      items: [
        {
          label: 'Categories',
          href: '/categories',
          description: 'Browse by technology topic',
          icon: FolderOpen,
        },
        {
          label: 'Tags',
          href: '/tags',
          description: 'Find content by tags',
          icon: Tags,
        },
        {
          label: 'Authors',
          href: '/authors',
          description: 'Meet our contributors',
          icon: Users,
        },
      ],
    },
    {
      title: 'Special Events',
      icon: Gift,
      description: 'Seasonal challenges',
      color: 'pink',
      items: [
        {
          label: 'Advent of DevOps',
          href: '/advent-of-devops',
          description: '25 days of DevOps challenges',
          icon: Gift,
          featured: true,
          badge: '2025',
        },
      ],
    },
    {
      title: 'Community',
      icon: Users,
      description: 'Connect and contribute',
      color: 'orange',
      items: [
        {
          label: 'GitHub',
          href: 'https://github.com/The-DevOps-Daily',
          description: 'Contribute to our projects',
          icon: ExternalLink,
          external: true,
        },
        {
          label: 'Twitter',
          href: 'https://x.com/thedevopsdaily',
          description: 'Follow us for updates',
          icon: ExternalLink,
          external: true,
        },
      ],
    },
  ],
};

// Individual dropdown menu component
function DropdownMenu({
  sections,
  isOpen,
  onClose,
}: {
  sections: NavSection[];
  isOpen: boolean;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleResize() {
      if (isOpen && menuRef.current) {
        const rect = menuRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;

        // Adjust position if menu would overflow
        if (rect.right > viewportWidth - 20) {
          menuRef.current.style.transform = `translateX(-${rect.right - viewportWidth + 40}px)`;
        } else if (rect.left < 20) {
          menuRef.current.style.transform = `translateX(${20 - rect.left}px)`;
        }
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('resize', handleResize);
      // Check position on mount
      setTimeout(handleResize, 0);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="absolute z-50 mt-3 transform -translate-x-1/2 top-full left-1/2"
          style={{ pointerEvents: 'auto' }}
        >
          {/* Menu Content */}
          <div className="bg-background/95 backdrop-blur-xl border border-border/80 rounded-xl shadow-2xl shadow-black/20 dark:shadow-black/50 overflow-hidden w-[420px] max-w-[90vw] ring-1 ring-white/10">
            <div className="p-6 bg-linear-to-br from-background/50 to-muted/20">
              <div className="grid grid-cols-1 gap-6">
                {sections.map((section, sectionIndex) => (
                  <div key={sectionIndex} className="space-y-3">
                    {/* Section Header */}
                    <div className="flex items-center gap-2.5 pb-3 border-b border-border/60">
                      {section.icon && (
                        <div
                          className={cn(
                            'p-2 border rounded-lg shadow-sm',
                            section.color
                              ? sectionColors[section.color as keyof typeof sectionColors]?.bg ||
                                  sectionColors.primary.bg
                              : sectionColors.primary.bg,
                            section.color
                              ? sectionColors[section.color as keyof typeof sectionColors]
                                  ?.border || sectionColors.primary.border
                              : sectionColors.primary.border
                          )}
                        >
                          <section.icon
                            className={cn(
                              'w-4 h-4',
                              section.color
                                ? sectionColors[section.color as keyof typeof sectionColors]
                                    ?.text || sectionColors.primary.text
                                : sectionColors.primary.text
                            )}
                          />
                        </div>
                      )}
                      <div>
                        <h3
                          className={cn(
                            'text-base font-bold text-transparent bg-clip-text',
                            section.color
                              ? `bg-linear-to-r ${sectionColors[section.color as keyof typeof sectionColors]?.gradient || sectionColors.primary.gradient}`
                              : `bg-linear-to-r ${sectionColors.primary.gradient}`
                          )}
                        >
                          {section.title}
                        </h3>
                        {section.description && (
                          <p className="text-xs font-medium text-muted-foreground">
                            {section.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Section Items */}
                    <div className="grid grid-cols-1 gap-2">
                      {section.items.map((item, itemIndex) => (
                        <Link
                          key={itemIndex}
                          href={item.href}
                          onClick={onClose}
                          className={cn(
                            'group flex items-center gap-3 p-3 rounded-xl transition-all duration-300 border',
                            'hover:bg-linear-to-r hover:from-primary/5 hover:to-purple-500/5 hover:shadow-md hover:scale-[1.01] hover:border-primary/20',
                            'border-transparent hover:border-primary/10',
                            item.featured &&
                              'bg-linear-to-r from-primary/8 to-purple-500/8 border border-primary/20 shadow-md'
                          )}
                          target={item.external ? '_blank' : undefined}
                          rel={item.external ? 'noopener noreferrer' : undefined}
                        >
                          <div
                            className={cn(
                              'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300',
                              item.featured
                                ? 'bg-linear-to-br from-primary/20 to-purple-500/20 text-primary group-hover:bg-primary/30 border border-primary/20'
                                : 'bg-linear-to-br from-muted to-muted/50 group-hover:bg-linear-to-br group-hover:from-primary/15 group-hover:to-purple-500/15 text-muted-foreground group-hover:text-primary border border-border/50'
                            )}
                          >
                            {item.icon ? (
                              <item.icon className="w-4 h-4" />
                            ) : (
                              <div className="w-2 h-2 bg-current rounded-full" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4
                                className={cn(
                                  'font-semibold text-sm transition-colors',
                                  item.featured ? 'text-primary' : 'group-hover:text-primary'
                                )}
                              >
                                {item.label}
                              </h4>
                              {item.badge && (
                                <span className="px-2 py-0.5 bg-linear-to-r from-primary to-purple-600 text-white text-xs rounded-full font-bold">
                                  {item.badge}
                                </span>
                              )}
                              {item.external && (
                                <ExternalLink className="w-3 h-3 text-muted-foreground" />
                              )}
                              {item.featured && <Sparkles className="w-3 h-3 text-primary" />}
                            </div>
                            {item.description && (
                              <p className="text-xs font-medium leading-relaxed text-muted-foreground group-hover:text-muted-foreground/80">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Dropdown trigger component
function DropdownTrigger({
  label,
  sections,
  icon: Icon,
}: {
  label: string;
  sections: NavSection[];
  icon: React.ComponentType<{ className?: string }>;
}) {
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

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <header className="sticky top-0 z-40 bg-background/95 print:hidden">
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
      </nav>

      {/* Mobile menu */}
      <AnimatePresence mode="wait">
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Mobile menu panel */}
            <motion.div
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-60 w-full px-6 py-6 bg-background/95 border-l shadow-2xl sm:max-w-sm border-border/80 ring-1 ring-white/10 overflow-y-auto"
            >
              {/* Mobile menu header */}
              <div className="flex items-center justify-between mb-8">
                <Logo size={50} href="/" showText />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2"
                >
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
                        className="flex items-center gap-4 px-4 text-base font-semibold leading-7 transition-all duration-300 border border-transparent rounded-2xl hover:bg-linear-to-r hover:from-primary/10 hover:to-purple-500/10 hover:shadow-md hover:border-primary/20"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <div className="p-3 border rounded-2xl bg-linear-to-br from-primary/15 to-purple-500/15 border-primary/20">
                          <item.icon className="w-6 h-6 text-primary" />
                        </div>
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                          <span className="px-3 py-1 text-xs font-bold text-white rounded-full bg-linear-to-r from-primary to-purple-600">
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
                          onClick={() => setMobileMenuOpen(false)}
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
                              {item.external && (
                                <ExternalLink className="w-4 h-4 text-muted-foreground" />
                              )}
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
                          onClick={() => setMobileMenuOpen(false)}
                          target={item.external ? '_blank' : undefined}
                          rel={item.external ? 'noopener noreferrer' : undefined}
                        >
                          <div className="p-3 border rounded-2xl bg-linear-to-br from-muted to-muted/50 border-border/50">
                            {item.icon && <item.icon className="w-6 h-6 text-muted-foreground" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span>{item.label}</span>
                              {item.external && (
                                <ExternalLink className="w-4 h-4 text-muted-foreground" />
                              )}
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
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
