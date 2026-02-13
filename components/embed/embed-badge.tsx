'use client';

import { ExternalLink } from 'lucide-react';

interface EmbedBadgeProps {
  gameSlug: string;
  gameTitle: string;
}

/**
 * Attribution badge displayed when a game is embedded on external sites.
 * This badge cannot be removed and provides a backlink to DevOps Daily.
 */
export function EmbedBadge({ gameSlug, gameTitle }: EmbedBadgeProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://devops-daily.com';
  const gameUrl = `${siteUrl}/games/${gameSlug}`;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-500"
      style={{ pointerEvents: 'auto' }}
    >
      <a
        href={gameUrl}
        target="_blank"
        rel="noopener"
        title={`${gameTitle} - DevOps Daily`}
        className="group flex items-center gap-2 px-3 py-2 bg-slate-900/95 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/50 rounded-lg shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-105"
      >
        {/* Logo */}
        <div className="flex items-center justify-center w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-cyan-500">
          <span className="text-xs font-bold text-white">DD</span>
        </div>

        {/* Text */}
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 leading-tight">Powered by</span>
          <span className="text-xs font-semibold text-white leading-tight group-hover:text-blue-400 transition-colors">
            DevOps Daily
          </span>
        </div>

        {/* Arrow icon */}
        <ExternalLink
          size={12}
          className="text-slate-500 group-hover:text-blue-400 transition-colors ml-1"
        />
      </a>
    </div>
  );
}
