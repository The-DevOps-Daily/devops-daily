// Completion certificates for the two December events, and the giveaway that goes
// with them. The site is static, so a certificate is self-reported: progress lives
// in the reader's browser, and the public certificate page renders from its URL.

export const SITE_URL = 'https://devops-daily.com';
export const LINKEDIN_PAGE_URL = 'https://www.linkedin.com/company/thedevopsdaily';
/** The numeric id of the DevOps Daily LinkedIn page (urn:li:organization:107370385). */
export const LINKEDIN_ORGANIZATION_ID = '107370385';

export const GIVEAWAY_PATH = '/advent-giveaway';
export const GIVEAWAY_DEADLINE = '2026-12-31T23:59:59Z';
export const GIVEAWAY_DEADLINE_TEXT = '31 December 2026, 23:59 UTC';
export const GIVEAWAY_DRAW_TEXT = '5 January 2027';

export type AdventKey = 'devops' | 'postgres';

export interface AdventEvent {
  key: AdventKey;
  name: string;
  year: number;
  totalDays: number;
  path: string;
  hashtag: string;
  /** The first part of a certificate id, for example AOD26-7K2M9X. */
  idPrefix: string;
  /** Finishes "completed ..." on the certificate. */
  achievement: string;
  /** What the event is, for the share text. */
  pitch: string;
  extraTags: string[];
}

export const ADVENTS: Record<AdventKey, AdventEvent> = {
  devops: {
    key: 'devops',
    name: 'Advent of DevOps',
    year: 2026,
    totalDays: 25,
    path: '/advent-of-devops',
    hashtag: '#AdventOfDevOps',
    idPrefix: 'AOD26',
    achievement: 'hands-on DevOps challenges',
    pitch: '25 hands-on challenges with Docker, Kubernetes, CI/CD, Terraform and more',
    extraTags: ['#DevOps'],
  },
  postgres: {
    key: 'postgres',
    name: 'Advent of Postgres',
    year: 2026,
    totalDays: 24,
    path: '/advent-of-postgres',
    hashtag: '#AdventOfPostgres',
    idPrefix: 'AOP26',
    achievement: 'daily SQL puzzles',
    pitch: '24 SQL puzzles on a real Postgres database, from GROUP BY to recursive queries',
    extraTags: ['#PostgreSQL', '#SQL'],
  },
};

export function adventTitle(advent: AdventEvent): string {
  return `${advent.name} ${advent.year}`;
}

export function certificatePath(advent: AdventEvent): string {
  return `${advent.path}/certificate`;
}

export function certificateViewPath(advent: AdventEvent): string {
  return `${advent.path}/certificate/view`;
}

export interface CertificateData {
  name: string;
  days: number;
  /** Issue date, YYYY-MM-DD. */
  date: string;
  id: string;
}

// No 0/O, 1/I/L or U, so an id read aloud or typed from the image is not ambiguous.
const ID_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const ID_PATTERN = /^AO[DP]26-[2-9A-HJ-KMNP-TV-Z]{6}$/;
const MAX_NAME_LENGTH = 60;

export function newCertificateId(advent: AdventEvent, random: (n: number) => Uint8Array): string {
  const bytes = random(6);
  let suffix = '';
  for (const byte of bytes) suffix += ID_ALPHABET[byte % ID_ALPHABET.length];
  return `${advent.idPrefix}-${suffix}`;
}

export function isCertificateId(advent: AdventEvent, id: string): boolean {
  return ID_PATTERN.test(id) && id.startsWith(`${advent.idPrefix}-`);
}

/** Collapses whitespace and drops control characters. */
export function cleanName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

/**
 * A name that can go on a certificate: 2 to 60 characters with a letter in it, and
 * no links or addresses, so a certificate URL cannot be used to show one.
 */
export function nameProblem(raw: string): string | null {
  const name = cleanName(raw);
  if (name.length < 2) return 'Type your name.';
  if (raw.trim().length > MAX_NAME_LENGTH) return `Use ${MAX_NAME_LENGTH} characters or fewer.`;
  if (!/\p{L}/u.test(name)) return 'Use letters in your name.';
  if (/https?:|www\.|@|[<>]|\.(com|net|org|io|dev|xyz|ru)\b/i.test(name)) {
    return 'A name cannot contain a link or an email address.';
  }
  return null;
}

/** YYYY-MM-DD in UTC. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || isoDate(date) !== value) return null;
  return date;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "25 December 2026" */
