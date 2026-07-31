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

function isRunningStandalone() {
  if (typeof window === 'undefined') return false;
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    navigatorWithStandalone.standalone === true
  );
}

export function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(isRunningStandalone);

  useEffect(() => {
    // next-pwa owns service-worker registration. This component only owns
    // the browser install prompt and its UI lifecycle.
    const installed = isRunningStandalone();
    const isPermanentlyDismissed =
      localStorage.getItem('pwa-install-dismissed-permanent') === 'true';
    let showTimer: ReturnType<typeof setTimeout> | undefined;

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);

      if (!isPermanentlyDismissed && !installed) {
        showTimer = setTimeout(() => setShowInstallPrompt(true), 30_000);
      }
    };

    const handleAppInstalled = () => {
      if (showTimer) clearTimeout(showTimer);
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
      localStorage.removeItem('pwa-install-dismissed-permanent');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      if (showTimer) clearTimeout(showTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'dismissed') {
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
              aria-label="Dismiss install prompt"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
