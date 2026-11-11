export type SpfRecord = 'none' | 'esp-hard' | 'esp-soft' | 'too-many-includes';
export type DkimDomain = 'esp.example' | 'shop.example';
export type DmarcPolicy = 'none' | 'quarantine' | 'reject';
export type AlignmentMode = 'relaxed' | 'strict';
export type DeliveryPath = 'direct' | 'forwarded' | 'list';
export type AuthResult = 'pass' | 'fail' | 'softfail' | 'none' | 'permerror';
export type Disposition = 'inbox' | 'spam folder' | 'rejected';

export interface LabSettings {
  spfRecord: SpfRecord;
  dkimDomain: DkimDomain;
  shopDkimKey: boolean;
  customMailFrom: boolean;
  dmarcPolicy: DmarcPolicy | null;
  /** RFC 7489 sp= value for visible subdomains of shop.example, when published. */
  dmarcSubdomainPolicy: DmarcPolicy | null;
  dmarcPct: 100 | 25;
  aspf: AlignmentMode;
  adkim: AlignmentMode;
  listFromRewrite: boolean;
}

export interface AuthCheck {
  result: AuthResult;
  reason: string;
  domain: string;
  aligned: boolean;
}

export interface PathVerdict {
  path: DeliveryPath;
  label: string;
  connectingIp: string;
  mailFrom: string;
  headerFrom: string;
  dkimDomain: DkimDomain;
  spf: AuthCheck;
  dkim: AuthCheck;
  dmarc: AuthCheck;
  dmarcLookup: string;
  policyApplied: string;
  disposition: Disposition;
  listChangedMessage: boolean;
  fromRewritten: boolean;
}

export const SENDER_DOMAIN = 'shop.example';
export const ESP_DOMAIN = 'esp.example';
export const LIST_DOMAIN = 'lists.example';
export const ESP_IP = '198.51.100.7';
export const FORWARDER_IP = '203.0.113.9';
export const LIST_IP = '203.0.113.50';
export const PCT_SAMPLE_BUCKET = 17;
export const PCT_BUCKET_TOTAL = 100;
export const SPF_DNS_LOOKUP_LIMIT = 10;
export const DKIM_SELECTOR = 's1';
export const DMARC_PCT_OPTIONS = [100, 25] as const;

export const INITIAL_SETTINGS: LabSettings = {
  spfRecord: 'none',
  dkimDomain: 'esp.example',
  shopDkimKey: false,
  customMailFrom: false,
  dmarcPolicy: null,
  dmarcSubdomainPolicy: null,
  dmarcPct: 100,
  aspf: 'relaxed',
  adkim: 'relaxed',
  listFromRewrite: false,
};

export const SPF_RECORD_LABELS: Record<SpfRecord, string> = {
  none: 'No TXT record',
  'esp-hard': 'v=spf1 include:_spf.esp.example -all',
  'esp-soft': 'v=spf1 include:_spf.esp.example ~all',
  'too-many-includes': 'v=spf1 include:a ... include:k -all (11 includes)',
};

export function domainOf(address: string): string {
  return address.slice(address.lastIndexOf('@') + 1);
}

/** This lab uses the last two labels as a small, explicit organizational-domain model. */
export function organizationalDomain(domain: string): string {
  return domain.split('.').slice(-2).join('.');
}

export function domainsAlign(left: string, right: string, mode: AlignmentMode): boolean {
  return mode === 'strict'
    ? left === right
    : organizationalDomain(left) === organizationalDomain(right);
}

