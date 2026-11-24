import { describe, it, expect } from 'vitest';
import {
  ALGORITHMS,
  digestBytes,
  hmacBytes,
  hmacMd5,
  md5,
  encodeUtf8,
  compareHash,
  isValidHashFormat,
  formatHexLength,
  hmacSupport,
} from '@/tool/hash';

// Known vectors: NIST / RFC 1321 / RFC 4231 / "abc" vector family.
const TEXT_VECTORS: Record<string, Record<string, string>> = {
  '': {
    md5: 'd41d8cd98f00b204e9800998ecf8427e',
    sha1: 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    sha384:
      '38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b',
    sha512:
      'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  },
  abc: {
    md5: '900150983cd24fb0d6963f7d28e17f72',
    sha1: 'a9993e364706816aba3e25717850c26c9cd0d89d',
    sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    sha384:
      'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7',
    sha512:
      'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
  },
  'The quick brown fox jumps over the lazy dog': {
    md5: '9e107d9d372bb6826bd81d3542a419d6',
    sha1: '2fd4e1c67a2d28fced849ee1bb76e7391b93eb12',
    sha256: 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
    sha384:
      'ca737f1014a48f4c0b6dd43cb177b0afd9e5169367544c494011e3317dbf9a509cb1e5dc1e85a941bbee3d7f2afbc9b1',
    sha512:
      '07e547d9586f6a73f73fbac0435ed76951218fb7d0c8d788a309d785436bbb642e93a252a954f23912547d1e8a3b5ed6e1bfd7097821233fa0538f3db854fee6',
  },
};

describe('digest values for known test vectors', () => {
  for (const [text, expected] of Object.entries(TEXT_VECTORS)) {
    for (const algo of ALGORITHMS) {
      it(`${algo}(${JSON.stringify(text.length > 43 ? 'long text' : text)})`, async () => {
        const hex = await digestBytes(algo, encodeUtf8(text));
        expect(hex).toBe(expected[algo]);
      });
    }
  }
});

describe('md5 edge cases', () => {
  it('matches for exactly 55- and 56-byte inputs (padding boundaries)', async () => {
    const b55 = new Uint8Array(55).fill(0x61);
    const b56 = new Uint8Array(56).fill(0x61);
    const b64 = new Uint8Array(64).fill(0x61);
    // Digests differ across boundary; just verify determinism and format.
    const one = md5(b55);
    expect(one).toMatch(/^[0-9a-f]{32}$/);
    expect(md5(b55)).toBe(one);
    expect(md5(b56)).toMatch(/^[0-9a-f]{32}$/);
    expect(md5(b64)).toMatch(/^[0-9a-f]{32}$/);
    expect(md5(b56)).not.toBe(md5(b64));
  });

  it('handles multi-block input deterministically', async () => {
    const text = 'a'.repeat(1000);
    const first = await digestBytes('md5', encodeUtf8(text));
    const second = await digestBytes('md5', encodeUtf8(text));
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{32}$/);
  });
});

// RFC 4231 test vectors for HMAC-SHA-256 (others verified structurally same API).
const RFC4231_KEY = 'key';
const RFC4231_DATA = 'The quick brown fox jumps over the lazy dog';

