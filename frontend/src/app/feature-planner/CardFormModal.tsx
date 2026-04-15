'use client';

import React, { useState } from 'react';
import { featurePlannerService, type FeatureCardData, type GeneratedPrd, type CardType } from '@/lib/services/feature-planner.service';

interface CardFormModalProps {
  columnId: number;
  card?: FeatureCardData;
  onSaved: () => void;
  onClose: () => void;
  token?: string;
}

type Tab = 'manual' | 'ai';

interface FormState {
  title: string;
  summary: string;
  motivation: string;
  requirements: string;
  outOfScope: string;
  openQuestions: string;
  stacksFrontend: boolean;
  stacksBackend: boolean;
  stacksInfrastructure: boolean;
  dataModel: string;
  apiSketch: string;
  uiSketch: string;
  cardType: CardType;
}

function emptyForm(card?: FeatureCardData): FormState {
  return {
    title: card?.title ?? '',
    summary: card?.summary ?? '',
    motivation: card?.motivation ?? '',
    requirements: card?.requirements ?? '',
    outOfScope: card?.outOfScope ?? '',
    openQuestions: card?.openQuestions ?? '',
    stacksFrontend: card?.stacksFrontend ?? false,
    stacksBackend: card?.stacksBackend ?? false,
    stacksInfrastructure: card?.stacksInfrastructure ?? false,
    dataModel: card?.dataModel ?? '',
    apiSketch: card?.apiSketch ?? '',
    uiSketch: card?.uiSketch ?? '',
    cardType: card?.cardType ?? 'Feature',
  };
}

