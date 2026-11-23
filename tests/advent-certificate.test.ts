import { describe, expect, it } from 'vitest';
import {
  ADVENTS,
  certificateUrl,
  cleanName,
  entryDetails,
  formatCertificateDate,
  isCertificateId,
  isGiveawayOpen,
  linkedInAddToProfileUrl,
  linkedInShareUrl,
  nameProblem,
  newCertificateId,
  parseCertificateParams,
  sharePostText,
} from '../lib/advent-certificate';

const devops = ADVENTS.devops;
const postgres = ADVENTS.postgres;
const sample = { name: 'Jane Doe', days: 25, date: '2026-12-25', id: 'AOD26-7K2M9X' };

function query(url: string) {
  return new URL(url).searchParams;
}

describe('certificate ids', () => {
  it('uses the advent prefix and the unambiguous alphabet', () => {
    for (let seed = 0; seed < 50; seed++) {
      const id = newCertificateId(devops, (n) =>
        Uint8Array.from({ length: n }, (_, i) => (seed * 37 + i * 11) % 256)
      );
      expect(isCertificateId(devops, id)).toBe(true);
      expect(id.slice(6)).not.toMatch(/[01ILOU]/);
    }
  });

  it('does not accept the other advent id', () => {
    expect(isCertificateId(postgres, 'AOD26-7K2M9X')).toBe(false);
    expect(isCertificateId(postgres, 'AOP26-7K2M9X')).toBe(true);
  });
});

describe('certificate names', () => {
  it.each([
    'Jane Doe',
    'José Álvarez-Núñez',
    '李小龍',
    "Conan O'Brien",
    'D\u2019Angelo Russo',
    'J. R. R. Tolkien',
    'Jean-Luc Picard',
    'Zoë Saldaña',
  ])('accepts %s', (name) => {
    expect(nameProblem(name)).toBeNull();
  });

  it.each([
    '',
    'J',
    '1234',
    'Jane Doe 2',
    'Visit https://spam.example',
    'www.spam.test',
    'me@example.com',
    '<b>x</b>',
    'example.com',
    'example.c0m',
    'Jane example.store',
    'Jane Doe, call now',
    'Jane  -Doe',
    // fullwidth dot: NFKC turns it into "." and the allowlist refuses it
    'example\uff0ecom',
    // zero-width space hiding a domain
    'exa\u200bmple.com',
    'Jane\u200bDoe',
    // right-to-left override that would flip how the name reads
    'Jane \u202emoc.elpmaxe',
    'Jane\u2066Doe\u2069',
    'A'.repeat(61),
  ])('rejects %j', (name) => {
    expect(nameProblem(name)).not.toBeNull();
  });

  it('normalises compatibility characters and spacing', () => {
    expect(cleanName('  \uff2aane   Doe ')).toBe('Jane Doe');
  });

  it('refuses the same names on the public page', () => {
    for (const name of [
      'example\uff0ecom',
      'Jane \u202emoc.elpmaxe',
      'exa\u200bmple.com',
      'example.c0m',
    ]) {
      const params = new URLSearchParams({
        name,
        days: '25',
        date: '2026-12-25',
        id: 'AOD26-7K2M9X',
      });
      expect(parseCertificateParams(devops, params), name).toBeNull();
    }
  });
});

describe('public certificate URL', () => {
  it('round-trips through the query string', () => {
    const url = certificateUrl(devops, sample);
    expect(url.startsWith('https://devops-daily.com/advent-of-devops/certificate/view?')).toBe(
      true
    );
    expect(parseCertificateParams(devops, query(url))).toEqual(sample);
  });

  it('rejects missing or changed parts', () => {
    const good = new URLSearchParams({
      name: 'Jane Doe',
      days: '24',
      date: '2026-12-24',
      id: 'AOP26-ABCDEF',
    });
    expect(parseCertificateParams(postgres, good)).not.toBeNull();
    for (const [key, value] of [
      ['days', '25'],
      ['days', '0'],
      ['date', '2026-02-30'],
      ['date', '2030-01-01'],
      ['id', 'AOD26-ABCDEF'],
      ['name', 'https://x.test'],
    ]) {
      const bad = new URLSearchParams(good);
      bad.set(key, value);
      expect(parseCertificateParams(postgres, bad), `${key}=${value}`).toBeNull();
    }
  });

  it('formats the issue date in words', () => {
    expect(formatCertificateDate('2026-12-25')).toBe('25 December 2026');
  });
});

describe('LinkedIn links', () => {
  it('fills in the add-certification form', () => {
    const url = new URL(linkedInAddToProfileUrl(devops, sample));
    expect(url.origin + url.pathname).toBe('https://www.linkedin.com/profile/add');
    const p = url.searchParams;
    expect(p.get('startTask')).toBe('CERTIFICATION_NAME');
    expect(p.get('name')).toContain('Advent of DevOps 2026');
    expect(p.get('organizationId')).toBe('107370385');
    expect(p.get('issueYear')).toBe('2026');
    expect(p.get('issueMonth')).toBe('12');
    expect(p.get('certId')).toBe(sample.id);
    expect(p.get('certUrl')).toBe(certificateUrl(devops, sample));
  });

  it('shares the public certificate page', () => {
    const share = new URL(linkedInShareUrl(certificateUrl(devops, sample)));
    expect(share.searchParams.get('url')).toBe(certificateUrl(devops, sample));
  });

  it('suggests a post with the hashtag, the tag and the link', () => {
    const text = sharePostText(postgres, { ...sample, days: 24, id: 'AOP26-ABCDEF' });
    expect(text).toContain('#AdventOfPostgres');
    expect(text).toContain('@DevOps Daily');
    expect(text).toContain('https://devops-daily.com/advent-of-postgres/certificate/view?');
    expect(text).not.toMatch(/—/);
  });
});

describe('giveaway', () => {
  it('fits the entry details in an SMTPfast name field', () => {
    const details = entryDetails([
      { key: 'devops', id: 'AOD26-7K2M9X' },
      { key: 'postgres', id: 'AOP26-ABCDEF' },
    ]);
    expect(details).toBe('DevOps AOD26-7K2M9X; Postgres AOP26-ABCDEF');
    // SMTPfast refuses names over 100 characters or with links and addresses.
    expect(details.length).toBeLessThanOrEqual(100);
    expect(details).not.toMatch(/https?:\/\/|www\.|@|[<>]/i);
    expect(entryDetails([{ key: 'postgres' }])).toBe('Postgres');
  });

  it('closes after 31 December 23:59 UTC', () => {
    expect(isGiveawayOpen(new Date('2026-12-31T23:59:00Z'))).toBe(true);
    expect(isGiveawayOpen(new Date('2027-01-01T00:00:00Z'))).toBe(false);
  });
});
