'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Binary Byte Simulator.
 *
 * A hands-on model of a byte, modelled on the wooden flip-tile demonstrators
 * used in computing museums: eight tiles, each one a bit, each flipped by hand.
 *
 * The reason it belongs on a DevOps site rather than being a generic binary
 * converter is the three modes. The same eight tiles become a byte, a chmod
 * permission set, and a subnet mask, which are the three places an engineer
 * actually meets binary. Flipping the bit that turns 644 into 646 teaches more
 * than reading a table of octal values.
 *
 * Styling is scoped under `.bytesim` (classes prefixed `bs-`) so it does not
 * collide with the site's global Tailwind layer.
 */

type Mode = 'byte' | 'perms' | 'subnet';

const WIDTH: Record<Mode, number> = { byte: 8, perms: 9, subnet: 32 };

interface Challenge {
  prompt: string;
  /** Target bit string, same length as the mode width. */
  target: string;
  /** Shown once solved: why this value matters in practice. */
  note: string;
}

const CHALLENGES: Record<Mode, Challenge[]> = {
  byte: [
    {
      prompt: 'Make 42',
      target: '00101010',
      note: '42 is 32 + 8 + 2. Every number is just the lit place values added up.',
    },
    {
      prompt: 'Make 255',
      target: '11111111',
      note: 'All eight bits lit. This is why a byte tops out at 255, and why colour channels and IPv4 octets do too.',
    },
    {
      prompt: 'Make 128',
      target: '10000000',
      note: 'One bit, the highest. In a signed byte this bit is the sign, which is how 128 becomes -128.',
    },
    {
      prompt: 'Make 7',
      target: '00000111',
      note: 'Three low bits. Notice 7 is one less than 8, so it fills every bit below it. That pattern is why masks are written as 2^n - 1.',
    },
  ],
  perms: [
    {
      prompt: 'Make 755',
      target: '111101101',
      note: 'The default for a directory or a script: the owner can do everything, everyone else can read and execute but not write.',
    },
    {
      prompt: 'Make 644',
      target: '110100100',
      note: 'The default for a normal file. Owner reads and writes, everyone else only reads.',
    },
    {
      prompt: 'Make 600',
      target: '110000000',
      note: 'Owner only. This is what an SSH private key needs, and why ssh refuses a key that is readable by anyone else.',
    },
    {
      prompt: 'Make 777',
      target: '111111111',
      note: 'Everything to everyone. It fixes your permission error and opens a hole. If you reached for this in production, the real answer is usually correct ownership.',
    },
  ],
  subnet: [
    {
      prompt: 'Make a /24 mask',
      target: '11111111111111111111111100000000',
      note: '255.255.255.0. Three octets of network, one of host, so 254 usable addresses. The most common subnet you will meet.',
    },
    {
      prompt: 'Make a /26 mask',
      target: '11111111111111111111111111000000',
      note: '255.255.255.192. Borrowing two host bits splits a /24 into four subnets of 62 usable addresses each.',
    },
    {
      prompt: 'Make a /30 mask',
      target: '11111111111111111111111111111100',
      note: '255.255.255.252. Two usable addresses, which is exactly what a point-to-point link between two routers needs.',
    },
    {
      prompt: 'Make a /16 mask',
      target: '11111111111111110000000000000000',
      note: '255.255.0.0. A large private range, the shape of 10.0.0.0/16 or a default VPC in some clouds.',
    },
  ],
};

const PERM_LETTERS = ['r', 'w', 'x'] as const;
const PERM_GROUPS = ['owner', 'group', 'other'] as const;

function bitsToNumber(bits: string): number {
  return parseInt(bits, 2) || 0;
}

function numberToBits(n: number, width: number): string {
  const max = 2 ** width - 1;
  const clamped = ((n % (max + 1)) + max + 1) % (max + 1);
  return clamped.toString(2).padStart(width, '0');
}

