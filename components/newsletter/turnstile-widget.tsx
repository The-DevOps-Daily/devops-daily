'use client';

import { useEffect, useRef } from 'react';

/**
 * Cloudflare Turnstile for the newsletter forms. smtpfast verifies the token
 * server side, with the secret kept in the form's settings there.
 *
 * Rendered explicitly because the forms mount at different times (the popup
 * long after page load), and invisible unless Cloudflare wants an interaction.
 * Turnstile puts the token in a hidden `cf-turnstile-response` input inside
 * the container, so FormData picks it up when the widget sits in the form.
 */
const SITE_KEY = '0x4AAAAAAFA8dfBUBhJb93Zm';
const SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__ddTurnstileReady';
export const TURNSTILE_FIELD = 'cf-turnstile-response';

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string | undefined;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
  getResponse: (widgetId: string) => string | undefined;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    __ddTurnstileReady?: () => void;
  }
}

let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      window.__ddTurnstileReady = () => (window.turnstile ? resolve(window.turnstile) : reject());
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.onerror = () => {
        loading = null;
        reject(new Error('Turnstile failed to load'));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}

const CONTAINER_ATTR = 'data-newsletter-turnstile';
const WIDGET_ATTR = 'data-turnstile-widget-id';

export function TurnstileWidget({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let widgetId: string | undefined;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !ref.current) return;
        widgetId = turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          action: 'newsletter',
          appearance: 'interaction-only',
          theme: 'auto',
          size: 'flexible',
          'refresh-expired': 'auto',
        });
        if (widgetId) ref.current.setAttribute(WIDGET_ATTR, widgetId);
      })
      .catch(() => {
        // Without the widget the submit carries no token. smtpfast then says
        // to complete the challenge, which is better than a silent failure.
      });
    return () => {
      cancelled = true;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, []);

  return <div ref={ref} className={className} {...{ [CONTAINER_ATTR]: '' }} />;
}

function widgetIds(): string[] {
  return Array.from(document.querySelectorAll(`[${WIDGET_ATTR}]`))
    .map((el) => el.getAttribute(WIDGET_ATTR))
    .filter((id): id is string => !!id);
}

/**
 * A token for a submit whose own widget had not finished yet. Waits briefly
 * for any newsletter widget on the page to produce one.
 */
export async function waitForTurnstileToken(timeoutMs: number): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const id of widgetIds()) {
      const token = window.turnstile?.getResponse(id);
      if (token) return token;
    }
    // No newsletter widget on the page at all: nothing to wait for.
    if (!document.querySelector(`[${CONTAINER_ATTR}]`)) return null;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

/** Tokens are single use, so every widget starts over after a submit. */
export function resetTurnstileWidgets(): void {
  for (const id of widgetIds()) {
    try {
      window.turnstile?.reset(id);
    } catch {
      // Already removed with its form.
    }
  }
}
