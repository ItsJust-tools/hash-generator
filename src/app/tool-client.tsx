'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { ToolShell, useTool, ImportExport } from '@itsjust/core';
import {
  toolConfig,
  templateBaseVersion,
  Canvas,
  Toolbar,
  Sidebar,
  hashGeneratorTool,
} from '@/tool';
import { digestBytes, hmacBytes, serializeState, deserializeState } from '@/tool/tool-definition';
import { DEFAULT_STATE, MAX_HISTORY, historyText, summaryText, type ToolState } from '@/tool/types';
import { encodeUtf8 } from '@/tool/hash';

export default function ToolClient() {
  const ToolShellCompat = ToolShell as unknown as ComponentType<Record<string, unknown>> & {
    Toolbar?: ComponentType<{ children?: ReactNode }>;
    Body?: ComponentType<{ children?: ReactNode }>;
    Sidebar?: ComponentType<{ children?: ReactNode }>;
    Canvas?: ComponentType<{ children?: ReactNode }>;
    StatusBar?: ComponentType<{ children?: ReactNode }>;
  };
  const canvasRef = useRef<HTMLDivElement>(null);
  const tool = useTool<ToolState>(hashGeneratorTool, canvasRef);
  const setToolData = tool.state.setData;
  const showToast = tool.toast;
  const [isSharing, setIsSharing] = useState(false);
  const hasLoadedSharedState = useRef(false);
  const inputVersion = useRef(0);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth > 768 && toolConfig.features.sidebar
  );

  const title = toolConfig.name;
  const state = tool.state.data;
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const patch = useCallback(
    (p: Partial<ToolState>) => {
      setToolData((prev) => ({ ...prev, ...p }));
    },
    [setToolData]
  );

  // Live (debounced) hashing of text input.
  const hashInput = useCallback(
    async (value: string, useFile: string | null = null, secret: string | null = null) => {
      const current = stateRef.current;
      inputVersion.current += 1;
      const version = inputVersion.current;
      const algo = current.algorithm;
      const bytes = useFile !== null ? new Uint8Array(0) : encodeUtf8(value);
      const started = performance.now();
      try {
        const hex =
          current.hmacEnabled && (secret ?? current.secret)
            ? await hmacBytes(algo, secret ?? current.secret, bytes)
            : await digestBytes(algo, bytes);
        if (inputVersion.current !== version) return; // stale
        const previous = current.results;
        patch({
          results: {
            ...previous,
            [algo]: { hex, durationMs: performance.now() - started },
          },
        });
      } catch (error) {
        if (inputVersion.current !== version) return;
        const message = error instanceof Error ? error.message : 'Hashing failed';
        showToast(message, 'error');
      }
    },
    [patch, showToast]
  );

  // Re-hash whenever the relevant inputs change.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void hashInput(stateRef.current.text);
    }, 150);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.text, state.algorithm, state.hmacEnabled, state.secret, state.fileBytes]);

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const started = performance.now();
        const algo = stateRef.current.algorithm;
        const hex = stateRef.current.hmacEnabled
          ? await hmacBytes(algo, stateRef.current.secret, bytes)
          : await digestBytes(algo, bytes);
        patch({
          inputSource: 'file',
          fileName: file.name,
          fileBytes: bytes,
          results: {
            ...stateRef.current.results,
            [algo]: { hex, durationMs: performance.now() - started },
          },
        });
        showToast(`Hashed ${file.name}`, 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to read file';
        showToast(message, 'error');
      }
    },
    [patch, showToast]
  );

  const handleSave = useCallback(() => {
    const text = historyText(stateRef.current);
    if (!text) {
      showToast('Nothing to save yet', 'error');
      return;
    }
    setToolData((prev) => ({
      ...prev,
      history: [{ text, createdAt: new Date().toISOString() }, ...prev.history].slice(
        0,
        MAX_HISTORY
      ),
    }));
    showToast('Result saved', 'success');
  }, [setToolData, showToast]);

  const handleCopyResult = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${title}\n${summaryText(stateRef.current)}`);
      showToast('Result copied to clipboard', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to copy result';
      showToast(message, 'error');
    }
  }, [showToast, title]);

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      // Share only inputs, never the HMAC secret: encode text in the fragment.
      const current = stateRef.current;
      const shared = serializeState({
        ...DEFAULT_STATE,
        text: current.text,
        algorithm: current.algorithm,
      });
      const url = new URL(window.location.href);
      url.search = '';
      url.hash = `h=${encodeURIComponent(shared)}`;
      window.history.replaceState(null, '', url.toString());
      const shareUrl = url.toString();
      if (navigator.share) {
        try {
          await navigator.share({ title, url: shareUrl });
          showToast('Shared URL ready', 'success');
          return;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return;
        }
      }
      await navigator.clipboard.writeText(shareUrl);
      showToast('Share URL copied to clipboard', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create share URL';
      showToast(message, 'error');
    } finally {
      setIsSharing(false);
    }
  }, [showToast, title]);

  // Load a shared state from the URL fragment once.
  useEffect(() => {
    if (hasLoadedSharedState.current) return;
    hasLoadedSharedState.current = true;
    const hash = window.location.hash;
    if (!hash.startsWith('#h=')) return;
    try {
      const raw = decodeURIComponent(hash.slice(3));
      const parsed: unknown = JSON.parse(raw);
      const deserialized = deserializeState(parsed);
      if (!deserialized.success) throw new Error(deserialized.error);
      setToolData(deserialized.data);
      showToast('Loaded state from shared URL', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load shared URL';
      showToast(message, 'error');
    }
  }, [setToolData, showToast]);

  const toolbarContent = (
    <>
      <Toolbar
        state={state}
        onChange={(next) => setToolData(() => next)}
        onClear={() => setToolData({ ...DEFAULT_STATE })}
        onCopy={() => void handleCopyResult()}
        onSave={handleSave}
      />
      <ImportExport
        formats={tool.supportedFormats}
        onExport={tool.handleExport}
        onImport={tool.importFromFile}
        isImporting={tool.isImporting}
        onShare={handleShare}
        isSharing={isSharing}
      />
    </>
  );

  const sidebarContent = <Sidebar state={state} onChange={(next) => setToolData(() => next)} />;

  const canvasContent = (
    <div ref={canvasRef}>
      <Canvas
        state={state}
        onChange={(next) => setToolData(() => next)}
        onHashFile={(file) => void handleFile(file)}
        onSaveHistory={handleSave}
      />
    </div>
  );

  const statusBarContent = (
    <>
      <span
        className={`status-slot status-slot-state ${tool.state.isDirty ? 'status-unsaved' : 'status-saved'}`}
      >
        {tool.state.isDirty ? (
          <>
            <span className="status-saving-dot" />
            Unsaved
          </>
        ) : tool.state.lastSaved ? (
          <>Saved {tool.state.lastSaved}</>
        ) : (
          'Ready'
        )}
      </span>
      <span className="status-slot status-slot-mode">{state.algorithm.toUpperCase()}</span>
      <span className="status-slot status-slot-summary">{summaryText(state)}</span>
      <span className="status-slot status-slot-history">{state.history.length} saved</span>
      <span className="status-slot status-slot-tool-version">Tool v{toolConfig.version}</span>
      <span className="status-slot status-slot-template-version">
        Template v{templateBaseVersion}
      </span>
    </>
  );

  const hasLegacySections = Boolean(
    ToolShellCompat.Toolbar &&
    ToolShellCompat.Body &&
    ToolShellCompat.Sidebar &&
    ToolShellCompat.Canvas &&
    ToolShellCompat.StatusBar
  );

  return (
    <ToolShellCompat
      config={toolConfig}
      sidebarOpen={sidebarOpen}
      onSidebarChange={setSidebarOpen}
      toolbar={toolbarContent}
      sidebar={sidebarContent}
      canvas={canvasContent}
      statusBar={statusBarContent}
    >
      {hasLegacySections
        ? (() => {
            const ToolbarSection = ToolShellCompat.Toolbar as ComponentType<{
              children?: ReactNode;
            }>;
            const BodySection = ToolShellCompat.Body as ComponentType<{ children?: ReactNode }>;
            const SidebarSection = ToolShellCompat.Sidebar as ComponentType<{
              children?: ReactNode;
            }>;
            const CanvasSection = ToolShellCompat.Canvas as ComponentType<{ children?: ReactNode }>;
            const StatusBarSection = ToolShellCompat.StatusBar as ComponentType<{
              children?: ReactNode;
            }>;
            return (
              <>
                <ToolbarSection>{toolbarContent}</ToolbarSection>
                <BodySection>
                  <SidebarSection>{sidebarContent}</SidebarSection>
                  <CanvasSection>{canvasContent}</CanvasSection>
                </BodySection>
                <StatusBarSection>{statusBarContent}</StatusBarSection>
              </>
            );
          })()
        : null}
    </ToolShellCompat>
  );
}
