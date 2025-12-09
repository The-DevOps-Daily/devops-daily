'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('✅ Service Worker registered successfully:', registration.scope);

          // Handle updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New content is available, show refresh prompt
                  if (confirm('New content is available! Would you like to refresh?')) {
                    window.location.reload();
                  }
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('❌ Service Worker registration failed:', error);
        });

      // Listen for skip waiting message
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SKIP_WAITING') {
          window.location.reload();
        }
      });
    }

    // Check if app is already installed
    const checkIfInstalled = () => {
      // Check if running in standalone mode (PWA installed)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      // Check if running in WebKit standalone (iOS)
      const isWebkitStandalone = (navigator as any).standalone === true;

      setIsInstalled(isStandalone || isWebkitStandalone);
    };

    // Check if user permanently dismissed the prompt
    const isPermanentlyDismissed =
      localStorage.getItem('pwa-install-dismissed-permanent') === 'true';

    // Handle PWA install prompt
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);

      // Only show if not permanently dismissed and not installed
      if (!isPermanentlyDismissed && !isInstalled) {
        // Show after user has spent some time on the site (more respectful)
        setTimeout(() => {
          if (!isInstalled && !isPermanentlyDismissed) {
            setShowInstallPrompt(true);
          }
        }, 30000); // Show after 30 seconds
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
      // Clear any dismissal flags since user installed
      localStorage.removeItem('pwa-install-dismissed-permanent');
      console.log('✅ PWA was installed successfully');
    });

    // Initial checks
    checkIfInstalled();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isInstalled]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('✅ User accepted the install prompt');
    } else {
      console.log('❌ User dismissed the install prompt');
      // Set permanent dismissal flag
      localStorage.setItem('pwa-install-dismissed-permanent', 'true');
    }

    // Record interaction timestamp for other notification timing
    localStorage.setItem('pwa-last-interaction', Date.now().toString());

    // Clear the deferredPrompt
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    // Permanently dismiss - user clearly doesn't want PWA
    localStorage.setItem('pwa-install-dismissed-permanent', 'true');
    // Record interaction timestamp for other notification timing
    localStorage.setItem('pwa-last-interaction', Date.now().toString());
  };

  // Don't show if already installed or no prompt available
  if (isInstalled || !showInstallPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50"
      >
        <div className="bg-card border border-border rounded-lg shadow-lg p-4 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Download className="h-5 w-5 text-primary-foreground" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm">Install DevOps Daily</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Get quick access and work offline with our PWA!
              </p>

              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={handleInstallClick} className="text-xs h-8">
                  Install
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDismiss} className="text-xs h-8">
                  No thanks
                </Button>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="shrink-0 h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
