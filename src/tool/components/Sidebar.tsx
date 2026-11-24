'use client';

import React from 'react';
import { ALGORITHMS, ALGORITHM_LABELS } from '../hash';
import { MAX_HISTORY, type ToolState } from '../types';

interface SidebarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ state, onChange }) => {
  return (
    <div className="p-4 space-y-6 text-sm overflow-y-auto h-full" data-testid="hash-sidebar">
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">About</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          All hashing runs locally in your browser with WebCrypto (SHA family, HMAC) and a built-in
          MD5 implementation. Nothing is uploaded, and HMAC secrets are never encoded into shared
          URLs.
        </p>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Digest lengths</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          {ALGORITHMS.map((algo) => (
            <li key={algo} className="flex justify-between gap-2">
              <button
                type="button"
                onClick={() => onChange({ ...state, algorithm: algo })}
                data-testid={`sidebar-algo-${algo}`}
                className={`underline decoration-dotted ${
                  state.algorithm === algo
                    ? 'font-semibold text-violet-600 dark:text-violet-400'
                    : ''
                }`}
              >
                {ALGORITHM_LABELS[algo]}
              </button>
              <span className="text-gray-500 dark:text-gray-400">
                {{ md5: 128, sha1: 160, sha256: 256, sha384: 384, sha512: 512 }[algo] ?? 0} bits
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">
          Saved results <span data-testid="sidebar-history-count">({state.history.length})</span>
        </h3>
        {state.history.length === 0 ? (
          <p className="text-xs text-gray-600 dark:text-gray-300">
            No saved results yet. Use “Save result” in the toolbar.
          </p>
        ) : (
          <ul className="space-y-2" data-testid="sidebar-history">
            {state.history.map((entry) => (
              <li
                key={entry.createdAt + entry.text}
                className="rounded border border-gray-200 p-2 text-xs dark:border-gray-700"
              >
                <span className="break-all font-mono">{entry.text}</span>
                <span className="block text-gray-400">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Privacy</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Shared links encode the text input in the URL fragment only — the secret is excluded.
          Maximum {MAX_HISTORY} saved entries are kept.
        </p>
      </div>
    </div>
  );
};
