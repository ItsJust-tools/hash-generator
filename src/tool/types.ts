import type { Algorithm } from './hash';

export type { Algorithm };

export type InputSource = 'text' | 'file';

export interface HashResult {
  /** Raw lowercase hex digest. */
  hex: string;
  /** Wall-clock hashing duration in milliseconds. */
  durationMs: number;
}

export interface ToolState {
  /** Active input source. */
  inputSource: InputSource;
  /** Text input (used when inputSource is 'text'). */
  text: string;
  /** Name of the loaded file (inputSource 'file'). */
  fileName: string;
  /** Bytes of the loaded file (kept out of serialized state). */
  fileBytes: Uint8Array | null;
  /** Whether HMAC mode is enabled. */
  hmacEnabled: boolean;
  /** HMAC secret. Never serialized or shared. */
  secret: string;
  /** Selected algorithm. */
  algorithm: Algorithm;
  /** Uppercase hex output. */
  uppercase: boolean;
  /** Expected hash for compare mode. */
  compareValue: string;
  /** Cached digest per algorithm for the current input, keyed by algorithm. */
  results: Partial<Record<Algorithm, HashResult>>;
  /** Saved hash entries, newest first. */
  history: HistoryEntry[];
}

export interface HistoryEntry {
  /** Human-readable summary, e.g. "SHA-256 abc → ba7816bf...". */
  text: string;
  /** ISO timestamp. */
  createdAt: string;
}

export const ALGORITHMS_STATE: Algorithm[] = ['md5', 'sha1', 'sha256', 'sha384', 'sha512'];

export const DEFAULT_STATE: ToolState = {
  inputSource: 'text',
  text: '',
  fileName: '',
  fileBytes: null,
  hmacEnabled: false,
  secret: '',
  algorithm: 'sha256',
  uppercase: false,
  compareValue: '',
  results: {},
  history: [],
};

export const MAX_HISTORY = 20;

/** Show input size: characters for text mode, or a byte/char pair. */
export function inputSizes(text: string): { chars: number; bytes: number } {
  const bytes = new TextEncoder().encode(text).length;
  return { chars: text.length, bytes };
}

/** Case-insensitive verdict comparing (possibly formatted) actual to expected. */
export function compareVerdict(
  actual: string | null,
  expected: string,
  uppercase: boolean
): 'match' | 'no-match' | 'pending' {
  if (!expected.trim() || actual === null) return 'pending';
  const norm = (s: string) => s.trim().toLowerCase();
  return norm(expected) === norm(uppercase ? actual.toLowerCase() : actual) ? 'match' : 'no-match';
}

/** One-line step explanation for the current state. */
export function explain(state: ToolState): string[] {
  const source =
    state.inputSource === 'file'
      ? `file "${state.fileName}"`
      : `${new TextEncoder().encode(state.text).length} UTF-8 bytes of text`;
  const lines = [`Algorithm: ${state.algorithm.toUpperCase()} over ${source}.`];
  if (state.hmacEnabled) lines.push('HMAC with the provided secret key.');
  lines.push(
    'Digest rendered as hexadecimal' + (state.uppercase ? ' (uppercase)' : ' (lowercase)') + '.'
  );
  return lines;
}

/** Short status summary for the status bar. */
export function summaryText(state: ToolState): string {
  const r = state.results[state.algorithm];
  const label = state.algorithm.toUpperCase();
  if (!r) return `${label}: waiting for input`;
  return `${label}: ${state.uppercase ? r.hex.toUpperCase() : r.hex}`;
}

/** Build a history entry text for the current algorithm/result. */
export function historyText(state: ToolState): string | null {
  const r = state.results[state.algorithm];
  if (!r) return null;
  const preview =
    state.inputSource === 'file'
      ? state.fileName
      : state.text.length <= 20
        ? state.text || '(empty)'
        : `${state.text.slice(0, 17)}…`;
  return `${state.algorithm.toUpperCase()} ${preview} → ${
    state.uppercase ? r.hex.toUpperCase() : r.hex
  }`;
}

/** Light-weight structural check for persisted states. */
export function isState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  return (
    typeof v.text === 'string' &&
    typeof v.algorithm === 'string' &&
    ALGORITHMS_STATE.includes(v.algorithm as Algorithm)
  );
}
