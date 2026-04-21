'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { featurePlannerService, type FeatureColumnData } from '@/lib/services/feature-planner.service';
import { useAuth } from '@/lib/context/AuthContext';

type Step = 'idle' | 'menu' | 'snipping' | 'form';

interface CapturedSnip {
  dataUrl: string;
  width: number;
  height: number;
}

export function BugReporter() {
  const { token } = useAuth();
  const [step, setStep] = useState<Step>('idle');
  const [columns, setColumns] = useState<FeatureColumnData[]>([]);
  const [snip, setSnip] = useState<CapturedSnip | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [columnId, setColumnId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadColumns = useCallback(async () => {
    try {
      const board = await featurePlannerService.getBoard(token ?? undefined);
      setColumns(board.columns);
      if (board.columns.length > 0 && columnId === null) {
        setColumnId(board.columns[0].id);
      }
    } catch {
      // silently ignore — columns list is optional UX
    }
  }, [token, columnId]);

  function openMenu() {
    loadColumns();
    setStep('menu');
  }

  function close() {
    setStep('idle');
    setSnip(null);
    setTitle('');
    setDescription('');
    setSaveError(null);
  }

  function openForm(withSnip: CapturedSnip | null) {
    setSnip(withSnip);
    setStep('form');
  }

  async function handleSubmit() {
    if (!title.trim() || !description.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      await featurePlannerService.createCard({
        columnId: columnId ?? 0,
        title: title.trim(),
        summary: description.trim(),
        requirements: '',
        uiSketch: snip ? snip.dataUrl : undefined,
        bugUrl: window.location.href,
        cardType: 'Bug',
      }, token ?? undefined);
      close();
    } catch {
      setSaveError('Kunne ikke lagre buggen. Prøv igjen.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Floating bug button */}
      {step === 'idle' && (
        <button
          onClick={openMenu}
          title="Rapporter en bug"
          className="fixed right-4 md:right-6 z-50 w-12 h-12 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
          style={{ bottom: "calc(4rem + env(safe-area-inset-bottom) + 0.75rem)" }}
        >
          <BugIcon className="w-6 h-6" />
        </button>
      )}

      {/* Menu popup */}
      {step === 'menu' && (
        <div className="fixed right-4 md:right-6 z-50" style={{ bottom: "calc(4rem + env(safe-area-inset-bottom) + 0.75rem)" }}>
          <div className="mb-3 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 flex flex-col gap-2 w-52">
            <button
              onClick={() => setStep('snipping')}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 text-white text-sm transition-colors text-left"
            >
              <ScissorsIcon className="w-4 h-4 text-slate-400 shrink-0" />
              Ta skjermbilde
            </button>
            <button
              onClick={() => openForm(null)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 text-white text-sm transition-colors text-left"
            >
              <PencilIcon className="w-4 h-4 text-slate-400 shrink-0" />
              Skriv beskrivelse
            </button>
            <div className="border-t border-slate-800 my-0.5" />
            <button
              onClick={close}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-400 text-sm transition-colors text-left"
            >
              Avbryt
            </button>
          </div>
          <button
            onClick={close}
            className="w-12 h-12 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-lg flex items-center justify-center transition-colors ml-auto"
          >
            <BugIcon className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Snipping overlay */}
      {step === 'snipping' && (
        <SnippingOverlay
          onCapture={(captured) => openForm(captured)}
          onCancel={() => setStep('menu')}
        />
      )}

      {/* Bug form modal */}
      {step === 'form' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={close}>
          <div
            className="bg-slate-900 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl border border-slate-700"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">Bug</span>
                <h2 className="text-lg font-bold text-white">Rapporter en bug</h2>
              </div>
              <button onClick={close} className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {/* Screenshot preview */}
              {snip && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Skjermbilde</span>
                    <button
                      onClick={() => setSnip(null)}
                      className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      Fjern
                    </button>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={snip.dataUrl}
                    alt="Skjermbilde"
                    className="w-full rounded-lg border border-slate-700 max-h-48 object-contain bg-slate-800"
                  />
                </div>
              )}

              {/* URL (auto-captured, read-only) */}
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Side</label>
                <div className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-slate-400 text-sm truncate select-all">
                  {typeof window !== 'undefined' ? window.location.href : ''}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">
                  Tittel <span className="text-red-400">*</span>
                </label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Kort beskrivelse av buggen"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-red-500"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">
                  Hva skjer? <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Beskriv hva som skjer og hva du forventet. Inkluder steg for å reprodusere."
                  rows={4}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:border-red-500"
                />
              </div>

              {/* Column selector */}
              {columns.length > 0 && (
                <div>
                  <label className="block text-sm text-slate-300 mb-1.5">Legg til i kolonne</label>
                  <select
                    value={columnId ?? ''}
                    onChange={e => setColumnId(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500"
                  >
                    {columns.map(col => (
                      <option key={col.id} value={col.id}>{col.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {saveError && <p className="text-red-400 text-sm">{saveError}</p>}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 shrink-0">
              <button onClick={close} className="text-slate-400 hover:text-slate-200 px-4 py-2 rounded-lg text-sm transition-colors">
                Avbryt
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !title.trim() || !description.trim()}
                className="bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? 'Lagrer...' : 'Legg til tavlen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface SnippingOverlayProps {
  onCapture: (snip: CapturedSnip) => void;
  onCancel: () => void;
}

function SnippingOverlay({ onCapture, onCancel }: SnippingOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const rectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [capturing, setCapturing] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, y: e.clientY };
    setRect({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!startRef.current) return;
    const { x, y } = startRef.current;
    const next = {
      x: Math.min(e.clientX, x),
      y: Math.min(e.clientY, y),
      w: Math.abs(e.clientX - x),
      h: Math.abs(e.clientY - y),
    };
    rectRef.current = next;
    setRect(next);
  }, []);

  const handleMouseUp = useCallback(async () => {
    const currentRect = rectRef.current;
    if (!startRef.current || !currentRect || currentRect.w < 10 || currentRect.h < 10) {
      startRef.current = null;
      rectRef.current = null;
      setRect(null);
      return;
    }
    startRef.current = null;
    setCapturing(true);

    try {
      const dataUrl = await toPng(document.body, {
        cacheBust: true,
        pixelRatio: window.devicePixelRatio,
        width: document.body.scrollWidth,
        height: document.body.scrollHeight,
        style: { transform: 'none' },
        filter: (node) => node !== overlayRef.current,
      });

      // Crop to selection using a canvas
      const dpr = window.devicePixelRatio;
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = dataUrl;
      });

      const cropped = document.createElement('canvas');
      cropped.width = currentRect.w * dpr;
      cropped.height = currentRect.h * dpr;
      const ctx = cropped.getContext('2d')!;
      ctx.drawImage(
        img,
        currentRect.x * dpr, currentRect.y * dpr, currentRect.w * dpr, currentRect.h * dpr,
        0, 0, currentRect.w * dpr, currentRect.h * dpr
      );

      onCapture({ dataUrl: cropped.toDataURL('image/png'), width: currentRect.w, height: currentRect.h });
    } catch (err) {
      console.error('Screenshot capture failed:', err);
      onCancel();
    }
  }, [onCapture, onCancel]);

  // Attach mouseup to window so release outside overlay is still caught
  useEffect(() => {
    const handler = () => { if (startRef.current) handleMouseUp(); };
    window.addEventListener('mouseup', handler);
    return () => window.removeEventListener('mouseup', handler);
  }, [handleMouseUp]);

  // Escape key cancels
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 cursor-crosshair"
      style={{ background: 'rgba(0,0,0,0.35)' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
    >
      {/* Instruction */}
      {!rect && !capturing && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 text-white text-sm px-4 py-2 rounded-xl shadow-lg pointer-events-none select-none">
          Dra for å velge område — trykk Esc for å avbryte
        </div>
      )}

      {/* Selection rectangle */}
      {rect && rect.w > 0 && rect.h > 0 && (
        <div
          ref={selectionRef}
          className="absolute border-2 border-blue-400 pointer-events-none"
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.w,
            height: rect.h,
            background: 'rgba(59,130,246,0.1)',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.3)',
          }}
        />
      )}

      {capturing && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-slate-900 text-white text-sm px-4 py-2 rounded-xl">Tar skjermbilde...</div>
        </div>
      )}
    </div>
  );
}

function BugIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 0V4m0 0H9m3 0h3M4.93 10H3m18 0h-1.93M4.93 14H3m18 0h-1.93M7.76 6.76 6.34 5.34M16.24 6.76l1.42-1.42M7.76 17.24l-1.42 1.42M16.24 17.24l1.42 1.42" />
    </svg>
  );
}

function ScissorsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9a3 3 0 100-6 3 3 0 000 6zm0 0l10.5 6M6 9l10.5-6M6 15a3 3 0 100 6 3 3 0 000-6zm0 0l10.5-6" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}
