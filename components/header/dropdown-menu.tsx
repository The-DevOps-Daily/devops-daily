'use client';

import Link from 'next/link';
import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ExternalLink, Sparkles } from 'lucide-react';
import { type NavSection, sectionColors } from './nav-items';

interface DropdownMenuProps {
  sections: NavSection[];
  isOpen: boolean;
  onClose: () => void;
}

export function DropdownMenu({ sections, isOpen, onClose }: DropdownMenuProps) {
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
          <div
            className={cn(
              'bg-background/95 backdrop-blur-xl border border-border/80 rounded-xl shadow-2xl shadow-black/20 dark:shadow-black/50 ring-1 ring-white/10',
              sections.length > 1 ? 'w-[680px] max-w-[90vw]' : 'w-[340px] max-w-[90vw]'
            )}
          >
            <div className="p-5 bg-linear-to-br from-background/50 to-muted/20">
              <div
                className={cn(
                  'grid gap-6',
                  sections.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
                )}
              >
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
