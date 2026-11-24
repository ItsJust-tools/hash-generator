import { describe, it, expect } from 'vitest';
import { serializeState, deserializeState, withHistory, roundTrips } from '@/tool/tool-definition';
import { summaryText, historyText } from '@/tool/types';
import {
  DEFAULT_STATE,
  MAX_HISTORY,
  compareVerdict,
  inputSizes,
  explain,
  isState,
  type ToolState,
} from '@/tool/types';
import { encodeUtf8 } from '@/tool/hash';

const fullState = (over: Partial<ToolState> = {}): ToolState => ({
  ...DEFAULT_STATE,
  ...over,
});

describe('serialize / deserialize round-trip', () => {
  it('round-trips a text-mode state', () => {
    const state = fullState({ text: 'hello', algorithm: 'sha512', uppercase: true });
    expect(roundTrips(state)).toBe(true);
  });

  it('round-trips state with results and history', () => {
    const state = fullState({
      results: { sha256: { hex: 'ab'.repeat(32), durationMs: 1.23 } },
      history: [{ text: 'SHA-256 x → ab', createdAt: '2026-11-24T00:00:00.000Z' }],
    });
    expect(roundTrips(state)).toBe(true);
  });

  it('never serializes the secret or file bytes', () => {
    const state = fullState({ secret: 'super-secret', fileBytes: new Uint8Array([1, 2, 3]) });
    const raw = serializeState(state);
    expect(raw).not.toContain('super-secret');
    expect(raw).not.toContain('fileBytes');
    const restored = deserializeState(JSON.parse(raw));
    expect(restored.success && restored.data.secret).toBe('');
    expect(restored.success && restored.data.fileBytes).toBeNull();
  });

  it('rejects non-object payloads', () => {
    expect(deserializeState(null).success).toBe(false);
    expect(deserializeState('nope').success).toBe(false);
    expect(deserializeState([1]).success).toBe(false);
    expect(deserializeState(undefined).success).toBe(false);
    const failed = deserializeState(null);
    if (!failed.success) {
      expect(failed.error).toContain('Invalid data format');
    }
  });

  it('falls back to defaults on invalid fields', () => {
    const restored = deserializeState({
      algorithm: 'sha3',
      inputSource: 'clipboard',
      text: 42,
      hmacEnabled: 'yes',
      history: 'nope',
      results: { bogus: 1, sha256: { hex: 'ff', durationMs: 0.5 } },
    });
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.algorithm).toBe(DEFAULT_STATE.algorithm);
      expect(restored.data.inputSource).toBe('text');
      expect(restored.data.text).toBe('');
      expect(restored.data.hmacEnabled).toBe(false);
      expect(restored.data.history).toEqual([]);
      expect(restored.data.results['sha256']).toEqual({ hex: 'ff', durationMs: 0.5 });
    }
  });

  it('caps deserialized history at MAX_HISTORY', () => {
    const history = Array.from({ length: MAX_HISTORY + 5 }, (_, i) => ({
      text: `entry ${i}`,
      createdAt: `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}.000Z`,
    }));
    const restored = deserializeState({ ...DEFAULT_STATE, history });
    expect(restored.success && restored.data.history.length).toBe(MAX_HISTORY);
  });

  it('deserialization of primitive state survives serialize(deserialize(json))', () => {
    const restored = deserializeState(JSON.parse(serializeState(fullState({ text: 'abc' }))));
    expect(restored.success).toBe(true);
  });
});

describe('withHistory', () => {
  it('prepends newest first and caps at MAX_HISTORY', () => {
    let state = fullState();
    for (let i = 0; i < MAX_HISTORY + 3; i += 1) {
      state = withHistory(state, `e${i}`, new Date(2026, 0, 1, 0, 0, i));
    }
    expect(state.history.length).toBe(MAX_HISTORY);
    expect(state.history[0]?.text).toBe(`e${MAX_HISTORY + 2}`);
  });
});

describe('compareVerdict', () => {
  it('pending when empty expected or no result', () => {
    expect(compareVerdict(null, 'abc', false)).toBe('pending');
    expect(compareVerdict('ab', '', false)).toBe('pending');
  });
  it('match is case-insensitive including uppercase rendering', () => {
    expect(compareVerdict('ab12', 'AB12', true)).toBe('match');
    expect(compareVerdict('ab12', 'ab12', false)).toBe('match');
  });
  it('no-match otherwise', () => {
    expect(compareVerdict('ab12', 'cd34', false)).toBe('no-match');
  });
});

describe('inputSizes', () => {
  it('counts chars vs UTF-8 bytes', () => {
    expect(inputSizes('')).toEqual({ chars: 0, bytes: 0 });
    expect(inputSizes('abc')).toEqual({ chars: 3, bytes: 3 });
    // 'é' is 1 char, 2 bytes; emoji is 2 chars, 4 bytes.
    expect(inputSizes('é').bytes).toBe(2);
    expect(inputSizes('🦞')).toEqual({ chars: 2, bytes: 4 });
  });
});

describe('explain / summaryText / historyText', () => {
  it('explain mentions HMAC when enabled', () => {
    const lines = explain(fullState({ hmacEnabled: true }));
    expect(lines.some((l) => l.includes('HMAC'))).toBe(true);
  });
  it('summaryText waits without result and shows hex with', () => {
    expect(summaryText(fullState())).toContain('waiting for input');
    const s = fullState({
      results: { sha256: { hex: 'ff'.repeat(32), durationMs: 1 } },
      uppercase: true,
    });
    expect(summaryText(s)).toContain('FF'.repeat(32));
  });
  it('historyText returns null without result', () => {
    expect(historyText(fullState())).toBeNull();
    expect(historyText(fullState({ results: { sha256: { hex: 'aa', durationMs: 0 } } }))).toContain(
      'aa'
    );
  });
});

describe('isState', () => {
  it('accepts valid, rejects invalid', () => {
    expect(isState(fullState())).toBe(true);
    expect(isState({})).toBe(false);
    expect(isState(null)).toBe(false);
    expect(isState({ ...DEFAULT_STATE, algorithm: 'md6' })).toBe(false);
  });
});

describe('encoding', () => {
  it('encodeUtf8 produces expected byte arrays', () => {
    expect(Array.from(encodeUtf8('ab'))).toEqual([97, 98]);
  });
});