function pathData(settings: LabSettings, path: DeliveryPath) {
  const originalMailFrom = settings.customMailFrom
    ? 'bounce@bounce.shop.example'
    : 'bounce@esp.example';
  if (path === 'direct') {
    return {
      label: 'Direct',
      connectingIp: ESP_IP,
      mailFrom: originalMailFrom,
      headerFrom: 'orders@shop.example',
      changed: false,
    };
  }
  if (path === 'forwarded') {
    return {
      label: 'Forwarded',
      connectingIp: FORWARDER_IP,
      mailFrom: originalMailFrom,
      headerFrom: 'orders@shop.example',
      changed: false,
    };
  }
  return {
    label: 'Mailing list',
    connectingIp: LIST_IP,
    mailFrom: 'owner-list@lists.example',
    headerFrom: settings.listFromRewrite ? 'list@lists.example' : 'orders@shop.example',
    changed: true,
  };
}

function evaluateSpf(settings: LabSettings, path: DeliveryPath, mailFrom: string): AuthCheck {
  const domain = domainOf(mailFrom);
  const isList = domain === LIST_DOMAIN;
  const connectingIp = pathData(settings, path).connectingIp;
  if (isList) {
    return {
      result: connectingIp === LIST_IP ? 'pass' : 'fail',
      reason: 'lists.example authorizes its list server at 203.0.113.50.',
      domain,
      aligned: false,
    };
  }
  if (path === 'forwarded') {
    if (domain === ESP_DOMAIN) {
      return {
        result: 'fail',
        reason:
          'esp.example authorizes only its own servers, and the university forwarder at 203.0.113.9 did not use SRS.',
        domain,
        aligned: false,
      };
    }
    if (settings.spfRecord === 'none') {
      return { result: 'none', reason: 'No SPF TXT record is published.', domain, aligned: false };
    }
    if (settings.spfRecord === 'too-many-includes') {
      return {
        result: 'permerror',
        reason: `11 DNS-querying include mechanisms exceed SPF’s limit of ${SPF_DNS_LOOKUP_LIMIT}.`,
        domain,
        aligned: false,
      };
    }
    return {
      result: settings.spfRecord === 'esp-soft' ? 'softfail' : 'fail',
      reason:
        settings.spfRecord === 'esp-soft'
          ? 'The university forwarder at 203.0.113.9 is not authorized, so ~all softfails without SRS.'
          : 'The university forwarder at 203.0.113.9 is not authorized and did not use SRS, so -all fails.',
      domain,
      aligned: false,
    };
  }
  if (domain === ESP_DOMAIN) {
    return {
      result: 'pass',
      reason: 'esp.example authorizes its ESP at 198.51.100.7.',
      domain,
      aligned: false,
    };
  }
  if (settings.spfRecord === 'none') {
    return { result: 'none', reason: 'No SPF TXT record is published.', domain, aligned: false };
  }
  if (settings.spfRecord === 'too-many-includes') {
    return {
      result: 'permerror',
      reason: `11 DNS-querying include mechanisms exceed SPF’s limit of ${SPF_DNS_LOOKUP_LIMIT}.`,
      domain,
      aligned: false,
    };
  }
  return {
    result: 'pass',
    reason: `${SPF_RECORD_LABELS[settings.spfRecord]} authorizes the ESP at 198.51.100.7.`,
    domain,
    aligned: false,
  };
}

function evaluateDkim(settings: LabSettings, path: DeliveryPath): AuthCheck {
  const domain = settings.dkimDomain;
  if (domain === SENDER_DOMAIN && !settings.shopDkimKey) {
    return {
      result: 'permerror',
      reason: `No key is published at ${DKIM_SELECTOR}._domainkey.shop.example, so the signature cannot be verified (permerror).`,
      domain,
      aligned: false,
    };
  }
  if (path === 'list') {
    return {
      result: 'fail',
      reason: 'The list changed the signed Subject and body with its tag and footer.',
      domain,
      aligned: false,
    };
  }
  return {
    result: 'pass',
    reason: `The body and signed Subject and From headers match ${DKIM_SELECTOR}._domainkey.${domain}.`,
    domain,
    aligned: false,
  };
}

function nextLessStrict(policy: DmarcPolicy): DmarcPolicy {
  return policy === 'reject' ? 'quarantine' : 'none';
}

