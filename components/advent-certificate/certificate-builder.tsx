'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Award, Check, Copy, Download, Gift, Lock, Plus, Share2 } from 'lucide-react';
import { Linkedin } from '@/components/icons/social-icons';
import {
  CertificateCanvas,
  type CertificateCanvasHandle,
} from '@/components/advent-certificate/certificate-canvas';
import {
  ADVENTS,
  GIVEAWAY_PATH,
  LINKEDIN_PAGE_URL,
  adventTitle,
  certificateUrl,
  cleanName,
  isoDate,
  linkedInAddToProfileUrl,
  linkedInShareUrl,
  nameProblem,
  newCertificateId,
  readCompletedDays,
  readStoredCertificate,
  saveStoredCertificate,
  sharePostText,
  type AdventKey,
  type StoredCertificate,
} from '@/lib/advent-certificate';

const button =
  'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';
const primary = `${button} bg-primary text-primary-foreground hover:bg-primary/90`;
const secondary = `${button} border border-border bg-background hover:border-primary/50 hover:bg-muted/40`;
const linkedin = `${button} bg-[#0A66C2] text-white hover:bg-[#0A66C2]/90`;

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CertificateBuilder({ adventKey }: { adventKey: AdventKey }) {
  const advent = ADVENTS[adventKey];
  const [loaded, setLoaded] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [stored, setStored] = useState<StoredCertificate | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [confirmElsewhere, setConfirmElsewhere] = useState(false);
  const [copied, setCopied] = useState<'text' | 'link' | null>(null);
  const canvasRef = useRef<CertificateCanvasHandle>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const done = readCompletedDays(advent);
      let saved = readStoredCertificate(advent);
      // A finished calendar gets its id and issue date the first time it opens here.
      if (!saved && done >= advent.totalDays) {
        saved = { id: newCertificateId(advent, randomBytes), name: '', date: isoDate(new Date()) };
        saveStoredCertificate(advent, saved);
      }
      setCompleted(done);
      setStored(saved);
      setNameInput(saved?.name ?? '');
      setLoaded(true);
    }, 0);
    return () => clearTimeout(t);
  }, [advent]);

  const finished = completed >= advent.totalDays;
  const unlocked = finished || stored?.selfReported === true;

  const save = (patch: Partial<StoredCertificate>) => {
    const next: StoredCertificate = {
      id: stored?.id ?? newCertificateId(advent, randomBytes),
      name: stored?.name ?? '',
      date: stored?.date || isoDate(new Date()),
      selfReported: stored?.selfReported,
      ...patch,
    };
    setStored(next);
    saveStoredCertificate(advent, next);
    return next;
  };

  const problem = nameInput ? nameProblem(nameInput) : null;
  const name = cleanName(nameInput);
  const ready = unlocked && !!stored && !problem && name.length >= 2;

  const data = useMemo(
    () =>
      stored
        ? {
            name: ready ? name : 'Your Name',
            days: advent.totalDays,
            date: stored.date || isoDate(new Date()),
            id: stored.id,
          }
        : null,
    [stored, ready, name, advent.totalDays]
  );

  // Keep the typed name, so the certificate is the same on the next visit.
  useEffect(() => {
    if (!stored || !ready || stored.name === name) return;
    const t = setTimeout(() => {
      const next = { ...stored, name };
      setStored(next);
      saveStoredCertificate(advent, next);
    }, 400);
    return () => clearTimeout(t);
  }, [name, ready, stored, advent]);

  if (!loaded) {
    return <div className="h-96 rounded-md border border-border bg-muted/20" aria-busy="true" />;
  }

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-2xl rounded-md border border-border bg-card p-6 sm:p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted/40">
            <Lock className="h-5 w-5 text-primary" strokeWidth={1.5} aria-hidden="true" />
          </div>
          <div>
            <p className="font-mono text-xs text-muted-foreground">{'// locked'}</p>
            <h2 className="text-xl font-bold">Finish all {advent.totalDays} days to unlock it</h2>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          This browser shows{' '}
          <strong className="text-foreground tabular-nums">
            {completed} of {advent.totalDays}
          </strong>{' '}
          days done. Your progress is saved in the browser you used, so it is not here if you worked
          on another device or cleared your data.
        </p>
        <div
          role="progressbar"
          aria-label="Days done"
          aria-valuemin={0}
          aria-valuemax={advent.totalDays}
          aria-valuenow={completed}
          className="mt-4 h-3 overflow-hidden rounded-full border border-border bg-muted"
        >
          <div
            className="h-full bg-linear-to-r from-primary via-blue-500 to-green-500"
            style={{ width: `${(completed / advent.totalDays) * 100}%` }}
          />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`${advent.path}#${advent.key === 'devops' ? 'challenges' : 'calendar'}`}
            className={primary}
          >
            Back to the calendar
          </Link>
        </div>

        <div className="mt-8 border-t border-border pt-6">
          <h3 className="font-semibold">Finished on another device?</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            We trust you. Tick the box and the certificate unlocks here. It will say the result is
            self-reported, like every certificate from this page.
          </p>
          <label className="mt-4 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={confirmElsewhere}
              onChange={(e) => setConfirmElsewhere(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>
              I completed all {advent.totalDays} days of {adventTitle(advent)}.
            </span>
          </label>
          <button
            type="button"
            disabled={!confirmElsewhere}
            onClick={() => save({ selfReported: true })}
            className={`${secondary} mt-4`}
          >
            Unlock my certificate
          </button>
        </div>
      </div>
    );
  }

  if (!stored || !data) return null;

  const url = ready ? certificateUrl(advent, data) : '';
  const postText = ready ? sharePostText(advent, data) : '';

  const download = async () => {
    const blob = await canvasRef.current?.toPngBlob();
    if (!blob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${advent.path.slice(1)}-${advent.year}-certificate.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const flash = (what: 'text' | 'link') => {
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <div className="overflow-hidden rounded-md border border-border shadow-sm">
          <CertificateCanvas ref={canvasRef} advent={advent} data={data} />
        </div>
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          {`// id ${stored.id} · ${finished ? 'progress from this browser' : 'self-reported'}`}
        </p>
      </div>

      <div className="space-y-6 lg:col-span-4">
        <div className="rounded-md border border-border bg-card p-5">
          <label htmlFor="certificate-name" className="text-sm font-semibold">
            Name on the certificate
          </label>
          <input
            id="certificate-name"
            type="text"
            autoComplete="name"
            maxLength={70}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Your full name"
            aria-invalid={!!problem}
            aria-describedby="certificate-name-help"
            className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <p
            id="certificate-name-help"
            className={`mt-2 text-xs ${problem ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}
          >
            {problem ?? 'Use the name on your LinkedIn profile, so people can match them.'}
          </p>

          <div className="mt-5 grid gap-2">
            <button type="button" onClick={download} disabled={!ready} className={primary}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Download PNG
            </button>
            <a
              href={ready ? linkedInShareUrl(url) : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!ready}
              onClick={(e) => {
                if (!ready) return e.preventDefault();
                copyText(postText).then((ok) => ok && flash('text'));
              }}
              className={`${linkedin} ${ready ? '' : 'pointer-events-none opacity-50'}`}
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Share on LinkedIn
            </a>
            <a
              href={ready ? linkedInAddToProfileUrl(advent, data) : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!ready}
              className={`${secondary} ${ready ? '' : 'pointer-events-none opacity-50'}`}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add to LinkedIn profile
            </a>
            <button
              type="button"
              disabled={!ready}
              onClick={() => copyText(url).then((ok) => ok && flash('link'))}
              className={secondary}
            >
              {copied === 'link' ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
              {copied === 'link' ? 'Link copied' : 'Copy certificate link'}
            </button>
          </div>
        </div>

        {ready && (
          <div className="rounded-md border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Post text for LinkedIn</h3>
              <button
                type="button"
                onClick={() => copyText(postText).then((ok) => ok && flash('text'))}
                className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-primary"
              >
                {copied === 'text' ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {copied === 'text' ? 'copied' : 'copy'}
              </button>
            </div>
            <textarea
              readOnly
              value={postText}
              rows={9}
              aria-label="Suggested LinkedIn post"
              className="mt-2 w-full resize-y rounded-md border border-border bg-muted/30 p-3 font-mono text-xs leading-relaxed"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              &quot;Share on LinkedIn&quot; copies this text too. LinkedIn does not tag a page from
              pasted text, so type @DevOps Daily again in the post and pick our page from the list.
            </p>
          </div>
        )}

        <div className="rounded-md border border-primary/30 bg-primary/5 p-5">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" strokeWidth={1.5} aria-hidden="true" />
            <h3 className="font-semibold">Enter the giveaway</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Follow DevOps Daily on LinkedIn, share your certificate with {advent.hashtag}, then fill
            in the short form. Entries close on 31 December.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={LINKEDIN_PAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={linkedin}
            >
              <Linkedin className="h-4 w-4" aria-hidden="true" />
              Follow on LinkedIn
            </a>
            <Link href={`${GIVEAWAY_PATH}#enter`} className={secondary}>
              <Award className="h-4 w-4" aria-hidden="true" />
              Prizes and entry form
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
