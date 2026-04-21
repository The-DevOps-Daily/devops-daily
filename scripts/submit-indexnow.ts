#!/usr/bin/env bun
/**
 * Submit URLs to IndexNow (Bing, Yandex, Seznam, Naver).
 *
 * Usage:
 *   bun scripts/submit-indexnow.ts <url> [url ...]
 *   bun scripts/submit-indexnow.ts --stdin          # newline-separated URLs
 *   bun scripts/submit-indexnow.ts --sitemap        # pull every URL from the sitemap
 *   bun scripts/submit-indexnow.ts --dry-run <url>  # print the payload, don't POST
 *
 * Environment:
 *   SITE_URL          defaults to https://devops-daily.com
 *   INDEXNOW_ENDPOINT defaults to https://api.indexnow.org/IndexNow
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const KEY = '94431595b723407986a66bb4726c8be6';
const SITE_URL = (process.env.SITE_URL || 'https://devops-daily.com').replace(/\/$/, '');
const HOST = new URL(SITE_URL).host;
const KEY_LOCATION = `${SITE_URL}/${KEY}.txt`;
const ENDPOINT = process.env.INDEXNOW_ENDPOINT || 'https://api.indexnow.org/IndexNow';
const CHUNK_SIZE = 500;

function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `${SITE_URL}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}

async function loadFromSitemap(): Promise<string[]> {
  const sitemapPath = resolve('out', 'sitemap.xml');
  let xml: string;
  try {
    xml = readFileSync(sitemapPath, 'utf8');
  } catch {
    const res = await fetch(`${SITE_URL}/sitemap.xml`);
    if (!res.ok) throw new Error(`Could not fetch sitemap: ${res.status}`);
    xml = await res.text();
  }
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

async function submitChunk(urlList: string[], dryRun: boolean): Promise<void> {
  const payload = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList };
  if (dryRun) {
    console.log('[dry-run] POST', ENDPOINT);
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  if (res.status !== 200 && res.status !== 202) {
    throw new Error(`IndexNow ${res.status}: ${body || '(empty)'}`);
  }
  console.log(`✓ submitted ${urlList.length} URL(s) — HTTP ${res.status}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const useStdin = args.includes('--stdin');
  const useSitemap = args.includes('--sitemap');
  const positional = args.filter((a) => !a.startsWith('--'));

  let urls: string[] = [];
  if (useSitemap) {
    urls.push(...(await loadFromSitemap()));
  }
  if (useStdin) {
    const stdin = readFileSync(0, 'utf8');
    urls.push(...stdin.split('\n'));
  }
  urls.push(...positional);

  const normalized = [...new Set(urls.map(normalizeUrl).filter((u): u is string => u !== null))]
    .filter((u) => {
      try {
        return new URL(u).host === HOST;
      } catch {
        return false;
      }
    });

  if (normalized.length === 0) {
    console.log('No URLs to submit.');
    return;
  }

  console.log(`Submitting ${normalized.length} URL(s) to ${ENDPOINT} (host: ${HOST})`);
  for (let i = 0; i < normalized.length; i += CHUNK_SIZE) {
    await submitChunk(normalized.slice(i, i + CHUNK_SIZE), dryRun);
  }
}

main().catch((err) => {
  console.error('IndexNow submission failed:', err.message);
  process.exit(1);
});