/** A subnet mask is only valid when the ones are contiguous from the left. */
function isContiguousMask(bits: string): boolean {
  return /^1*0*$/.test(bits);
}

function toOctets(bits: string): number[] {
  return [0, 1, 2, 3].map((i) => bitsToNumber(bits.slice(i * 8, i * 8 + 8)));
}

function permOctal(bits: string): string {
  return [0, 1, 2].map((g) => bitsToNumber(bits.slice(g * 3, g * 3 + 3))).join('');
}

function permSymbolic(bits: string): string {
  return bits
    .split('')
    .map((b, i) => (b === '1' ? PERM_LETTERS[i % 3] : '-'))
    .join('');
}

export default function BinaryByteSimulator() {
  const [mode, setMode] = useState<Mode>('byte');
  const [bits, setBits] = useState<string>('0'.repeat(8));
  const [changed, setChanged] = useState<Set<number>>(new Set());
  const [counting, setCounting] = useState(false);
  const [challengeIdx, setChallengeIdx] = useState(0);
  const [showChallenge, setShowChallenge] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const tileRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const width = WIDTH[mode];
  const challenge = CHALLENGES[mode][challengeIdx];
  const solved = showChallenge && bits === challenge.target;

  // Switching mode resets the board to that mode's width.
  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    setBits('0'.repeat(WIDTH[next]));
    setChanged(new Set());
    setCounting(false);
    setChallengeIdx(0);
    setShowChallenge(false);
  }, []);

  // Apply a new bit string and flash whichever tiles actually moved, which is
  // what makes a carry legible when counting.
  const applyBits = useCallback((next: string) => {
    setBits((prev) => {
      const moved = new Set<number>();
      for (let i = 0; i < next.length; i++) {
        if (prev[i] !== next[i]) moved.add(i);
      }
      setChanged(moved);
      return next;
    });
  }, []);

  const toggleBit = useCallback(
    (i: number) => {
      const arr = bits.split('');
      arr[i] = arr[i] === '1' ? '0' : '1';
      applyBits(arr.join(''));
    },
    [bits, applyBits]
  );

  const value = bitsToNumber(bits);

  const step = useCallback(
    (delta: number) => {
      applyBits(numberToBits(bitsToNumber(bits) + delta, width));
    },
    [bits, width, applyBits]
  );

  // Counting is where the physical device earns its keep: you watch the carry
  // ripple along the tiles instead of being told about it.
  useEffect(() => {
    if (!counting) return;
    const t = setTimeout(() => step(1), 420);
    return () => clearTimeout(t);
  }, [counting, bits, step]);

  // The flash is decorative, so clear it shortly after it lands.
  useEffect(() => {
    if (changed.size === 0) return;
    const t = setTimeout(() => setChanged(new Set()), 380);
    return () => clearTimeout(t);
  }, [changed]);

  const copy = useCallback((text: string, key: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1200);
    });
  }, []);

  const onTileKey = useCallback(
    (e: React.KeyboardEvent, i: number) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const next = e.key === 'ArrowRight' ? Math.min(i + 1, width - 1) : Math.max(i - 1, 0);
        tileRefs.current[next]?.focus();
      }
    },
    [width]
  );

  const renderTile = useCallback(
    (i: number, b: string) => {
      const on = b === '1';
      const place =
        mode === 'byte'
          ? String(2 ** (width - 1 - i))
          : mode === 'perms'
            ? PERM_LETTERS[i % 3]
            : String(2 ** (7 - (i % 8)));
      return (
        <button
          key={i}
          ref={(el) => {
            tileRefs.current[i] = el;
          }}
          className={'bs-tile' + (on ? ' bs-lit' : '') + (changed.has(i) ? ' bs-flash' : '')}
          onClick={() => toggleBit(i)}
          onKeyDown={(e) => onTileKey(e, i)}
          aria-label={`Bit ${i + 1}, place value ${place}, currently ${b}`}
          aria-pressed={on}
        >
          <span className="bs-place">{place}</span>
          <span className="bs-digit">{b}</span>
        </button>
      );
    },
    [mode, width, changed, toggleBit, onTileKey]
  );

  const octets = useMemo(() => (mode === 'subnet' ? toOctets(bits) : []), [mode, bits]);
  const prefixLen = useMemo(() => (bits.match(/^1*/)?.[0].length ?? 0), [bits]);
  const maskValid = mode !== 'subnet' || isContiguousMask(bits);

  return (
    <div className="bytesim">
      <style>{CSS}</style>

      <p className="bs-eyebrow">Binary · one bit at a time</p>
      <h2 className="bs-h">Flip the bits, watch the value</h2>
      <p className="bs-sub">
        Eight tiles, each one a bit. Click one to flip it, or press <kbd className="bs-kbd">Space</kbd>{' '}
        on a focused tile. The same tiles become a byte, a set of file permissions, and a subnet mask.
      </p>

      <div className="bs-modes" role="tablist" aria-label="Simulator mode">
        {(
          [
            ['byte', 'Byte', '8 bits'],
            ['perms', 'Permissions', 'chmod'],
            ['subnet', 'Subnet mask', 'CIDR'],
          ] as Array<[Mode, string, string]>
        ).map(([m, label, hint]) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            className={`bs-mode${mode === m ? ' bs-on' : ''}`}
            onClick={() => switchMode(m)}
          >
            <span className="bs-modelabel">{label}</span>
            <span className="bs-modehint">{hint}</span>
          </button>
        ))}
      </div>

      {/* ---------- readout ---------- */}
      <div className="bs-readout">
        {mode === 'byte' && (
          <>
            <div className="bs-big">
              <span className="bs-bigval">{value}</span>
              <span className="bs-biglabel">decimal</span>
            </div>
            <div className="bs-side">
              <button className="bs-chip" onClick={() => copy(`0x${value.toString(16).toUpperCase().padStart(2, '0')}`, 'hex')}>
                <span className="bs-chipk">hex</span>
                <span className="bs-chipv">0x{value.toString(16).toUpperCase().padStart(2, '0')}</span>
                <span className="bs-copy">{copied === 'hex' ? 'copied' : 'copy'}</span>
              </button>
              <button className="bs-chip" onClick={() => copy(bits, 'bin')}>
                <span className="bs-chipk">binary</span>
                <span className="bs-chipv">{bits}</span>
                <span className="bs-copy">{copied === 'bin' ? 'copied' : 'copy'}</span>
              </button>
              <div className="bs-chip bs-static">
                <span className="bs-chipk">as maths</span>
                <span className="bs-chipv bs-sum">
                  {value === 0
                    ? '0'
                    : bits
                        .split('')
                        .map((b, i) => (b === '1' ? 2 ** (width - 1 - i) : null))
                        .filter(Boolean)
                        .join(' + ')}
                </span>
              </div>
            </div>
          </>
        )}

        {mode === 'perms' && (
          <>
            <div className="bs-big">
              <span className="bs-bigval">{permOctal(bits)}</span>
              <span className="bs-biglabel">octal</span>
            </div>
            <div className="bs-side">
              <button className="bs-chip" onClick={() => copy(`chmod ${permOctal(bits)} file.sh`, 'chmod')}>
                <span className="bs-chipk">command</span>
                <span className="bs-chipv">chmod {permOctal(bits)} file.sh</span>
                <span className="bs-copy">{copied === 'chmod' ? 'copied' : 'copy'}</span>
              </button>
              <div className="bs-chip bs-static">
                <span className="bs-chipk">ls -l</span>
                <span className="bs-chipv">-{permSymbolic(bits)}</span>
              </div>
              <div className="bs-chip bs-static">
                <span className="bs-chipk">meaning</span>
                <span className="bs-chipv bs-sum">
                  {PERM_GROUPS.map((g, gi) => {
                    const grp = bits.slice(gi * 3, gi * 3 + 3);
                    const words = ['read', 'write', 'execute'].filter((_, i) => grp[i] === '1');
                    return `${g}: ${words.length ? words.join(', ') : 'nothing'}`;
                  }).join(' · ')}
                </span>
              </div>
            </div>
          </>
        )}

        {mode === 'subnet' && (
          <>
            <div className="bs-big">
              <span className="bs-bigval bs-small">{octets.join('.')}</span>
              <span className="bs-biglabel">subnet mask</span>
            </div>
            <div className="bs-side">
              <div className={`bs-chip bs-static${maskValid ? '' : ' bs-bad'}`}>
                <span className="bs-chipk">prefix</span>
                <span className="bs-chipv">{maskValid ? `/${prefixLen}` : 'invalid'}</span>
              </div>
              <div className="bs-chip bs-static">
                <span className="bs-chipk">usable hosts</span>
                <span className="bs-chipv">
                  {maskValid
                    ? prefixLen >= 31
                      ? prefixLen === 32
                        ? '0 (a single host route)'
                        : '2 (a point-to-point link)'
                      : (2 ** (32 - prefixLen) - 2).toLocaleString()
                    : '—'}
                </span>
              </div>
              {!maskValid && (
                <div className="bs-warn">
                  A mask has to be a solid run of 1s from the left. You have a gap, so this is not a
                  usable subnet mask. That rule is why masks are written as <b>/{prefixLen}</b> rather
                  than as an arbitrary pattern.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ---------- the tiles ---------- */}
      <div className={`bs-board bs-board-${mode}`}>
        {mode === 'perms' && (
          <div className="bs-groups">
            {PERM_GROUPS.map((g) => (
              <span key={g} className="bs-group">
                {g}
              </span>
            ))}
          </div>
        )}
        {mode === 'subnet' && (
          <div className="bs-groups bs-groups-4">
            {[1, 2, 3, 4].map((n) => (
              <span key={n} className="bs-group">
                octet {n}
              </span>
            ))}
          </div>
        )}

        {/* Subnet renders as four separate octet grids so the tiles line up
            under their labels and the row never overflows its container. */}
        {mode === 'subnet' ? (
          <div className="bs-octets">
            {[0, 1, 2, 3].map((o) => (
              <div key={o} className="bs-octet">
                {bits
                  .slice(o * 8, o * 8 + 8)
                  .split('')
                  .map((b, j) => renderTile(o * 8 + j, b))}
              </div>
            ))}
          </div>
        ) : (
          <div className={`bs-tiles bs-tiles-${mode}`}>
            {bits.split('').map((b, i) => renderTile(i, b))}
          </div>
        )}
      </div>

      {/* ---------- controls ---------- */}
      <div className="bs-controls">
        <button className="bs-btn" onClick={() => applyBits('0'.repeat(width))}>
          Clear
        </button>
        <button className="bs-btn" onClick={() => applyBits('1'.repeat(width))}>
          Fill
        </button>
        <button
          className="bs-btn"
          onClick={() =>
            applyBits(
              Array.from({ length: width }, () => (Math.random() < 0.5 ? '0' : '1')).join('')
            )
          }
        >
          Random
        </button>
        <span className="bs-sep" />
        <button className="bs-btn" onClick={() => step(-1)} aria-label="Subtract one">
          &minus;1
        </button>
        <button className="bs-btn" onClick={() => step(1)} aria-label="Add one">
          +1
        </button>
        <button
          className={`bs-btn${counting ? ' bs-on' : ''}`}
          onClick={() => setCounting((c) => !c)}
        >
          {counting ? 'Stop' : 'Count up'}
        </button>
        <span className="bs-sep" />
        <button
          className="bs-btn"
          onClick={() => applyBits(bits.slice(1) + '0')}
          title="Shift left, which doubles the value"
        >
          &laquo; Shift
        </button>
        <button
          className="bs-btn"
          onClick={() => applyBits('0' + bits.slice(0, -1))}
          title="Shift right, which halves the value"
        >
          Shift &raquo;
        </button>
      </div>

      <p className="bs-hint">
        Press <b>Count up</b> and watch the carry travel. A tile can only show 0 or 1, so when it is
        already 1 and has to grow, it flips back to 0 and pushes the carry to its neighbour. That is
        the whole of binary arithmetic.
      </p>

      {/* ---------- challenge ---------- */}
      <div className={`bs-challenge${solved ? ' bs-solved' : ''}`}>
        <div className="bs-chtop">
          <div>
            <span className="bs-chlabel">Challenge</span>
            <span className="bs-chprompt">{challenge.prompt}</span>
          </div>
          <div className="bs-chactions">
            {!showChallenge ? (
              <button className="bs-btn bs-primary" onClick={() => setShowChallenge(true)}>
                Start
              </button>
            ) : (
              <>
                <button
                  className="bs-btn"
                  onClick={() => {
                    setChallengeIdx((i) => (i + 1) % CHALLENGES[mode].length);
                    applyBits('0'.repeat(width));
                  }}
                >
                  Next &rsaquo;
                </button>
                <button className="bs-btn" onClick={() => setShowChallenge(false)}>
                  Exit
                </button>
              </>
            )}
          </div>
        </div>
        {showChallenge && (
          <div className="bs-chbody">
            {solved ? (
              <p className="bs-chnote">
                <b>Solved.</b> {challenge.note}
              </p>
            ) : (
              <p className="bs-chnote bs-chwait">
                Set the tiles to match, and this panel will tell you why the value matters.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const CSS = `
.bytesim {
  --bs-ground: #0a0d14; --bs-panel: #121824; --bs-panel2: #161d2c; --bs-line: #263144;
  --bs-ink: #e8edf6; --bs-muted: #8b96ab; --bs-faint: #5b6577;
  --bs-accent: #f2b043; --bs-accent2: #ffcf7a; --bs-good: #46d888; --bs-bad: #fb7185;
  --bs-mono: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
  background: radial-gradient(900px 440px at 72% -12%, #17203233, transparent 60%), var(--bs-ground);
  border: 1px solid var(--bs-line); border-radius: 16px; padding: 26px 24px 28px;
  color: var(--bs-ink); max-width: 1060px; margin: 0 auto;
}
.bytesim * { box-sizing: border-box; }
.bytesim .bs-eyebrow { font-family: var(--bs-mono); font-size: 12px; letter-spacing: .16em; text-transform: uppercase; color: var(--bs-accent); margin: 0 0 8px; }
.bytesim .bs-h { font-family: var(--bs-mono); font-weight: 600; font-size: clamp(20px, 3vw, 28px); letter-spacing: -.01em; margin: 0 0 10px; color: var(--bs-ink); }
.bytesim .bs-sub { margin: 0 0 18px; font-size: 13.5px; color: var(--bs-muted); max-width: 68ch; line-height: 1.6; }
.bytesim .bs-kbd { font-family: var(--bs-mono); font-size: 11px; background: var(--bs-panel2); border: 1px solid var(--bs-line); border-bottom-width: 2px; border-radius: 5px; padding: 1px 5px; color: var(--bs-ink); }

.bytesim .bs-modes { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
.bytesim .bs-mode { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; background: var(--bs-panel); border: 1px solid var(--bs-line); border-radius: 10px; padding: 9px 14px; cursor: pointer; transition: border-color .18s, background .18s, transform .18s; }
.bytesim .bs-mode:hover { border-color: var(--bs-faint); transform: translateY(-1px); }
.bytesim .bs-mode.bs-on { border-color: var(--bs-accent); background: #f2b0431a; }
.bytesim .bs-modelabel { font-size: 13.5px; font-weight: 600; color: var(--bs-ink); }
.bytesim .bs-modehint { font-family: var(--bs-mono); font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: var(--bs-faint); }
.bytesim .bs-mode.bs-on .bs-modehint { color: var(--bs-accent); }

.bytesim .bs-readout { display: grid; grid-template-columns: minmax(180px, 260px) 1fr; gap: 16px; align-items: center; background: var(--bs-panel); border: 1px solid var(--bs-line); border-radius: 14px; padding: 16px 18px; margin-bottom: 20px; }
.bytesim .bs-big { display: flex; flex-direction: column; gap: 2px; }
.bytesim .bs-bigval { font-family: var(--bs-mono); font-size: clamp(38px, 7vw, 58px); font-weight: 700; line-height: 1; color: var(--bs-accent); letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.bytesim .bs-bigval.bs-small { font-size: clamp(20px, 3.4vw, 30px); }
.bytesim .bs-biglabel { font-family: var(--bs-mono); font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--bs-faint); }
.bytesim .bs-side { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.bytesim .bs-chip { display: grid; grid-template-columns: 88px 1fr auto; align-items: center; gap: 10px; text-align: left; background: var(--bs-panel2); border: 1px solid var(--bs-line); border-radius: 8px; padding: 7px 11px; cursor: pointer; transition: border-color .18s; width: 100%; }
.bytesim button.bs-chip:hover { border-color: var(--bs-accent); }
.bytesim .bs-chip.bs-static { cursor: default; }
.bytesim .bs-chip.bs-bad { border-color: var(--bs-bad); }
.bytesim .bs-chipk { font-family: var(--bs-mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--bs-faint); }
.bytesim .bs-chipv { font-family: var(--bs-mono); font-size: 13px; color: var(--bs-ink); overflow-wrap: anywhere; }
.bytesim .bs-chip.bs-bad .bs-chipv { color: var(--bs-bad); }
.bytesim .bs-sum { font-size: 12px; color: var(--bs-muted); }
.bytesim .bs-copy { font-family: var(--bs-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--bs-faint); opacity: 0; transition: opacity .18s; }
.bytesim button.bs-chip:hover .bs-copy { opacity: 1; }
.bytesim .bs-warn { font-size: 12.5px; line-height: 1.55; color: var(--bs-muted); background: #fb718514; border: 1px solid #fb718544; border-radius: 8px; padding: 9px 11px; }
.bytesim .bs-warn b { color: var(--bs-ink); font-family: var(--bs-mono); }

.bytesim .bs-board { background: var(--bs-panel); border: 1px solid var(--bs-line); border-radius: 14px; padding: 16px 14px; margin-bottom: 16px; overflow-x: auto; }
.bytesim .bs-groups { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 9px; min-width: 420px; }
.bytesim .bs-groups-4 { grid-template-columns: repeat(4, 1fr); min-width: 660px; }
.bytesim .bs-group { font-family: var(--bs-mono); font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--bs-faint); text-align: center; }
.bytesim .bs-tiles { display: grid; gap: 8px; min-width: 420px; }
.bytesim .bs-tiles-byte { grid-template-columns: repeat(8, 1fr); }
.bytesim .bs-tiles-perms { grid-template-columns: repeat(9, 1fr); }
.bytesim .bs-octets { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; min-width: 660px; }
.bytesim .bs-octet { display: grid; grid-template-columns: repeat(8, 1fr); gap: 3px; }

.bytesim .bs-tile { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; aspect-ratio: 3 / 4; background: linear-gradient(180deg, #1b2333, #141a27); border: 1px solid var(--bs-line); border-radius: 9px; cursor: pointer; padding: 6px 2px; transition: background .22s, border-color .22s, transform .18s, box-shadow .22s; }
.bytesim .bs-tile:hover { transform: translateY(-2px); border-color: var(--bs-faint); }
.bytesim .bs-tile:focus-visible { outline: 2px solid var(--bs-accent); outline-offset: 2px; }
.bytesim .bs-tile.bs-lit { background: linear-gradient(180deg, #f2b043, #d2912c); border-color: #ffd489; box-shadow: 0 0 0 1px #ffd48955, 0 10px 26px -12px #f2b043; }
.bytesim .bs-place { font-family: var(--bs-mono); font-size: 9.5px; letter-spacing: .04em; color: var(--bs-faint); }
.bytesim .bs-tile.bs-lit .bs-place { color: #7a4f08; }
.bytesim .bs-digit { font-family: var(--bs-mono); font-size: clamp(15px, 2.6vw, 26px); font-weight: 700; line-height: 1; color: var(--bs-muted); }
.bytesim .bs-tile.bs-lit .bs-digit { color: #2a1a02; }
.bytesim .bs-octet .bs-place { font-size: 7.5px; }
.bytesim .bs-octet .bs-digit { font-size: 12px; }
.bytesim .bs-octet .bs-tile { border-radius: 5px; padding: 4px 0; gap: 2px; }
@keyframes bs-flip { 0% { transform: rotateX(0deg); } 50% { transform: rotateX(78deg); } 100% { transform: rotateX(0deg); } }
.bytesim .bs-tile.bs-flash { animation: bs-flip .34s ease; }

.bytesim .bs-controls { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; margin-bottom: 12px; }
.bytesim .bs-btn { font-family: var(--bs-mono); font-size: 12.5px; color: var(--bs-ink); background: var(--bs-panel); border: 1px solid var(--bs-line); border-radius: 8px; padding: 7px 12px; cursor: pointer; transition: border-color .18s, background .18s, transform .18s; }
.bytesim .bs-btn:hover { border-color: var(--bs-accent); transform: translateY(-1px); }
.bytesim .bs-btn.bs-on { border-color: var(--bs-accent); background: #f2b0431f; color: var(--bs-accent2); }
.bytesim .bs-btn.bs-primary { border-color: var(--bs-accent); background: #f2b04324; color: var(--bs-accent2); }
.bytesim .bs-sep { width: 1px; height: 20px; background: var(--bs-line); margin: 0 4px; }
.bytesim .bs-hint { margin: 0 0 20px; font-size: 12.5px; line-height: 1.6; color: var(--bs-muted); max-width: 74ch; }
.bytesim .bs-hint b { color: var(--bs-ink); }

.bytesim .bs-challenge { background: var(--bs-panel); border: 1px solid var(--bs-line); border-radius: 12px; padding: 14px 16px; transition: border-color .25s, background .25s; }
.bytesim .bs-challenge.bs-solved { border-color: var(--bs-good); background: #46d8880f; }
.bytesim .bs-chtop { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.bytesim .bs-chlabel { display: block; font-family: var(--bs-mono); font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--bs-faint); margin-bottom: 3px; }
.bytesim .bs-chprompt { font-size: 15px; font-weight: 600; color: var(--bs-ink); }
.bytesim .bs-chactions { display: flex; gap: 7px; }
.bytesim .bs-chbody { margin-top: 11px; padding-top: 11px; border-top: 1px solid var(--bs-line); }
.bytesim .bs-chnote { margin: 0; font-size: 13px; line-height: 1.6; color: var(--bs-muted); }
.bytesim .bs-chnote b { color: var(--bs-good); }
.bytesim .bs-chwait { color: var(--bs-faint); }

@media (max-width: 720px) {
  .bytesim { padding: 20px 14px 22px; }
  .bytesim .bs-readout { grid-template-columns: 1fr; }
  .bytesim .bs-chip { grid-template-columns: 74px 1fr auto; }
}
@media (prefers-reduced-motion: reduce) {
  .bytesim * { animation: none !important; transition: none !important; }
  .bytesim .bs-tile:hover, .bytesim .bs-btn:hover, .bytesim .bs-mode:hover { transform: none; }
}
`;
