'use client';

import React, { useEffect, useRef } from 'react';
import { Check, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  children: React.ReactNode;
  language?: string;
}

export function CodeBlock({ children, language }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);
  const codeRef = useRef<HTMLElement>(null);

  const handleCopy = async () => {
    const code = codeRef.current?.textContent || '';

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="relative group my-6">
      {language && (
        <div className="absolute top-2 left-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">
          {language}
        </div>
      )}

      <pre className="bg-muted/50 backdrop-blur-sm rounded-lg overflow-hidden border border-border/50 shadow-sm">
        <code
          ref={codeRef}
          className={`block p-4 text-sm font-mono overflow-x-auto ${language ? 'pt-8' : ''}`}
        >
          {children}
        </code>
      </pre>

      <motion.button
        onClick={handleCopy}
        aria-label={copied ? "Copied to clipboard" : "Copy code to clipboard"}
        className={cn(
          'absolute top-2 right-2 z-10',
          'flex items-center justify-center',
          'h-8 w-8 rounded-md',
          'bg-background/80 backdrop-blur-sm',
          'border border-border/50',
          'text-muted-foreground',
          'opacity-0 group-hover:opacity-100',
          'transition-all duration-200',
          'hover:bg-background hover:text-foreground',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          copied && 'text-green-600 dark:text-green-400'
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <AnimatePresence mode="wait">
          {copied ? (
            <motion.div
              key="check"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Check className="h-4 w-4" />
            </motion.div>
          ) : (
            <motion.div
              key="copy"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Copy className="h-4 w-4" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tooltip */}
        <AnimatePresence>
          {copied && (
            <motion.div
              initial={{ opacity: 0, y: 5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 5, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap
                bg-background/90 backdrop-blur-sm text-foreground text-xs px-2 py-1 rounded-md
                border border-border/50 shadow-lg"
            >
              Copied!
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}

export function CodeBlockWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const processCodeBlocks = () => {
      const codeBlocks = document.querySelectorAll('pre:not([data-processed])');

      codeBlocks.forEach((pre) => {
        const code = pre.querySelector('code');
        if (!code) return;

        // Get language from class
        // const languageMatch = code.className.match(/language-(\w+)/);
        // const language = languageMatch ? languageMatch[1] : undefined;

        // Add classes for styling
        pre.classList.add('relative', 'group', 'my-6');

        // Mark as processed
        pre.setAttribute('data-processed', 'true');

        // Get code text
        const codeText = code.textContent || '';

        // Create copy button
        const copyButton = document.createElement('button');
        copyButton.setAttribute('aria-label', 'Copy code to clipboard');
        copyButton.className = `
          copy-button absolute top-2 right-2 z-10 
          flex items-center justify-center 
          h-8 w-8 rounded-md 
          bg-background/80 backdrop-blur-sm 
          border border-border/50 
          text-muted-foreground 
          opacity-0 group-hover:opacity-100 
          transition-all duration-200 
          hover:bg-background hover:text-foreground 
          focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
        `;

        // Add copy icon
        copyButton.innerHTML = `
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        `;

        // Add click handler
        copyButton.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(codeText);

            // Update aria-label for screen readers
            copyButton.setAttribute('aria-label', 'Copied to clipboard');

            // Show check icon
            copyButton.innerHTML = `
              <svg class="h-4 w-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            `;

            // Reset after 2 seconds
            setTimeout(() => {
              copyButton.setAttribute('aria-label', 'Copy code to clipboard');
              copyButton.innerHTML = `
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              `;
            }, 1000);
          } catch (err) {
            console.error('Failed to copy:', err);
          }
        });

        // Add language badge
        // if (language) {
        //   const langBadge = document.createElement("div")
        //   langBadge.className = "absolute top-1 left-1 text-xs text-muted-foreground font-medium uppercase tracking-wider"
        //   langBadge.textContent = language
        //   pre.appendChild(langBadge)

        //   // Add padding to code when language is shown
        //   code.classList.add("pb-16")
        // }

        // Add copy button to pre element
        pre.appendChild(copyButton);
      });
    };

    // Process existing code blocks
    processCodeBlocks();

    // Observer for dynamically added code blocks
    const observer = new MutationObserver(processCodeBlocks);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return <div className="markdown-content">{children}</div>;
}
