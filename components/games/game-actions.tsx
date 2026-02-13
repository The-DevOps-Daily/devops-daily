'use client';

import { Maximize2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmbedCodeModal } from '@/components/embed';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCallback, useState } from 'react';

interface GameActionsProps {
  gameSlug: string;
  gameTitle: string;
}

/**
 * Action buttons for game pages: Embed, Share, Fullscreen
 */
export function GameActions({ gameSlug, gameTitle }: GameActionsProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== 'undefined'
    ? window.location.href
    : `https://devops-daily.com/games/${gameSlug}`;

  const handleShare = useCallback(async (method: 'copy' | 'twitter' | 'linkedin') => {
    const title = `Check out ${gameTitle} on DevOps Daily!`;

    switch (method) {
      case 'copy':
        try {
          await navigator.clipboard.writeText(shareUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (err) {
          console.error('Failed to copy:', err);
        }
        break;
      case 'twitter':
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(shareUrl)}`,
          '_blank'
        );
        break;
      case 'linkedin':
        window.open(
          `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
          '_blank'
        );
        break;
    }
  }, [shareUrl, gameTitle]);

  const handleFullscreen = useCallback(() => {
    const elem = document.documentElement;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      elem.requestFullscreen();
    }
  }, []);

  return (
    <div className="flex items-center gap-2">
      {/* Embed Button */}
      <EmbedCodeModal gameSlug={gameSlug} gameTitle={gameTitle} />

      {/* Share Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 size={16} />
            {copied ? 'Copied!' : 'Share'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleShare('copy')}>
            Copy Link
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShare('twitter')}>
            Share on Twitter
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleShare('linkedin')}>
            Share on LinkedIn
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Fullscreen Button */}
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={handleFullscreen}
        title="Toggle fullscreen"
      >
        <Maximize2 size={16} />
        <span className="hidden sm:inline">Fullscreen</span>
      </Button>
    </div>
  );
}
