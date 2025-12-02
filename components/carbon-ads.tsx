'use client';

import { useEffect } from 'react';
import { Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CarbonAdsProps {
  className?: string;
}

export function CarbonAds({ className }: CarbonAdsProps) {
  useEffect(() => {
    // Load Carbon Ads script
    const script = document.createElement('script');
    script.async = true;
    script.type = 'text/javascript';
    script.src = '//cdn.carbonads.com/carbon.js?serve=CE7DL53M&placement=bobbyilievcom&format=cover';
    script.id = '_carbonads_js';

    const container = document.getElementById('carbon-ads-container');
    if (container && !document.getElementById('_carbonads_js')) {
      container.appendChild(script);
    }

    // Cleanup function
    return () => {
      const existingScript = document.getElementById('_carbonads_js');
      if (existingScript) {
        existingScript.remove();
      }
      // Also remove the Carbon ad element if it exists
      const carbonAd = document.getElementById('carbonads');
      if (carbonAd) {
        carbonAd.remove();
      }
    };
  }, []);

  return (
    <div className={cn('relative', className)}>
      {/* Background decoration */}
      <div className="absolute inset-0 bg-linear-to-r from-blue-500/5 to-transparent rounded-xl blur-xl" />

      <div className="relative rounded-xl border border-border/50 overflow-hidden backdrop-blur-sm bg-card/50">
        {/* Header with gradient */}
        <div className="relative bg-linear-to-r from-blue-500/10 to-blue-500/5 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-blue-500" />
              <span className="font-semibold">Sponsored</span>
            </div>
            <span className="text-xs text-muted-foreground">Carbon Ads</span>
          </div>
        </div>

        {/* Carbon Ads Container */}
        <div className="p-4">
          <div id="carbon-ads-container" className="carbon-ads-wrapper" />
        </div>
      </div>

      {/* Carbon Ads Styles */}
      <style jsx global>{`
        /* Override styles for Carbon Cover format */
        #carbon-cover {
          width: 100% !important;
          max-width: 100% !important;
        }

        #carbon-cover a {
          text-decoration: none !important;
        }

        /* Override styles for Carbon Responsive format (fallback) */
        #carbon-responsive {
          width: 100% !important;
          max-width: 100% !important;
          border: none !important;
          background: transparent !important;
          padding: 0 !important;
        }

        #carbon-responsive a {
          text-decoration: none !important;
        }

        .carbon-ads-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 120px;
        }

        /* Ensure ads are responsive */
        #carbonads {
          max-width: 100%;
          width: 100%;
        }

        #carbonads > span {
          display: block;
        }

        /* Style for cover format */
        #carbon-cover .carbon-wrap {
          width: 100%;
        }

        /* Style for responsive format */
        .carbon-text,
        .carbon-poweredby {
          font-size: 0.875rem;
          line-height: 1.5;
        }

        .carbon-img img {
          border-radius: 0.5rem;
        }
      `}</style>
    </div>
  );
}
