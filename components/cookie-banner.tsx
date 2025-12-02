'use client';
import { useEffect, useState } from 'react';
import { Cookie, X, Check } from 'lucide-react';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const shouldShow = !localStorage.getItem('cookieAccepted');
      setVisible(shouldShow);
      // Delay showing banner to avoid LCP impact
      if (shouldShow) {
        const timer = setTimeout(() => setIsLoaded(true), 100);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('cookieAccepted', 'true');
    setVisible(false);
  };

  const dismissBanner = () => {
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className={`
        fixed bottom-4 left-4 right-4 md:right-auto md:left-4 md:max-w-sm z-50 
        bg-linear-to-br from-card/95 to-background/95 backdrop-blur-lg 
        border border-border/50 rounded-2xl shadow-2xl shadow-primary/5
        transform transition-all duration-500 ease-out
        ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
      `}
      style={{ willChange: 'transform, opacity' }}
    >
      {/* Gradient border accent */}
      <div className="absolute inset-0 bg-linear-to-r from-primary/20 via-purple-500/20 to-primary/20 rounded-2xl opacity-50 blur-sm" />

      <div className="relative p-4">
        {/* Header with icon and close button */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-linear-to-br from-primary/10 to-purple-500/10 rounded-lg">
              <Cookie className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-medium text-foreground">Cookie Notice</span>
          </div>
          <button
            onClick={dismissBanner}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200"
            aria-label="Dismiss cookie notice"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          We use cookies to enhance your experience and analyze site usage.
          <br className="hidden sm:block" />
          By continuing, you agree to our cookie policy.
        </p>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={acceptCookies}
            className="
              inline-flex items-center justify-center gap-1.5 px-4 py-2 
              bg-linear-to-r from-primary to-primary/90 
              hover:from-primary/90 hover:to-primary/80
              text-primary-foreground text-sm font-medium 
              rounded-xl transition-all duration-200 
              hover:shadow-lg hover:shadow-primary/25 hover:scale-[1.02]
              focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2
            "
          >
            <Check className="h-3.5 w-3.5" />
            Accept All
          </button>
          <button
            onClick={dismissBanner}
            className="
              px-4 py-2 text-sm font-medium text-muted-foreground 
              hover:text-foreground hover:bg-muted/50 
              rounded-xl transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-muted focus:ring-offset-2
            "
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
