'use client';

import React, { useState } from 'react';
import { featurePlannerService, type FeatureColumnData } from '@/lib/services/feature-planner.service';

interface ColumnManageModalProps {
  column?: FeatureColumnData;
  onSaved: () => void;
  onDeleted: (columnId: number) => void;
  onClose: () => void;
  token?: string;
}

export function ColumnManageModal({ column, onSaved, onDeleted, onClose, token }: ColumnManageModalProps) {
  const isEdit = !!column;
  const [name, setName] = useState(column?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave() {
    if (!name.trim()) { setError('Navn er påkrevd'); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await featurePlannerService.updateColumn(column.id, { name: name.trim() }, token);
      } else {
        await featurePlannerService.addColumn(name.trim(), token);
      }
      onSaved();
    } catch {
      setError('Kunne ikke lagre. Prøv igjen.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-700"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-bold text-white">{isEdit ? 'Rediger kolonne' : 'Legg til kolonne'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Kolonnenavn</label>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setError(null); }}
              placeholder="f.eks. Backlog"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              className={`w-full bg-slate-800 border ${error ? 'border-red-500' : 'border-slate-700'} rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500`}
            />
            {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
          </div>

          {isEdit && (
            <div className="border-t border-slate-800 pt-4">
              {confirmDelete ? (
                <div className="space-y-2">
                  <p className="text-slate-400 text-sm">Slette denne kolonnen? Kortene flyttes til den første kolonnen.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onDeleted(column.id)}
                      className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Slett kolonne
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm transition-colors"
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-slate-500 hover:text-red-400 text-sm transition-colors"
                >
                  Slett denne kolonnen
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-800">
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 px-4 py-2 rounded-lg text-sm transition-colors">
            Avbryt
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? 'Lagrer...' : isEdit ? 'Lagre' : 'Legg til kolonne'}
          </button>
        </div>
      </div>
    </div>
  );
}
