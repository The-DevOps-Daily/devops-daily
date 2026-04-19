'use client';

import { useMemo, useState } from 'react';

interface CidrResult {
  networkAddress: string;
  broadcast: string;
  firstUsable: string;
  lastUsable: string;
  usable: number;
  total: number;
  mask: string;
  prefix: number;
  wildcardMask: string;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const n = parseInt(part, 10);
    if (n < 0 || n > 255) return null;
    result = (result << 8) | n;
  }
  return result >>> 0;
}

function intToIpv4(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

function prefixToMask(prefix: number): number {
  if (prefix === 0) return 0;
  return (0xffffffff << (32 - prefix)) >>> 0;
}

function parseCidr(input: string): CidrResult | { error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { error: 'Enter a CIDR block, for example 10.0.0.0/16' };

  const [ipPart, prefixPart] = trimmed.split('/');
  if (!ipPart || !prefixPart) return { error: 'Missing "/" separator, example: 10.0.0.0/16' };

  const ipInt = ipv4ToInt(ipPart);
  if (ipInt === null) return { error: 'Invalid IPv4 address' };

  const prefix = parseInt(prefixPart, 10);
  if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) {
    return { error: 'Prefix must be between 0 and 32' };
  }

  const maskInt = prefixToMask(prefix);
  const networkInt = (ipInt & maskInt) >>> 0;
  const broadcastInt = (networkInt | (~maskInt >>> 0)) >>> 0;
  const total = prefix === 32 ? 1 : 2 ** (32 - prefix);
  const usable = prefix >= 31 ? total : total - 2;

  const firstUsableInt = prefix >= 31 ? networkInt : networkInt + 1;
  const lastUsableInt = prefix >= 31 ? broadcastInt : broadcastInt - 1;

  return {
    networkAddress: intToIpv4(networkInt),
    broadcast: intToIpv4(broadcastInt),
    firstUsable: intToIpv4(firstUsableInt),
    lastUsable: intToIpv4(lastUsableInt),
    usable,
    total,
    mask: intToIpv4(maskInt),
    prefix,
    wildcardMask: intToIpv4((~maskInt) >>> 0),
  };
}

function ipIsInRange(ip: string, result: CidrResult): boolean | null {
  const ipInt = ipv4ToInt(ip);
  if (ipInt === null) return null;
  const networkInt = ipv4ToInt(result.networkAddress);
  const broadcastInt = ipv4ToInt(result.broadcast);
  if (networkInt === null || broadcastInt === null) return null;
  return ipInt >= networkInt && ipInt <= broadcastInt;
}

interface RowProps {
  label: string;
  value: string | number;
  highlight?: boolean;
}

function Row({ label, value, highlight }: RowProps) {
  return (
    <div className="flex items-center justify-between border-b border-border last:border-b-0 px-4 py-3 font-mono text-sm">
      <span className="text-muted-foreground text-xs uppercase tracking-wider">{label}</span>
      <span className={`tabular-nums ${highlight ? 'text-primary font-semibold' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}

export function CidrCalculator() {
  const [cidr, setCidr] = useState('10.0.0.0/16');
  const [ipCheck, setIpCheck] = useState('');

  const result = useMemo(() => parseCidr(cidr), [cidr]);
  const inRange = useMemo(() => {
    if ('error' in result) return null;
    if (!ipCheck.trim()) return null;
    return ipIsInRange(ipCheck.trim(), result);
  }, [ipCheck, result]);

  return (
    <div className="space-y-6">
      {/* Input */}
      <div className="rounded-md border bg-card p-5">
        <label
          htmlFor="cidr-input"
          className="text-xs font-mono text-muted-foreground block mb-2"
        >
          // cidr block
        </label>
        <input
          id="cidr-input"
          type="text"
          value={cidr}
          onChange={(e) => setCidr(e.target.value)}
          placeholder="10.0.0.0/16"
          className="w-full bg-background border border-input px-3 py-2 rounded-md text-lg font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          autoComplete="off"
          spellCheck="false"
        />
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {['10.0.0.0/16', '172.16.0.0/12', '192.168.1.0/24', '10.0.1.0/30', '0.0.0.0/0'].map(
            (preset) => (
              <button
                key={preset}
                onClick={() => setCidr(preset)}
                className="font-mono tabular-nums text-muted-foreground hover:text-primary border border-border rounded px-2 py-0.5 transition-colors"
              >
                {preset}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Result */}
      {'error' in result ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/5 p-4 text-sm font-mono text-red-500">
          {result.error}
        </div>
      ) : (
        <div className="rounded-md border bg-card overflow-hidden">
          <Row label="Network address" value={result.networkAddress} highlight />
          <Row label="Broadcast address" value={result.broadcast} />
          <Row label="First usable" value={result.firstUsable} />
          <Row label="Last usable" value={result.lastUsable} />
          <Row label="Usable hosts" value={result.usable.toLocaleString()} highlight />
          <Row label="Total addresses" value={result.total.toLocaleString()} />
          <Row label="Subnet mask" value={result.mask} />
          <Row label="Wildcard mask" value={result.wildcardMask} />
          <Row label="Prefix length" value={`/${result.prefix}`} />
        </div>
      )}

      {/* IP-in-range checker */}
      {!('error' in result) && (
        <div className="rounded-md border bg-card p-5">
          <label
            htmlFor="ip-check"
            className="text-xs font-mono text-muted-foreground block mb-2"
          >
            // check if an IP is inside this network
          </label>
          <input
            id="ip-check"
            type="text"
            value={ipCheck}
            onChange={(e) => setIpCheck(e.target.value)}
            placeholder="10.0.5.42"
            className="w-full bg-background border border-input px-3 py-2 rounded-md font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            autoComplete="off"
            spellCheck="false"
          />
          {ipCheck.trim() && (
            <p className="mt-3 font-mono text-sm">
              {inRange === null ? (
                <span className="text-red-500">Invalid IP address</span>
              ) : inRange ? (
                <span className="text-green-500">
                  ✓ <span className="tabular-nums">{ipCheck}</span> is inside{' '}
                  <span className="tabular-nums">{cidr}</span>
                </span>
              ) : (
                <span className="text-amber-500">
                  ✗ <span className="tabular-nums">{ipCheck}</span> is outside{' '}
                  <span className="tabular-nums">{cidr}</span>
                </span>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