export function CardFormModal({ columnId, card, onSaved, onClose, token }: CardFormModalProps) {
  const isEdit = !!card;
  const isEditingBug = isEdit && card.cardType === 'Bug';
  const [tab, setTab] = useState<Tab>(isEdit ? 'manual' : 'ai');
  const [form, setForm] = useState<FormState>(emptyForm(card));
  const [showTechnical, setShowTechnical] = useState(
    card ? (card.stacksFrontend || card.stacksBackend || card.stacksInfrastructure || !!card.dataModel || !!card.apiSketch || !!card.uiSketch) : false
  );
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<FormState>>({});

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: undefined }));
  }

  async function handleGenerate() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const prd: GeneratedPrd = await featurePlannerService.generatePrd(aiPrompt, token);
      setForm({
        title: prd.title,
        summary: prd.summary,
        motivation: prd.motivation,
        requirements: prd.requirements,
        outOfScope: prd.outOfScope ?? '',
        openQuestions: prd.openQuestions ?? '',
        stacksFrontend: prd.stacksFrontend,
        stacksBackend: prd.stacksBackend,
        stacksInfrastructure: prd.stacksInfrastructure,
        dataModel: prd.dataModel ?? '',
        apiSketch: prd.apiSketch ?? '',
        uiSketch: prd.uiSketch ?? '',
        cardType: 'Feature',
      });
      const hasTech = prd.stacksFrontend || prd.stacksBackend || prd.stacksInfrastructure || prd.dataModel || prd.apiSketch || prd.uiSketch;
      if (hasTech) setShowTechnical(true);
      setTab('manual');
    } catch {
      setAiError('AI-generering feilet. Prøv igjen eller fyll inn skjemaet manuelt.');
    } finally {
      setAiLoading(false);
    }
  }

  function validate(): boolean {
    const newErrors: Partial<FormState> = {};
    if (!form.title.trim()) newErrors.title = 'Navn er påkrevd';
    if (!form.summary.trim()) newErrors.summary = 'Sammendrag er påkrevd';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        summary: form.summary.trim(),
        motivation: form.motivation.trim(),
        requirements: form.requirements.trim(),
        outOfScope: form.outOfScope.trim() || undefined,
        openQuestions: form.openQuestions.trim() || undefined,
        stacksFrontend: form.stacksFrontend,
        stacksBackend: form.stacksBackend,
        stacksInfrastructure: form.stacksInfrastructure,
        dataModel: form.dataModel.trim() || undefined,
        apiSketch: form.apiSketch.trim() || undefined,
        uiSketch: form.uiSketch.trim() || undefined,
        cardType: form.cardType,
      };
      if (isEdit) {
        await featurePlannerService.updateCard(card.id, payload, token);
      } else {
        await featurePlannerService.createCard({ ...payload, columnId }, token);
      }
      onSaved();
    } catch {
      setErrors({ title: 'Kunne ikke lagre. Prøv igjen.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-700"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <h2 className="text-lg font-bold text-white">
            {isEdit ? (isEditingBug ? 'Rediger bug' : 'Rediger funksjon') : 'Ny funksjon'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs (only for new cards) */}
        {!isEdit && (
          <div className="flex border-b border-slate-800 shrink-0">
            <TabButton active={tab === 'ai'} onClick={() => setTab('ai')}>
              ✨ Beskriv det, AI fyller inn
            </TabButton>
            <TabButton active={tab === 'manual'} onClick={() => setTab('manual')}>
              Skriv det selv
            </TabButton>
          </div>
        )}

        <div className="overflow-y-auto flex-1 p-6">
          {tab === 'ai' && !isEdit ? (
            <div className="space-y-4">
              <p className="text-slate-400 text-sm leading-relaxed">
                Beskriv funksjonen med egne ord. AI fyller inn detaljene — du kan se gjennom og redigere alt før du lagrer.
              </p>
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="f.eks. Jeg vil legge til en handleliste som genereres automatisk fra ukesplanen, slik at brukerne vet hva de skal kjøpe"
                rows={5}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:border-blue-500"
              />
              {aiError && <p className="text-red-400 text-sm">{aiError}</p>}
              <button
                onClick={handleGenerate}
                disabled={!aiPrompt.trim() || aiLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                {aiLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Genererer...
                  </>
                ) : (
                  'Generer med AI'
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Card type toggle — hidden when editing an existing bug */}
              {!isEditingBug && <div className="flex rounded-xl overflow-hidden border border-slate-700">
                <button
                  type="button"
                  onClick={() => setField('cardType', 'Feature')}
                  className={`flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    form.cardType === 'Feature'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Feature
                </button>
                <button
                  type="button"
                  onClick={() => setField('cardType', 'Bug')}
                  className={`flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    form.cardType === 'Bug'
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Bug
                </button>
              </div>}

              <Field label={form.cardType === 'Bug' ? 'Navn på buggen' : 'Navn på funksjonen'} required error={errors.title}>
                <input
                  value={form.title}
                  onChange={e => setField('title', e.target.value)}
                  placeholder="f.eks. Handleliste fra ukesplan"
                  className={inputClass(!!errors.title)}
                />
              </Field>

              <Field label={form.cardType === 'Bug' ? 'Beskrivelse' : 'Hva gjør denne funksjonen?'} required error={errors.summary}>
                <textarea
                  value={form.summary}
                  onChange={e => setField('summary', e.target.value)}
                  placeholder={form.cardType === 'Bug' ? 'Hva skjer? Hva forventet du skulle skje?' : '1-2 setninger om hva funksjonen gjør og hvilken verdi den gir'}
                  rows={2}
                  className={`${inputClass(!!errors.summary)} resize-none`}
                />
              </Field>

              <Field label={form.cardType === 'Bug' ? 'Steg for å reprodusere' : 'Hva må det gjøre?'}>
                <textarea
                  value={form.requirements}
                  onChange={e => setField('requirements', e.target.value)}
                  placeholder={form.cardType === 'Bug'
                    ? '1. Gå til siden\n2. Klikk på knappen\n3. Se feilen'
                    : '- Brukere kan generere en handleliste fra en valgt uke\n- Varer grupperes etter kategori\n- Brukere kan huke av varer'}
                  rows={4}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:border-blue-500 font-mono"
                />
              </Field>

              {form.cardType === 'Feature' && (
                <>
                  <Field label="Hvorfor trenger vi det?">
                    <textarea
                      value={form.motivation}
                      onChange={e => setField('motivation', e.target.value)}
                      placeholder="Hvilket problem løser dette for brukerne?"
                      rows={2}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:border-blue-500"
                    />
                  </Field>

                  <Field label="Hva er IKKE inkludert?">
                    <textarea
                      value={form.outOfScope}
                      onChange={e => setField('outOfScope', e.target.value)}
                      placeholder="- Dele handlelister med andre&#10;- Synkronisering med eksterne apper"
                      rows={3}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </Field>

                  <Field label="Åpne spørsmål">
                    <textarea
                      value={form.openQuestions}
                      onChange={e => setField('openQuestions', e.target.value)}
                      placeholder="- Skal brukere kunne redigere varer etter generering?&#10;- Én liste per uke eller per ukesplan?"
                      rows={3}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </Field>
                </>
              )}

              {/* Technical section — Features only */}
              {form.cardType === 'Feature' && <div className="border border-slate-700 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowTechnical(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/60 text-slate-400 hover:text-slate-300 transition-colors text-sm"
                >
                  <span>Tekniske notater <span className="text-slate-600">(for utviklere — valgfritt)</span></span>
                  <svg className={`w-4 h-4 transition-transform ${showTechnical ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showTechnical && (
                  <div className="p-4 space-y-4">
                    <div>
                      <div className="text-xs text-slate-500 mb-2">Hvilke deler av appen påvirkes?</div>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                          <input type="checkbox" checked={form.stacksFrontend} onChange={e => setField('stacksFrontend', e.target.checked)} className="rounded" />
                          Frontend
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                          <input type="checkbox" checked={form.stacksBackend} onChange={e => setField('stacksBackend', e.target.checked)} className="rounded" />
                          Backend
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                          <input type="checkbox" checked={form.stacksInfrastructure} onChange={e => setField('stacksInfrastructure', e.target.checked)} className="rounded" />
                          Infrastruktur
                        </label>
                      </div>
                    </div>

                    <Field label="Hvilke data må lagres?">
                      <textarea
                        value={form.dataModel}
                        onChange={e => setField('dataModel', e.target.value)}
                        placeholder="f.eks. ShoppingList: id, weekStart, groupId, items (JSON)"
                        rows={2}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </Field>

                    <Field label="Hvilke API-endepunkter trengs?">
                      <textarea
                        value={form.apiSketch}
                        onChange={e => setField('apiSketch', e.target.value)}
                        placeholder="POST /api/shopping-list/generate&#10;GET /api/shopping-list/{weekStart}"
                        rows={2}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </Field>

                    <Field label="Hvilke skjermer eller sider trengs?">
                      <textarea
                        value={form.uiSketch}
                        onChange={e => setField('uiSketch', e.target.value)}
                        placeholder="Ny side /handleliste. Viser varer gruppert etter kategori. Avkrysningsboks per vare."
                        rows={2}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:border-blue-500"
                      />
                    </Field>
                  </div>
                )}
              </div>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 shrink-0">
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 px-4 py-2 rounded-lg text-sm transition-colors">
            Avbryt
          </button>
          {tab === 'manual' || isEdit ? (
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? 'Lagrer...' : isEdit ? 'Lagre endringer' : 'Legg til tavlen'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
        active
          ? 'border-blue-500 text-white'
          : 'border-transparent text-slate-500 hover:text-slate-300'
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-slate-300 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

function inputClass(hasError: boolean) {
  return `w-full bg-slate-800 border ${hasError ? 'border-red-500' : 'border-slate-700'} rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500`;
}