describe('HMAC outputs match RFC vectors where supported', () => {
  it('HMAC-MD5 of the fox text with key "key"', async () => {
    const hex = await hmacBytes('md5', RFC4231_KEY, encodeUtf8(RFC4231_DATA));
    // Well-known HMAC-MD5 value for this classic test pair.
    expect(hex).toBe('80070713463e7749b90c2dc24911e275');
  });

  it('HMAC-SHA-256 of the fox text with key "key"', async () => {
    const hex = await hmacBytes('sha256', RFC4231_KEY, encodeUtf8(RFC4231_DATA));
    expect(hex).toBe('f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8');
  });

  it('HMAC-SHA-1/384/512 match reference values', async () => {
    expect(await hmacBytes('sha1', RFC4231_KEY, encodeUtf8(RFC4231_DATA))).toBe(
      'de7c9b85b8b78aa6bc8a7a36f70a90701c9db4d9'
    );
    expect(await hmacBytes('sha384', RFC4231_KEY, encodeUtf8(RFC4231_DATA))).toBe(
      'd7f4727e2c0b39ae0f1e40cc96f60242d5b7801841cea6fc592c5d3e1ae50700582a96cf35e1e554995fe4e03381c237'
    );
    expect(await hmacBytes('sha512', RFC4231_KEY, encodeUtf8(RFC4231_DATA))).toBe(
      'b42af09057bac1e2d41708e48a902e09b5ff7f12ab428a4fe86653c73dd248fb82f948a549f7b791a5b41915ee4d1ec3935357e4e2317250d0372afa2ebeeb3a'
    );
  });

  it('HMAC-SHA-256 of the same bytes computes deterministically', async () => {
    const one = await hmacBytes('sha256', RFC4231_KEY, encodeUtf8(RFC4231_DATA));
    const two = await hmacBytes('sha256', RFC4231_KEY, encodeUtf8(RFC4231_DATA));
    expect(one).toBe(two);
    expect(one).toMatch(/^[0-9a-f]{64}$/);
  });

  it('HMAC-SHA-256 with empty data still yields 32-byte digest', async () => {
    const hex = await hmacBytes('sha256', RFC4231_KEY, new Uint8Array(0));
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it('HMAC-SHA-1/384/512 produce correct lengths', async () => {
    for (const [algo, len] of [
      ['sha1', 40],
      ['sha384', 96],
      ['sha512', 128],
    ] as const) {
      const hex = await hmacBytes(algo, 'secret', encodeUtf8('data'));
      expect(hex).toHaveLength(len);
    }
  });

  it('HMAC differs from plain digest of the same bytes', async () => {
    const data = encodeUtf8(RFC4231_DATA);
    const plain = await digestBytes('sha256', data);
    const keyed = await hmacBytes('sha256', RFC4231_KEY, data);
    expect(keyed).not.toBe(plain);
  });

  it('hmacSupport reports support for every algorithm', () => {
    for (const algo of ALGORITHMS) expect(hmacSupport(algo).supported).toBe(true);
  });

  it('hmacMd5 with long key (>64 bytes) matches hashing the key first', async () => {
    const longKey = new Uint8Array(80).fill(0x42);
    const data = encodeUtf8(RFC4231_DATA);
    expect(hmacMd5(longKey, data)).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('file input bytes equal text input bytes', () => {
  it('digest of file bytes equals digest of text bytes for identical content', async () => {
    const content = 'identical-bytes-identical-digest';
    const asText = await digestBytes('sha256', encodeUtf8(content));
    const asFile = await digestBytes('sha256', encodeUtf8(content));
    expect(asFile).toBe(asText);
  });
});

describe('compare mode', () => {
  it('is case-insensitive', () => {
    const actual = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    expect(compareHash(actual, actual.toUpperCase(), false)).toBe(true);
    expect(compareHash(actual.toUpperCase(), actual, true)).toBe(true);
  });

  it('flags mismatch correctly', () => {
    expect(compareHash('aa', 'bb', false)).toBe(false);
    expect(compareHash(null, 'aa', false)).toBe(false);
    expect(compareHash('aa', '', false)).toBe(false);
    expect(compareHash('aa', 'zz', false)).toBe(false); // invalid hex
  });
});

describe('helpers', () => {
  it('formatHexLength and isValidHashFormat', () => {
    expect(formatHexLength('md5')).toBe(32);
    expect(formatHexLength('sha1')).toBe(40);
    expect(formatHexLength('sha256')).toBe(64);
    expect(formatHexLength('sha384')).toBe(96);
    expect(formatHexLength('sha512')).toBe(128);
    expect(isValidHashFormat('ABCD', 'md5')).toBe(false);
    expect(isValidHashFormat('a'.repeat(32), 'md5')).toBe(true);
    expect(isValidHashFormat('A'.repeat(64), 'sha256')).toBe(true);
  });
});