export function formatCertificateDate(value: string): string {
  const date = parseIsoDate(value);
  if (!date) return value;
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** Reads a public certificate URL's query. Null when any part is missing or wrong. */
export function parseCertificateParams(
  advent: AdventEvent,
  params: { get(name: string): string | null }
): CertificateData | null {
  const rawName = params.get('name') ?? '';
  const days = Number(params.get('days'));
  const date = params.get('date') ?? '';
  const id = (params.get('id') ?? '').toUpperCase();
  if (nameProblem(rawName)) return null;
  if (!Number.isInteger(days) || days < 1 || days > advent.totalDays) return null;
  const parsed = parseIsoDate(date);
  if (!parsed) return null;
  const year = parsed.getUTCFullYear();
  if (year < advent.year || year > advent.year + 1) return null;
  if (!isCertificateId(advent, id)) return null;
  return { name: cleanName(rawName), days, date, id };
}

export function certificateUrl(advent: AdventEvent, data: CertificateData): string {
  const query = new URLSearchParams({
    name: data.name,
    days: String(data.days),
    date: data.date,
    id: data.id,
  });
  return `${SITE_URL}${certificateViewPath(advent)}?${query.toString()}`;
}

export function linkedInShareUrl(url: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
}

/** LinkedIn's "Add licence or certification" form, filled in. */
export function linkedInAddToProfileUrl(advent: AdventEvent, data: CertificateData): string {
  const issued = parseIsoDate(data.date) ?? new Date(`${advent.year}-12-25T00:00:00Z`);
  const query = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: `${adventTitle(advent)}: Certificate of Completion`,
    organizationId: LINKEDIN_ORGANIZATION_ID,
    issueYear: String(issued.getUTCFullYear()),
    issueMonth: String(issued.getUTCMonth() + 1),
    certUrl: certificateUrl(advent, data),
    certId: data.id,
  });
  return `https://www.linkedin.com/profile/add?${query.toString()}`;
}

/** The post text people can paste into LinkedIn with their certificate. */
export function sharePostText(advent: AdventEvent, data: CertificateData): string {
  const done =
    data.days >= advent.totalDays
      ? `I finished ${adventTitle(advent)}`
      : `I completed ${data.days} of ${advent.totalDays} days of ${adventTitle(advent)}`;
  return [
    `${done} from @DevOps Daily: ${advent.pitch}, one a day through December.`,
    '',
    `My certificate: ${certificateUrl(advent, data)}`,
    '',
    `It is free, if you want to try it: ${SITE_URL}${advent.path}`,
    '',
    [advent.hashtag, ...advent.extraTags].join(' '),
  ].join('\n');
}

/**
 * SMTPfast forms store email, first_name and last_name only. The entry's advents
 * and certificate ids go in last_name, for example "DevOps AOD26-7K2M9X; Postgres".
 */
export function entryDetails(entries: { key: AdventKey; id?: string }[]): string {
  return entries
    .map(({ key, id }) => `${key === 'devops' ? 'DevOps' : 'Postgres'}${id ? ` ${id}` : ''}`)
    .join('; ');
}

export function isGiveawayOpen(now: Date): boolean {
  return now.getTime() <= Date.parse(GIVEAWAY_DEADLINE);
}

// Browser storage. Each event keeps its own progress format.

const PROGRESS_KEYS: Record<AdventKey, string> = {
  devops: 'advent-of-devops-progress',
  postgres: 'advent-of-postgres-progress',
};

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** How many days this browser has marked as done. */
export function readCompletedDays(advent: AdventEvent): number {
  const stored = readJson(PROGRESS_KEYS[advent.key]);
  const list = Array.isArray(stored)
    ? stored
    : stored &&
        typeof stored === 'object' &&
        Array.isArray((stored as { completedDays?: unknown }).completedDays)
      ? (stored as { completedDays: unknown[] }).completedDays
      : [];
  const days = new Set(
    list.filter(
      (day): day is number => Number.isInteger(day) && day >= 1 && day <= advent.totalDays
    )
  );
  return days.size;
}

export interface StoredCertificate {
  id: string;
  name: string;
  date: string;
  /** The reader said they finished on another device or offline. */
  selfReported?: boolean;
}

function storedCertificateKey(advent: AdventEvent): string {
  return `advent-certificate-${advent.key}-${advent.year}`;
}

export function readStoredCertificate(advent: AdventEvent): StoredCertificate | null {
  const stored = readJson(storedCertificateKey(advent)) as Partial<StoredCertificate> | null;
  if (!stored || typeof stored.id !== 'string' || !isCertificateId(advent, stored.id)) return null;
  return {
    id: stored.id,
    name: typeof stored.name === 'string' ? cleanName(stored.name) : '',
    date: typeof stored.date === 'string' && parseIsoDate(stored.date) ? stored.date : '',
    selfReported: stored.selfReported === true,
  };
}

export function saveStoredCertificate(advent: AdventEvent, value: StoredCertificate): void {
  try {
    window.localStorage.setItem(storedCertificateKey(advent), JSON.stringify(value));
  } catch {
    // Private mode: the certificate still works until the tab closes.
  }
}
