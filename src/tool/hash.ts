/**
 * Client-side hashing helpers. Pure functions over bytes; no network, no storage.
 * Uses WebCrypto for SHA-1/SHA-256/SHA-384/SHA-512 and a local MD5 implementation
 * (SubtleCrypto does not expose MD5). HMAC-MD5 is computed manually per RFC 2104.
 */

export type Algorithm = 'md5' | 'sha1' | 'sha256' | 'sha384' | 'sha512';

export const ALGORITHMS: Algorithm[] = ['md5', 'sha1', 'sha256', 'sha384', 'sha512'];

export const ALGORITHM_LABELS: Record<Algorithm, string> = {
  md5: 'MD5',
  sha1: 'SHA-1',
  sha256: 'SHA-256',
  sha384: 'SHA-384',
  sha512: 'SHA-512',
};

const SUBTLE_ALGOS: Record<Exclude<Algorithm, 'md5'>, string> = {
  sha1: 'SHA-1',
  sha256: 'SHA-256',
  sha384: 'SHA-384',
  sha512: 'SHA-512',
};

function subtle(): SubtleCrypto {
  const c = globalThis.crypto as Crypto | undefined;
  if (!c?.subtle) throw new Error('WebCrypto unavailable in this environment');
  return c.subtle;
}

function subtleAlgo(algo: Algorithm): string {
  if (algo === 'md5') throw new Error('MD5 is not supported by WebCrypto');
  return SUBTLE_ALGOS[algo];
}

/* ---------------------------------- MD5 ---------------------------------- */

const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
  20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6,
  10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];
const MD5_K = new Uint32Array(64);
for (let i = 0; i < 64; i += 1) {
  MD5_K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0;
}

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

export function md5(data: Uint8Array): string {
  const bitLen = data.length * 8;
  const withPadding = new Uint8Array((((data.length + 8) >> 6) + 1) << 6);
  withPadding.set(data);
  withPadding[data.length] = 0x80;
  const view = new DataView(withPadding.buffer);
  view.setUint32(withPadding.length - 8, bitLen >>> 0, true);
  view.setUint32(withPadding.length - 4, Math.floor(bitLen / 2 ** 32), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const words = new Uint32Array(16);
  const S = MD5_S;
  const K = MD5_K;
  for (let chunk = 0; chunk < withPadding.length; chunk += 64) {
    for (let i = 0; i < 16; i += 1) words[i] = view.getUint32(chunk + i * 4, true);
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let i = 0; i < 64; i += 1) {
      let f: number;
      let g: number;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      const ki = K[i] ?? 0;
      const si = S[i] ?? 0;
      const wi = words[g] ?? 0;
      const tmp = d;
      d = c;
      c = b;
      const x = (a + f + ki + wi) >>> 0;
      b = (b + ((x << si) | (x >>> (32 - si)))) >>> 0;
      a = tmp;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  const out = new Uint8Array(16);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, a0, true);
  dv.setUint32(4, b0, true);
  dv.setUint32(8, c0, true);
  dv.setUint32(12, d0, true);
  return toHex(out);
}

/* ---------------------------------- HMAC --------------------------------- */

/** RFC 2104 HMAC over the MD5 block function (block size 64). */
export function hmacMd5(key: Uint8Array, data: Uint8Array): string {
  let k = key;
  if (k.length > 64) k = new Uint8Array(md5Bytes(k));
  const ipad = new Uint8Array(64 + data.length);
  const opad = new Uint8Array(64 + 16);
  const k0 = new Uint8Array(64);
  k0.set(k);
  for (let i = 0; i < 64; i += 1) {
    const kb = k0[i] ?? 0;
    ipad[i] = kb ^ 0x36;
    opad[i] = kb ^ 0x5c;
  }
  ipad.set(data, 64);
  opad.set(md5Bytes(ipad), 64);
  return md5(opad);
}

function md5Bytes(data: Uint8Array): Uint8Array {
  const hex = md5(data);
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/* -------------------------------- Public API ------------------------------ */

export function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function toHexUpper(hex: string, uppercase: boolean): string {
  return uppercase ? hex.toUpperCase() : hex;
}

/** Compute the raw (lowercase hex) digest of bytes for the given algorithm. */
export async function digestBytes(algo: Algorithm, data: Uint8Array): Promise<string> {
  if (algo === 'md5') return md5(data);
  const buffer = await subtle().digest(subtleAlgo(algo), data as unknown as ArrayBuffer);
  return toHex(new Uint8Array(buffer));
}

export type HmacSupport = { supported: true } | { supported: false; reason: string };

/** HMAC is supported for every algorithm, including MD5 (manual RFC 2104). */
export function hmacSupport(algo: Algorithm): HmacSupport {
  void algo;
  return { supported: true };
}

/** Compute the raw (lowercase hex) HMAC of bytes with a secret for the algorithm. */
export async function hmacBytes(
  algo: Algorithm,
  secret: string,
  data: Uint8Array
): Promise<string> {
  const keyData = encodeUtf8(secret);
  if (algo === 'md5') return hmacMd5(keyData, data);
  const key = await subtle().importKey(
    'raw',
    keyData as unknown as ArrayBuffer,
    { name: 'HMAC', hash: subtleAlgo(algo) },
    false,
    ['sign']
  );
  const sig = await subtle().sign('HMAC', key, data as unknown as ArrayBuffer);
  return toHex(new Uint8Array(sig));
}

/** Case-insensitive digest comparison; empty expected hashes never match. */
export function compareHash(actual: string | null, expected: string, uppercase: boolean): boolean {
  if (!actual || !expected.trim()) return false;
  const norm = expected.trim().toLowerCase();
  const actualNorm = uppercase ? actual.toLowerCase() : actual;
  if (!/^[0-9a-f]+$/.test(norm)) return false;
  return norm === actualNorm.toLowerCase();
}

const HEX_LENGTHS: Record<Algorithm, number> = {
  md5: 32,
  sha1: 40,
  sha256: 64,
  sha384: 96,
  sha512: 128,
};

export function formatHexLength(algo: Algorithm): number {
  return HEX_LENGTHS[algo];
}

export function isValidHashFormat(value: string, algo: Algorithm): boolean {
  return new RegExp(`^[0-9a-fA-F]{${formatHexLength(algo)}}$`).test(value.trim());
}
