'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
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

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm lg:hidden"
            onClick={onClose}
          />

          {/* Mobile menu panel */}
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-[60] w-full px-6 py-6 bg-background/95 border-l shadow-2xl sm:max-w-sm border-border/80 ring-1 ring-white/10 overflow-y-auto"
          >
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
                      className="flex items-center gap-4 px-4 text-base font-semibold leading-7 transition-all duration-300 border border-transparent rounded-2xl hover:bg-linear-to-r hover:from-primary/10 hover:to-purple-500/10 hover:shadow-md hover:border-primary/20"
                      onClick={onClose}
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
                        onClick={onClose}
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
  );
}
