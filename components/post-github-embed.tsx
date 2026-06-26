'use client';

import React, { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Star, GitFork, Scale } from 'lucide-react';

interface RepoData {
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  license: { spdx_id: string | null } | null;
  owner: { login: string; avatar_url: string };
  topics?: string[];
}

/* A small subset of GitHub's linguist language colors. */
const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  Ruby: '#701516',
  PHP: '#4F5D95',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Kotlin: '#A97BFF',
  Swift: '#F05138',
  Dart: '#00B4AB',
  HCL: '#844FBA',
  Dockerfile: '#384d54',
};

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

const GithubMark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

function GithubCard({ repo }: { repo: string }) {
  const [data, setData] = useState<RepoData | null>(null);
  const [failed, setFailed] = useState(false);
  const url = `https://github.com/${repo}`;

  useEffect(() => {
    let cancelled = false;
    const cacheKey = `gh-embed:${repo}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setData(JSON.parse(cached));
        return;
      }
    } catch {
      /* sessionStorage unavailable */
    }
    fetch(`https://api.github.com/repos/${repo}`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: RepoData) => {
        if (cancelled) return;
        setData(json);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(json));
        } catch {
          /* ignore quota */
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [repo]);

  // Loading skeleton
  if (!data && !failed) {
    return (
      <div className="not-prose my-6 animate-pulse rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-muted" />
          <div className="h-4 w-48 rounded bg-muted" />
        </div>
        <div className="mt-3 h-3 w-3/4 rounded bg-muted" />
        <div className="mt-4 h-3 w-40 rounded bg-muted" />
      </div>
    );
  }

  // Fallback when the API is unreachable or rate-limited
  if (failed || !data) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="not-prose my-6 flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-4 no-underline transition-colors hover:border-primary/50"
      >
        <GithubMark className="h-6 w-6 text-foreground" />
        <span className="font-mono text-sm font-medium text-foreground">{repo}</span>
        <span className="ml-auto text-xs text-muted-foreground">View on GitHub →</span>
      </a>
    );
  }

  const [owner, name] = data.full_name.split('/');
  const langColor = data.language ? LANG_COLORS[data.language] ?? '#8b949e' : null;
  const topics = (data.topics ?? []).slice(0, 4);

  return (
    <a
      href={data.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className="not-prose group my-6 block rounded-xl border border-border bg-muted/20 p-4 no-underline transition-colors hover:border-primary/50 hover:bg-muted/40"
    >
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={data.owner.avatar_url}
          alt=""
          width={32}
          height={32}
          loading="lazy"
          className="h-8 w-8 flex-shrink-0 rounded-full border border-border"
        />
        <span className="truncate text-[15px] font-semibold">
          <span className="text-muted-foreground">{owner}/</span>
          <span className="text-primary group-hover:underline">{name}</span>
        </span>
        <GithubMark className="ml-auto h-5 w-5 flex-shrink-0 text-muted-foreground" />
      </div>

      {data.description && (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{data.description}</p>
      )}

      {topics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {topics.map((t) => (
            <span
              key={t}
              className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {data.language && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: langColor ?? '#8b949e' }}
            />
            {data.language}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Star className="h-3.5 w-3.5" />
          {formatCount(data.stargazers_count)}
        </span>
        <span className="inline-flex items-center gap-1">
          <GitFork className="h-3.5 w-3.5" />
          {formatCount(data.forks_count)}
        </span>
        {data.license?.spdx_id && data.license.spdx_id !== 'NOASSERTION' && (
          <span className="inline-flex items-center gap-1">
            <Scale className="h-3.5 w-3.5" />
            {data.license.spdx_id}
          </span>
        )}
      </div>
    </a>
  );
}

export function GithubEmbedWrapper({ children }: { children: React.ReactNode }) {
  const rootsRef = React.useRef<Root[]>([]);
  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>(
      '.post-github[data-repo]:not([data-mounted])'
    );
    nodes.forEach((node) => {
      const repo = node.dataset.repo;
      if (!repo) return;
      node.setAttribute('data-mounted', 'true');
      const root = createRoot(node);
      root.render(<GithubCard repo={repo} />);
      rootsRef.current.push(root);
    });
    const roots = rootsRef.current;
    return () => {
      setTimeout(() => roots.forEach((root) => root.unmount()), 0);
      rootsRef.current = [];
    };
  }, []);
  return <>{children}</>;
}
