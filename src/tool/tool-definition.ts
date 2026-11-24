import type { Tool, DeserializeResult } from '@itsjust/core';
import { toolConfig } from './tool.config';
import {
  DEFAULT_STATE,
  MAX_HISTORY,
  summaryText,
  type HistoryEntry,
  type ToolState,
} from './types';
import type { Algorithm, HashResult, InputSource } from './types';

import { ALGORITHMS } from './hash';

const ALGO_SET = new Set<string>(ALGORITHMS);
const SOURCES: InputSource[] = ['text', 'file'];

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function validHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is HistoryEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as HistoryEntry).text === 'string' &&
        typeof (entry as HistoryEntry).createdAt === 'string'
    )
    .slice(0, MAX_HISTORY);
}

function validResults(value: unknown): Partial<Record<Algorithm, HashResult>> {
  const out: Partial<Record<Algorithm, HashResult>> = {};
  if (typeof value !== 'object' || value === null) return out;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (!ALGO_SET.has(k) || typeof v !== 'object' || v === null) continue;
    const r = v as Partial<HashResult>;
    if (typeof r.hex === 'string' && typeof r.durationMs === 'number') {
      out[k as Algorithm] = { hex: r.hex, durationMs: r.durationMs };
    }
  }
  return out;
}

/** Serialize tool state. File bytes and the HMAC secret are never serialized. */
export function serializeState(state: ToolState): string {
  return JSON.stringify({
    inputSource: state.inputSource,
    text: state.text,
    fileName: state.fileName,
    hmacEnabled: state.hmacEnabled,
    algorithm: state.algorithm,
    uppercase: state.uppercase,
    compareValue: state.compareValue,
    results: state.results,
    history: state.history,
  });
}

/** Validate and recover tool state from an arbitrary payload. */
export function deserializeState(data: unknown): DeserializeResult<ToolState> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { success: false, error: 'Invalid data format: expected hash generator state object' };
  }
  const v = data as Record<string, unknown>;
  const algorithm: Algorithm = ALGO_SET.has(v.algorithm as string)
    ? (v.algorithm as Algorithm)
    : DEFAULT_STATE.algorithm;
  const inputSource: InputSource = SOURCES.includes(v.inputSource as InputSource)
    ? (v.inputSource as InputSource)
    : DEFAULT_STATE.inputSource;
  const state: ToolState = {
    inputSource,
    text: stringOr(v.text, ''),
    fileName: stringOr(v.fileName, ''),
    fileBytes: null,
    hmacEnabled: v.hmacEnabled === true,
    secret: '',
    algorithm,
    uppercase: v.uppercase === true,
    compareValue: stringOr(v.compareValue, ''),
    results: validResults(v.results),
    history: validHistory(v.history),
  };
  return { success: true, data: state };
}

/** Append a history entry, capped at MAX_HISTORY, newest first. */
export function withHistory(state: ToolState, text: string, now = new Date()): ToolState {
  const entry: HistoryEntry = { text, createdAt: now.toISOString() };
  return { ...state, history: [entry, ...state.history].slice(0, MAX_HISTORY) };
}

/** True when a serialized string round-trips back to the same state. */
export function roundTrips(state: ToolState): boolean {
  try {
    const restored = deserializeState(JSON.parse(serializeState(state)));
    return restored.success && JSON.stringify(restored.data) === JSON.stringify(state);
  } catch {
    return false;
  }
}

export const hashGeneratorTool: Tool<ToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig,
  initialState: { ...DEFAULT_STATE },
  serialize: serializeState,
  deserialize: deserializeState,
  exporters: [
    { format: 'png', loader: () => import('./exporters/png') },
    { format: 'jpeg', loader: () => import('./exporters/jpeg') },
    { format: 'webp', loader: () => import('./exporters/webp') },
    { format: 'pdf', loader: () => import('./exporters/pdf') },
  ],
};

export { summaryText };
export {
  digestBytes,
  hmacBytes,
  compareHash,
  encodeUtf8,
  isValidHashFormat,
  formatHexLength,
} from './hash';