function effectivePolicy(policy: DmarcPolicy, pct: 100 | 25): DmarcPolicy {
  if (pct === 100 || PCT_SAMPLE_BUCKET <= pct) return policy;
  return nextLessStrict(policy);
}

function policyLabel(policy: DmarcPolicy | null, pct: 100 | 25, passed: boolean): string {
  if (policy === null) return 'No DMARC record';
  if (passed) return `p=${policy}; no failure policy needed`;
  const applied = effectivePolicy(policy, pct);
  if (pct === 100) return `p=${applied} applies to this failure`;
  return `p=${policy}; bucket ${PCT_SAMPLE_BUCKET}/${PCT_BUCKET_TOTAL} gets ${applied}`;
}

function dispositionFor(
  policy: DmarcPolicy | null,
  dmarcPass: boolean,
  pct: 100 | 25
): Disposition {
  if (dmarcPass || policy === null) return 'inbox';
  const applied = effectivePolicy(policy, pct);
  if (applied === 'reject') return 'rejected';
  if (applied === 'quarantine') return 'spam folder';
  return 'inbox';
}

/** Applies p= at the exact domain and sp= below the From organizational domain. */
export function policyForFromDomain(settings: LabSettings, fromDomain: string): DmarcPolicy | null {
  if (fromDomain === LIST_DOMAIN) return 'none';
  if (fromDomain === SENDER_DOMAIN) return settings.dmarcPolicy;
  if (fromDomain.endsWith(`.${SENDER_DOMAIN}`)) {
    return settings.dmarcSubdomainPolicy ?? settings.dmarcPolicy;
  }
  return null;
}

export function evaluatePath(settings: LabSettings, path: DeliveryPath): PathVerdict {
  const data = pathData(settings, path);
  const fromDomain = domainOf(data.headerFrom);
  const spf = evaluateSpf(settings, path, data.mailFrom);
  const dkim = evaluateDkim(settings, path);
  const spfAligned = spf.result === 'pass' && domainsAlign(spf.domain, fromDomain, settings.aspf);
  const dkimAligned =
    dkim.result === 'pass' && domainsAlign(dkim.domain, fromDomain, settings.adkim);
  spf.aligned = spfAligned;
  dkim.aligned = dkimAligned;
  const policy = policyForFromDomain(settings, fromDomain);
  const dmarcLookup = `_dmarc.${fromDomain}`;
  const dmarcPass = spfAligned || dkimAligned;
  const dmarc: AuthCheck =
    policy === null
      ? {
          result: 'none',
          reason: 'No DMARC record is published for the visible From domain.',
          domain: fromDomain,
          aligned: false,
        }
      : dmarcPass
        ? {
            result: 'pass',
            reason: spfAligned ? 'Aligned SPF passes DMARC.' : 'Aligned DKIM passes DMARC.',
            domain: fromDomain,
            aligned: true,
          }
        : {
            result: 'fail',
            reason: 'Neither SPF nor DKIM both passed and aligned with the visible From domain.',
            domain: fromDomain,
            aligned: false,
          };
  return {
    path,
    label: data.label,
    connectingIp: data.connectingIp,
    mailFrom: data.mailFrom,
    headerFrom: data.headerFrom,
    dkimDomain: settings.dkimDomain,
    spf,
    dkim,
    dmarc,
    dmarcLookup,
    policyApplied: policyLabel(policy, settings.dmarcPct, dmarc.result === 'pass'),
    disposition: dispositionFor(policy, dmarc.result === 'pass', settings.dmarcPct),
    listChangedMessage: data.changed,
    fromRewritten: path === 'list' && settings.listFromRewrite,
  };
}

export function evaluateAllPaths(settings: LabSettings): PathVerdict[] {
  return ['direct', 'forwarded', 'list'].map((path) => evaluatePath(settings, path));
}

export function countPassingDmarc(settings: LabSettings): number {
  return evaluateAllPaths(settings).filter((verdict) => verdict.dmarc.result === 'pass').length;
}
