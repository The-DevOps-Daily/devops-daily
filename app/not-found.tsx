'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function NotFound() {
  const [path, setPath] = useState('/');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPath(window.location.pathname || '/');
    }
  }, []);

  const isMdRequest = path.endsWith('.md');
  const strippedPath = isMdRequest ? path.replace(/\.md$/, '') : path;

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        <div className="rounded-md border bg-card overflow-hidden font-mono text-sm">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/60 border-b">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
              <div className="w-3 h-3 rounded-full bg-green-400/70" />
            </div>
            <span className="text-xs text-muted-foreground ml-2">devops-daily — 404</span>
          </div>
          <div className="p-6 space-y-3">
            <div>
              <span className="text-green-500">$</span>{' '}
              <span className="text-muted-foreground">cd {path}</span>
            </div>
            <p className="pl-4 text-red-400">
              bash: cd: {path}: No such file or directory
            </p>
            {isMdRequest && (
              <>
                <div>
                  <span className="text-green-500">$</span>{' '}
                  <span className="text-muted-foreground">
                    # try the HTML version
                  </span>
                </div>
                <p className="pl-4 text-primary">
                  <Link href={strippedPath} className="hover:underline">
                    {strippedPath}
                  </Link>
                </p>
              </>
            )}
            <div>
              <span className="text-green-500">$</span>{' '}
              <span className="text-muted-foreground"># available paths</span>
            </div>
            <ul className="pl-4 space-y-0.5 text-foreground">
              <li>
                <Link href="/" className="text-primary hover:underline">
                  /
                </Link>{' '}
                <span className="text-muted-foreground">— home</span>
              </li>
              <li>
                <Link href="/games" className="text-primary hover:underline">
                  /games
                </Link>{' '}
                <span className="text-muted-foreground">— interactive simulators</span>
              </li>
              <li>
                <Link href="/posts" className="text-primary hover:underline">
                  /posts
                </Link>{' '}
                <span className="text-muted-foreground">— latest articles</span>
              </li>
              <li>
                <Link href="/guides" className="text-primary hover:underline">
                  /guides
                </Link>{' '}
                <span className="text-muted-foreground">— step-by-step tutorials</span>
              </li>
              <li>
                <Link href="/exercises" className="text-primary hover:underline">
                  /exercises
                </Link>{' '}
                <span className="text-muted-foreground">— hands-on labs</span>
              </li>
            </ul>
            <div className="text-xs text-muted-foreground/60 pt-1">
              <span className="text-green-500/70">$</span>{' '}
              <span className="inline-block w-[0.6em] h-[1em] align-middle bg-foreground/60 animate-cursor-blink" />
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/" className="font-mono hover:text-primary transition-colors">
            <span className="text-green-500/80">$</span> cd ~
          </Link>
        </p>
      </div>
    </main>
  );
}
