'use client';

import type { BugCardData, FeatureCardData } from '@/lib/services/feature-planner.service';

function isBugCard(card: FeatureCardData): card is BugCardData {
  return card.cardType === 'Bug';
}

interface CardDetailModalProps {
  card: FeatureCardData;
  onClose: () => void;
  onEdit: (card: FeatureCardData) => void;
  onDelete: (cardId: number) => void;
}

export function CardDetailModal({ card, onClose, onEdit, onDelete }: CardDetailModalProps) {
  const [showTechnical, setShowTechnical] = React.useState(
    card.stacksFrontend || card.stacksBackend || card.stacksInfrastructure
  );
  const [copied, setCopied] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  function buildMarkdown(): string {
    const lines: string[] = [];
    lines.push(`# ${card.title}`);
    lines.push('');
    if (card.cardType === 'Bug') {
      lines.push(`## Beskrivelse`);
      lines.push(card.summary);
      if (isBugCard(card) && card.bugUrl) {
        lines.push('');
        lines.push(`## URL`);
        lines.push(card.bugUrl);
      }
      if (card.requirements) {
        lines.push('');
        lines.push(`## Steg for å reprodusere`);
        lines.push(card.requirements);
      }
    } else {
      lines.push(`## Sammendrag`);
      lines.push(card.summary);
      lines.push('');
      lines.push(`## Motivasjon`);
      lines.push(card.motivation);
      lines.push('');
      lines.push(`## Krav`);
      lines.push(card.requirements);
      if (card.outOfScope) {
        lines.push('');
        lines.push(`## Utenfor scope`);
        lines.push(card.outOfScope);
      }
      if (card.openQuestions) {
        lines.push('');
        lines.push(`## Åpne spørsmål`);
        lines.push(card.openQuestions);
      }
      const hasTech = card.stacksFrontend || card.stacksBackend || card.stacksInfrastructure
        || card.dataModel || card.apiSketch || card.uiSketch;
      if (hasTech) {
        lines.push('');
        lines.push(`## Tekniske notater`);
        const stacks = [
          card.stacksFrontend && 'Frontend',
          card.stacksBackend && 'Backend',
          card.stacksInfrastructure && 'Infrastruktur',
        ].filter(Boolean);
        if (stacks.length > 0) lines.push(`**Stacks:** ${stacks.join(', ')}`);
        if (card.dataModel) { lines.push(''); lines.push(`### Datamodell`); lines.push(card.dataModel); }
        if (card.apiSketch) { lines.push(''); lines.push(`### API`); lines.push(card.apiSketch); }
        if (card.uiSketch) { lines.push(''); lines.push(`### UI`); lines.push(card.uiSketch); }
      }
    }
    return lines.join('\n');
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(buildMarkdown());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSave() {
    const a = document.createElement('a');
    a.href = card.uiSketch!;
    a.download = `${card.title.replace(/[^a-zA-Z0-9æøåÆØÅ\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
  }

  const hasTechnical = card.stacksFrontend || card.stacksBackend || card.stacksInfrastructure
    || card.dataModel || card.apiSketch || card.uiSketch;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-700"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 pr-4">
            {card.cardType === 'Bug' && (
              <span className="shrink-0 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">Bug</span>
            )}
            <h2 className="text-xl font-bold text-white leading-snug">{card.title}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {card.cardType === 'Bug' ? (
            <>
              <Section label="Beskrivelse" content={card.summary} />
              {isBugCard(card) && card.bugUrl && (
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">URL</div>
                  <a
                    href={(card as BugCardData).bugUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-sm break-all transition-colors"
                  >
                    {(card as BugCardData).bugUrl}
                  </a>
                </div>
              )}
              {card.requirements && <Section label="Steg for å reprodusere" content={card.requirements} markdown />}
              {card.uiSketch && (
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">Skjermbilde</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card.uiSketch}
                    alt="Skjermbilde"
                    className="w-full rounded-lg border border-slate-700 max-h-72 object-contain bg-slate-800"
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <Section label="Sammendrag" content={card.summary} />
              <Section label="Motivasjon" content={card.motivation} />
              <Section label="Hva må det gjøre?" content={card.requirements} markdown />
              {card.outOfScope && <Section label="Utenfor scope" content={card.outOfScope} markdown />}
              {card.openQuestions && <Section label="Åpne spørsmål" content={card.openQuestions} markdown />}

              {hasTechnical && (
                <div className="border border-slate-700 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowTechnical(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/60 text-slate-300 hover:text-white transition-colors text-sm font-medium"
                  >
                    <span>Tekniske notater (for utviklere)</span>
                    <svg className={`w-4 h-4 transition-transform ${showTechnical ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showTechnical && (
                    <div className="p-4 space-y-4">
                      {(card.stacksFrontend || card.stacksBackend || card.stacksInfrastructure) && (
                        <div>
                          <div className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">Stacks</div>
                          <div className="flex gap-2">
                            {card.stacksFrontend && <StackBadge label="Frontend" color="blue" />}
                            {card.stacksBackend && <StackBadge label="Backend" color="green" />}
                            {card.stacksInfrastructure && <StackBadge label="Infrastruktur" color="purple" />}
                          </div>
                        </div>
                      )}
                      {card.dataModel && <Section label="Datamodell" content={card.dataModel} markdown />}
                      {card.apiSketch && <Section label="API" content={card.apiSketch} markdown />}
                      {card.uiSketch && <Section label="UI" content={card.uiSketch} markdown />}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-800 shrink-0 gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(card)}
              className="text-slate-300 hover:text-white hover:bg-slate-700 px-3 py-2 rounded-lg text-sm transition-colors"
            >
              Rediger
            </button>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-red-400 text-sm">Slette dette kortet?</span>
                <button onClick={() => onDelete(card.id)} className="text-red-400 hover:text-red-300 text-sm font-medium">Ja, slett</button>
                <button onClick={() => setConfirmDelete(false)} className="text-slate-400 hover:text-slate-300 text-sm">Avbryt</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-slate-500 hover:text-red-400 px-3 py-2 rounded-lg text-sm transition-colors"
              >
                Slett
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {card.uiSketch && (
              <button
                onClick={handleSave}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Lagre bilde
              </button>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Kopiert!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Kopier til VS Code
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ label, content, markdown = false }: { label: string; content: string; markdown?: boolean }) {
  return (
    <div>
      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">{label}</div>
      {markdown ? (
        <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{content}</div>
      ) : (
        <div className="text-slate-300 text-sm leading-relaxed">{content}</div>
      )}
    </div>
  );
}

function StackBadge({ label, color }: { label: string; color: 'blue' | 'green' | 'purple' }) {
  const colors = {
    blue: 'bg-blue-900/50 text-blue-300',
    green: 'bg-green-900/50 text-green-300',
    purple: 'bg-purple-900/50 text-purple-300',
  };
  return <span className={`text-xs px-2 py-1 rounded ${colors[color]}`}>{label}</span>;
}

import React from 'react';
