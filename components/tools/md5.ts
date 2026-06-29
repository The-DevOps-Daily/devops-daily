// Self-contained MD5 (RFC 1321) operating on bytes, returning a lowercase hex
// string. The Web Crypto API does not implement MD5, but download pages still
// publish MD5 checksums, so the hash tool needs its own implementation for
// verification. Not for any security use; MD5 is collision-broken.

function rotl(x: number, c: number): number {
  return (x << c) | (x >>> (32 - c));
}

function add32(a: number, b: number): number {
  return (a + b) & 0xffffffff;
}

const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
  20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6,
  10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const K = (() => {
  const out: number[] = [];
  for (let i = 0; i < 64; i++) {
    // sin-based constants; precomputed at module load (Math.* is allowed here).
    out.push(Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296));
  }
  return out;
})();

export function md5(input: Uint8Array): string {
  const originalLenBits = input.length * 8;

  // Pad: append 0x80, then zeros, until length ≡ 56 (mod 64), then 64-bit length.
  const paddedLen = ((input.length + 8) >> 6 << 6) + 64;
  const bytes = new Uint8Array(paddedLen);
  bytes.set(input);
  bytes[input.length] = 0x80;

  // 64-bit little-endian length (low 32 bits cover all practical inputs).
  bytes[paddedLen - 8] = originalLenBits & 0xff;
  bytes[paddedLen - 7] = (originalLenBits >>> 8) & 0xff;
  bytes[paddedLen - 6] = (originalLenBits >>> 16) & 0xff;
  bytes[paddedLen - 5] = (originalLenBits >>> 24) & 0xff;

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const M = new Int32Array(16);
  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const j = offset + i * 4;
      M[i] = bytes[j] | (bytes[j + 1] << 8) | (bytes[j + 2] << 16) | (bytes[j + 3] << 24);
    }

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let F: number;
      let g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = add32(add32(add32(F, A), K[i]), M[g]);
      A = D;
      D = C;
      C = B;
      B = add32(B, rotl(F, S[i]));
    }

    a0 = add32(a0, A);
    b0 = add32(b0, B);
    c0 = add32(c0, C);
    d0 = add32(d0, D);
  }

  return [a0, b0, c0, d0].map(toHexLE).join('');
}

// Little-endian hex of a 32-bit word.
function toHexLE(n: number): string {
  let s = '';
  for (let i = 0; i < 4; i++) {
    s += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
  }
  return s;
}
