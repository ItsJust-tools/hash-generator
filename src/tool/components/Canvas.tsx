'use client';

import React from 'react';
import { ALGORITHMS, ALGORITHM_LABELS, type Algorithm } from '../hash';
import { compareVerdict, inputSizes, type ToolState } from '../types';

interface CanvasProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
  onHashText?: (text: string) => void;
  onHashFile?: (file: File) => void;
  onSaveHistory?: (text: string) => void;
}

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

function CopyButton({ value, testid }: { value: string; testid?: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; ignore
    }
  }, [value]);
  return (
    <button
      type="button"
      onClick={handleCopy}
      data-testid={testid}
      disabled={!value}
      className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
      aria-label="Copy hash"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export const Canvas: React.FC<CanvasProps> = ({ state, onChange, onHashFile }) => {
  const update = (patch: Partial<ToolState>) => onChange?.({ ...state, ...patch });
  const result = state.results[state.algorithm];
  const sizes = inputSizes(state.text);
  const displayed = result ? (state.uppercase ? result.hex.toUpperCase() : result.hex) : null;
  const verdict = compareVerdict(result?.hex ?? null, state.compareValue, state.uppercase);
  const [dragOver, setDragOver] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-6" data-testid="hash-canvas">
      <section>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Algorithm">
          {ALGORITHMS.map((algo: Algorithm) => (
            <button
              key={algo}
              type="button"
              onClick={() => update({ algorithm: algo })}
              data-testid={`algo-${algo}`}
              aria-pressed={state.algorithm === algo}
              className={`rounded-md px-3 py-1.5 text-xs font-medium border ${
                state.algorithm === algo
                  ? 'bg-violet-500 text-white border-violet-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'
              }`}
            >
              {ALGORITHM_LABELS[algo]}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            <input
              type="radio"
              name="input-source"
              checked={state.inputSource === 'text'}
              onChange={() => update({ inputSource: 'text', fileBytes: null, fileName: '' })}
              data-testid="src-text"
            />{' '}
            Text input
          </label>
          <label className="mt-2 block text-xs font-medium text-gray-700 dark:text-gray-300">
            <input
              type="radio"
              name="input-source"
              checked={state.inputSource === 'file'}
              onChange={() => update({ inputSource: 'file' })}
              data-testid="src-file"
            />{' '}
            File input
          </label>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {state.inputSource === 'text' ? (
            <p data-testid="input-size">
              {sizes.chars} characters · {sizes.bytes} bytes (UTF-8)
            </p>
          ) : (
            <p data-testid="file-info">
              {state.fileName ? `File: ${state.fileName}` : 'Drop a file or choose one below.'}
            </p>
          )}
        </div>
      </section>

      {state.inputSource === 'text' ? (
        <section>
          <label
            htmlFor="hash-text"
            className="block text-xs font-medium text-gray-700 dark:text-gray-300"
          >
            Text to hash (live)
          </label>
          <textarea
            id="hash-text"
            value={state.text}
            onChange={(e) => update({ text: e.target.value })}
            data-testid="hash-text-input"
            rows={5}
            className={inputClass}
            placeholder="Type or paste text; the hash updates as you type"
          />
        </section>
      ) : (
        <section
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) onHashFile?.(file);
          }}
          data-testid="drop-zone"
          className={`rounded-lg border-2 border-dashed p-6 text-center text-sm ${
            dragOver
              ? 'border-violet-500 bg-violet-50 dark:bg-violet-950'
              : 'border-gray-300 dark:border-gray-700'
          }`}
        >
          <p className="text-gray-600 dark:text-gray-300">Drag &amp; drop a file here</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            data-testid="file-picker-button"
            className="mt-2 rounded-md bg-violet-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-violet-600"
          >
            Choose file
          </button>
          <input
            ref={fileRef}
            type="file"
            data-testid="file-input"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onHashFile?.(file);
            }}
          />
        </section>
      )}

      <section>
        <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={state.hmacEnabled}
            onChange={(e) => update({ hmacEnabled: e.target.checked })}
            data-testid="hmac-toggle"
          />
          HMAC mode (keyed secret)
        </label>
        {state.hmacEnabled ? (
          <input
            type="text"
            value={state.secret}
            onChange={(e) => update({ secret: e.target.value })}
            placeholder="Secret key (never included in shared URLs)"
            data-testid="secret-input"
            className={inputClass}
          />
        ) : null}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">Digest</h3>
        <div className="flex items-center gap-2">
          <code
            data-testid="hash-output"
            className="block flex-1 break-all rounded-md bg-gray-100 px-3 py-2 text-xs dark:bg-gray-900"
          >
            {displayed ?? '—'}
          </code>
          <CopyButton value={displayed ?? ''} testid="copy-hash" />
        </div>
        {result ? (
          <p data-testid="hash-duration" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Hashed in {result.durationMs.toFixed(2)} ms
          </p>
        ) : null}
      </section>

      <section>
        <label
          htmlFor="compare-value"
          className="block text-xs font-medium text-gray-700 dark:text-gray-300"
        >
          Compare with expected hash
        </label>
        <input
          id="compare-value"
          type="text"
          value={state.compareValue}
          onChange={(e) => update({ compareValue: e.target.value })}
          data-testid="compare-input"
          className={inputClass}
          placeholder="Paste an expected hash for a match/no-match verdict"
        />
        <p
          data-testid="compare-verdict"
          role="status"
          className={`mt-1 text-xs font-medium ${
            verdict === 'match'
              ? 'text-green-600 dark:text-green-400'
              : verdict === 'no-match'
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {verdict === 'match'
            ? '✓ Match'
            : verdict === 'no-match'
              ? '✗ No match'
              : 'Waiting for expected hash…'}
        </p>
      </section>
    </div>
  );
};
