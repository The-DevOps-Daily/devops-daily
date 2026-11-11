import { describe, expect, it } from 'vitest';
import {
  domainsAlign,
  evaluatePath,
  INITIAL_SETTINGS,
  organizationalDomain,
  PCT_SAMPLE_BUCKET,
  policyForFromDomain,
  type LabSettings,
} from '@/lib/games/email-auth-lab-engine';

function settings(change: Partial<LabSettings> = {}): LabSettings {
  return { ...INITIAL_SETTINGS, ...change };
}

describe('Email Authentication Lab engine', () => {
  it('checks SPF MAIL FROM against the connecting IP and keeps HELO out of the model', () => {
    const direct = evaluatePath(settings(), 'direct');
    expect(direct.mailFrom).toBe('bounce@esp.example');
    expect(direct.connectingIp).toBe('198.51.100.7');
    expect(direct.spf).toMatchObject({ result: 'pass', domain: 'esp.example' });
  });

  it('uses SPF none, softfail and permerror records, including the 10 lookup cap', () => {
    expect(
      evaluatePath(settings({ customMailFrom: true, spfRecord: 'none' }), 'direct').spf.result
    ).toBe('none');
    expect(
      evaluatePath(settings({ customMailFrom: true, spfRecord: 'esp-soft' }), 'direct').spf.result
    ).toBe('pass');
    expect(
      evaluatePath(settings({ customMailFrom: true, spfRecord: 'esp-soft' }), 'forwarded').spf
        .result
    ).toBe('softfail');
    const bad = evaluatePath(
      settings({ customMailFrom: true, spfRecord: 'too-many-includes' }),
      'direct'
    );
    expect(bad.spf.result).toBe('permerror');
    expect(bad.spf.reason).toContain('11');
    expect(bad.spf.reason).toContain('10');
  });

  it('fails SPF after forwarding without SRS', () => {
    const forwarded = evaluatePath(
      settings({ customMailFrom: true, spfRecord: 'esp-hard' }),
      'forwarded'
    );
    expect(forwarded.connectingIp).toBe('203.0.113.9');
    expect(forwarded.spf.result).toBe('fail');
    expect(forwarded.spf.reason).toContain('SRS');
  });

  it('requires the shop DKIM selector key and detects a list modification', () => {
    expect(evaluatePath(settings({ dkimDomain: 'shop.example' }), 'direct').dkim).toMatchObject({
      result: 'permerror',
      domain: 'shop.example',
    });
    const direct = evaluatePath(
      settings({ dkimDomain: 'shop.example', shopDkimKey: true }),
      'direct'
    );
    expect(direct.dkim.result).toBe('pass');
    expect(direct.dkim.reason).toContain('s1._domainkey.shop.example');
    const listed = evaluatePath(
      settings({ dkimDomain: 'shop.example', shopDkimKey: true }),
      'list'
    );
    expect(listed.dkim.result).toBe('fail');
    expect(listed.dkim.reason).toContain('Subject');
    expect(listed.dkim.reason).toContain('body');
  });

  it('uses relaxed organizational-domain and strict exact alignment for DMARC', () => {
    expect(organizationalDomain('bounce.shop.example')).toBe('shop.example');
    expect(domainsAlign('bounce.shop.example', 'shop.example', 'relaxed')).toBe(true);
    expect(domainsAlign('bounce.shop.example', 'shop.example', 'strict')).toBe(false);
    const relaxed = evaluatePath(
      settings({ customMailFrom: true, spfRecord: 'esp-hard', dmarcPolicy: 'none' }),
      'direct'
    );
    expect(relaxed.spf.aligned).toBe(true);
    expect(relaxed.dmarc.result).toBe('pass');
    const strict = evaluatePath(
      settings({
        customMailFrom: true,
        spfRecord: 'esp-hard',
        dmarcPolicy: 'none',
        aspf: 'strict',
      }),
      'direct'
    );
    expect(strict.spf.aligned).toBe(false);
    expect(strict.dmarc.result).toBe('fail');
  });

  it('uses sp for a visible subdomain and otherwise falls back to p', () => {
    expect(policyForFromDomain(settings({ dmarcPolicy: 'quarantine' }), 'news.shop.example')).toBe(
      'quarantine'
    );
    expect(
      policyForFromDomain(
        settings({ dmarcPolicy: 'quarantine', dmarcSubdomainPolicy: 'reject' }),
        'news.shop.example'
      )
    ).toBe('reject');
  });

  it('lets aligned DKIM pass DMARC through forwarding', () => {
    const verdict = evaluatePath(
      settings({ dkimDomain: 'shop.example', shopDkimKey: true, dmarcPolicy: 'reject' }),
      'forwarded'
    );
    expect(verdict.spf.result).toBe('fail');
    expect(verdict.dkim).toMatchObject({ result: 'pass', aligned: true });
    expect(verdict.dmarc.result).toBe('pass');
    expect(verdict.disposition).toBe('inbox');
  });

  it('applies none, quarantine and reject policy to failing mail and models pct deterministically', () => {
    const none = evaluatePath(settings({ dmarcPolicy: 'none' }), 'direct');
    expect(none.disposition).toBe('inbox');
    const quarantine = evaluatePath(settings({ dmarcPolicy: 'quarantine' }), 'direct');
    expect(quarantine.disposition).toBe('spam folder');
    const reject = evaluatePath(settings({ dmarcPolicy: 'reject' }), 'direct');
    expect(reject.disposition).toBe('rejected');
    const partial = evaluatePath(settings({ dmarcPolicy: 'reject', dmarcPct: 25 }), 'direct');
    expect(PCT_SAMPLE_BUCKET).toBeLessThanOrEqual(25);
    expect(partial.policyApplied).toContain('bucket');
    expect(partial.disposition).toBe('rejected');
  });

  it('uses the rewritten list From domain and its aligned list SPF to pass DMARC', () => {
    const withoutRewrite = evaluatePath(
      settings({ dmarcPolicy: 'reject', dkimDomain: 'shop.example', shopDkimKey: true }),
      'list'
    );
    expect(withoutRewrite.dkim.result).toBe('fail');
    expect(withoutRewrite.dmarc.result).toBe('fail');
    expect(withoutRewrite.disposition).toBe('rejected');
    const rewritten = evaluatePath(
      settings({ dmarcPolicy: 'reject', listFromRewrite: true }),
      'list'
    );
    expect(rewritten.headerFrom).toBe('list@lists.example');
    expect(rewritten.dmarcLookup).toBe('_dmarc.lists.example');
    expect(rewritten.spf).toMatchObject({ result: 'pass', aligned: true });
    expect(rewritten.dmarc.result).toBe('pass');
    expect(rewritten.disposition).toBe('inbox');
  });
});
