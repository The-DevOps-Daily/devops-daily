'use client';

import { useState, useCallback } from 'react';
import { Code, Copy, Check, Monitor, Tablet, Smartphone, Settings2, Eye } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface EmbedCodeModalProps {
  gameSlug: string;
  gameTitle: string;
}

type SizePreset = 'small' | 'medium' | 'large' | 'responsive';
type ThemeOption = 'dark' | 'light' | 'auto';

const SIZE_PRESETS: Record<SizePreset, { width: string; height: string; label: string; icon: React.ReactNode }> = {
  small: { width: '400', height: '300', label: 'Small', icon: <Smartphone size={14} /> },
  medium: { width: '800', height: '600', label: 'Medium', icon: <Tablet size={14} /> },
  large: { width: '1200', height: '800', label: 'Large', icon: <Monitor size={14} /> },
  responsive: { width: '100%', height: '600', label: 'Responsive', icon: <Settings2 size={14} /> },
};

export function EmbedCodeModal({ gameSlug, gameTitle }: EmbedCodeModalProps) {
  const [copied, setCopied] = useState(false);
  const [sizePreset, setSizePreset] = useState<SizePreset>('medium');
  const [theme, setTheme] = useState<ThemeOption>('dark');
  const [showTitle, setShowTitle] = useState(true);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://devops-daily.com';
  const size = SIZE_PRESETS[sizePreset];

  const buildEmbedUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (theme !== 'auto') {
      params.set('theme', theme);
    }
    if (!showTitle) {
      params.set('hideTitle', 'true');
    }
    const queryString = params.toString();
    return `${siteUrl}/games/${gameSlug}/embed${queryString ? `?${queryString}` : ''}`;
  }, [siteUrl, gameSlug, theme, showTitle]);

  const iframeCode = `<iframe
  src="${buildEmbedUrl()}"
  width="${size.width}"
  height="${size.height}"
  frameborder="0"
  allowfullscreen
  loading="lazy"
  title="${gameTitle} - DevOps Daily"
  style="border-radius: 8px; border: 1px solid #334155;"
></iframe>`;

  const responsiveCode = `<div style="position: relative; padding-bottom: 75%; height: 0; overflow: hidden; border-radius: 8px;">
  <iframe
    src="${buildEmbedUrl()}"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 1px solid #334155; border-radius: 8px;"
    frameborder="0"
    allowfullscreen
    loading="lazy"
    title="${gameTitle} - DevOps Daily"
  ></iframe>
</div>`;

  const copyToClipboard = useCallback(async () => {
    const code = sizePreset === 'responsive' ? responsiveCode : iframeCode;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [iframeCode, responsiveCode, sizePreset]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Code size={16} />
          Embed
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code size={20} />
            Embed {gameTitle}
          </DialogTitle>
          <DialogDescription>
            Add this interactive simulator to your website, blog, or documentation.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="iframe" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="iframe">Iframe Embed</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="iframe" className="space-y-3 mt-3 overflow-hidden">
            {/* Size Presets */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Size</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(SIZE_PRESETS) as SizePreset[]).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setSizePreset(preset)}
                    className={`flex flex-col items-center gap-1 p-2 sm:p-3 rounded-lg border transition-all ${
                      sizePreset === preset
                        ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                        : 'border-border hover:border-blue-500/50 hover:bg-muted'
                    }`}
                  >
                    {SIZE_PRESETS[preset].icon}
                    <span className="text-xs font-medium">{SIZE_PRESETS[preset].label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {SIZE_PRESETS[preset].width}x{SIZE_PRESETS[preset].height}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Theme Selection */}
            <div className="flex items-center justify-between">
              <Label htmlFor="theme-select" className="text-sm font-medium">
                Theme
              </Label>
              <Select value={theme} onValueChange={(v) => setTheme(v as ThemeOption)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="auto">Auto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Show Title Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="show-title" className="text-sm font-medium">
                Show title header
              </Label>
              <Switch
                id="show-title"
                checked={showTitle}
                onCheckedChange={setShowTitle}
              />
            </div>

            {/* Generated Code - Fixed height with internal scroll */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Embed Code</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyToClipboard}
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <Check size={14} className="text-green-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      Copy Code
                    </>
                  )}
                </Button>
              </div>
              <pre className="p-4 bg-slate-900 rounded-lg overflow-auto max-h-[140px] w-full text-xs text-slate-300 border border-slate-700">
                <code className="whitespace-pre-wrap break-words">{sizePreset === 'responsive' ? responsiveCode : iframeCode}</code>
              </pre>
            </div>

            {/* Attribution Notice */}
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm">
              <p className="text-blue-400 font-medium">Attribution included</p>
              <p className="text-muted-foreground text-xs mt-1">
                The embed includes a &quot;Powered by DevOps Daily&quot; badge that links back to our site.
                This helps spread DevOps education while giving us credit. Thank you!
              </p>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Eye size={16} />
                <span>Preview how the embed will look</span>
              </div>
              <div
                className="border border-border rounded-lg overflow-hidden bg-slate-900"
                style={{
                  width: sizePreset === 'responsive' ? '100%' : `min(${size.width}px, 100%)`,
                  height: `min(${parseInt(size.height) || 400}px, 400px)`,
                }}
              >
                <iframe
                  src={buildEmbedUrl()}
                  className="w-full h-full border-0"
                  title={`${gameTitle} Preview`}
                  loading="lazy"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Preview is scaled to fit. Actual embed will use your selected dimensions.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
