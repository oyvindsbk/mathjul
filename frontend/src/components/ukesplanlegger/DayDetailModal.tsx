"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LEVERANDOR_COLORS, LEVERANDOR_LABELS, type Leverandor } from "@/lib/services/matkasse.service";
import type { MealPlan } from "@/lib/services/mealplan.service";
import { formatDate, formatDateLabel, parseDateKey, resolveEntryDisplay } from "./entryDisplay";
import { recipeHref } from "@/lib/recipe-url";

interface Props {
  date: Date;
  /** Entries for this date only. */
  plans: MealPlan[];
  onClose: () => void;
  onAddRecipe: () => void;
  onAddCustomCard: () => void;
  onDeleteEntry: (entryId: number) => void;
  onMoveEntry: (entryId: number, newDate: Date) => void;
  onUpdateNote: (entryId: number, title: string, note: string | null) => void;
}

/** Touch targets are 44px per the mobile baseline established in spec 028. */
const ACTION_BUTTON = "min-h-[44px] px-3 rounded-lg text-sm font-medium transition-colors";

export function DayDetailModal({
  date,
  plans,
  onClose,
  onAddRecipe,
  onAddCustomCard,
  onDeleteEntry,
  onMoveEntry,
  onUpdateNote,
}: Props) {
  const [movingEntryId, setMovingEntryId] = useState<number | null>(null);
  const [moveDate, setMoveDate] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = date < today;

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function startMove(plan: MealPlan) {
    setEditingNoteId(null);
    setMovingEntryId(plan.id);
    setMoveDate(plan.date);
  }

  function confirmMove(entryId: number) {
    if (!moveDate) return;
    onMoveEntry(entryId, parseDateKey(moveDate));
    setMovingEntryId(null);
  }

  function startNoteEdit(plan: MealPlan) {
    setMovingEntryId(null);
    setEditingNoteId(plan.id);
    setNoteTitle(plan.customTitle ?? "");
    setNoteText(plan.customNote ?? "");
  }

  function confirmNoteEdit(entryId: number) {
    const trimmed = noteTitle.trim();
    if (!trimmed) return;
    onUpdateNote(entryId, trimmed, noteText.trim() || null);
    setEditingNoteId(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        data-testid="day-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-detail-heading"
        className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 id="day-detail-heading" className="text-base font-semibold text-gray-900 capitalize">
            {formatDateLabel(date)}
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Lukk"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {plans.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-2">Ingen måltider planlagt.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {plans.map((plan) => {
                const { title, icon, matkasseLogo, sideDishTitles, isCustom, isMatkasse } = resolveEntryDisplay(plan);
                const imageUrl = isCustom ? null : isMatkasse ? plan.matkasseRecipe!.imageUrl : plan.recipe?.imageUrl;
                const description = isCustom ? null : isMatkasse ? plan.matkasseRecipe!.beskrivelse : null;
                const leverandor = isMatkasse ? (plan.matkasseRecipe!.leverandor as Leverandor) : null;
                const leverandorColors = leverandor
                  ? (LEVERANDOR_COLORS[leverandor] ?? { bg: "bg-gray-100", text: "text-gray-800", border: "border-gray-200" })
                  : null;
                const leverandorLabel = leverandor ? (LEVERANDOR_LABELS[leverandor] ?? leverandor) : null;
                return (
                  <li
                    key={plan.id}
                    data-testid="day-detail-entry"
                    className={`rounded-lg border p-3 ${isCustom ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"}`}
                  >
                    {imageUrl && (
                      <div className="aspect-video w-full overflow-hidden rounded-md mb-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      {matkasseLogo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={matkasseLogo}
                          alt={plan.matkasseRecipe!.leverandor}
                          className="w-6 h-6 object-contain rounded shrink-0"
                        />
                      ) : (
                        <span className="text-base leading-none shrink-0 mt-0.5">{icon}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        {leverandorLabel && leverandorColors && (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium mb-1 ${leverandorColors.bg} ${leverandorColors.text} ${leverandorColors.border} border`}>
                            {leverandorLabel}
                          </span>
                        )}
                        <p className={`text-sm font-medium break-words hyphens-auto ${isCustom ? "text-amber-900" : "text-gray-900"}`}>
                          {title}
                        </p>
                        {sideDishTitles.length > 0 && (
                          <div className="mt-1">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tilbehør</p>
                            <ul className="text-xs text-gray-600 break-words">
                              {sideDishTitles.map((sideDish) => (
                                <li key={sideDish}>{sideDish}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {description && (
                          <p className="text-xs text-gray-600 mt-1 leading-relaxed break-words">{description}</p>
                        )}
                        {plan.customNote && (
                          <p className="text-xs text-gray-600 mt-1 break-words">{plan.customNote}</p>
                        )}
                      </div>
                    </div>

                    {movingEntryId === plan.id ? (
                      <div className="mt-3 flex flex-col gap-2">
                        <label htmlFor={`move-date-${plan.id}`} className="text-xs font-medium text-gray-700">
                          Flytt til dato
                        </label>
                        <input
                          id={`move-date-${plan.id}`}
                          type="date"
                          value={moveDate}
                          onChange={(e) => setMoveDate(e.target.value)}
                          className="w-full min-h-[44px] rounded-lg border border-gray-300 px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setMovingEntryId(null)}
                            className={`${ACTION_BUTTON} flex-1 border border-gray-300 text-gray-700 hover:bg-gray-100`}
                          >
                            Avbryt
                          </button>
                          <button
                            onClick={() => confirmMove(plan.id)}
                            disabled={!moveDate || moveDate === plan.date}
                            className={`${ACTION_BUTTON} flex-1 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed`}
                          >
                            Flytt
                          </button>
                        </div>
                      </div>
                    ) : editingNoteId === plan.id ? (
                      <div className="mt-3 flex flex-col gap-2">
                        <label htmlFor={`note-title-${plan.id}`} className="text-xs font-medium text-gray-700">
                          Tittel
                        </label>
                        <input
                          id={`note-title-${plan.id}`}
                          type="text"
                          value={noteTitle}
                          onChange={(e) => setNoteTitle(e.target.value)}
                          maxLength={100}
                          className="w-full min-h-[44px] rounded-lg border border-gray-300 px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <label htmlFor={`note-text-${plan.id}`} className="text-xs font-medium text-gray-700">
                          Notat
                        </label>
                        <textarea
                          id={`note-text-${plan.id}`}
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          maxLength={300}
                          rows={3}
                          placeholder="Legg til en kort beskrivelse…"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingNoteId(null)}
                            className={`${ACTION_BUTTON} flex-1 border border-gray-300 text-gray-700 hover:bg-gray-100`}
                          >
                            Avbryt
                          </button>
                          <button
                            onClick={() => confirmNoteEdit(plan.id)}
                            disabled={!noteTitle.trim()}
                            className={`${ACTION_BUTTON} flex-1 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed`}
                          >
                            Lagre
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {plan.recipeId != null && (
                          <Link
                            href={recipeHref(plan.recipeId, plan.recipe?.title ?? "")}
                            className={`${ACTION_BUTTON} inline-flex items-center text-blue-600 hover:bg-blue-50`}
                          >
                            Åpne
                          </Link>
                        )}
                        <button
                          onClick={() => startMove(plan)}
                          className={`${ACTION_BUTTON} text-gray-700 hover:bg-gray-100`}
                        >
                          Flytt
                        </button>
                        {isCustom && (
                          <button
                            onClick={() => startNoteEdit(plan)}
                            className={`${ACTION_BUTTON} text-gray-700 hover:bg-gray-100`}
                          >
                            Notat
                          </button>
                        )}
                        <button
                          onClick={() => onDeleteEntry(plan.id)}
                          className={`${ACTION_BUTTON} text-red-600 hover:bg-red-50`}
                        >
                          Fjern
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {!isPast && (
          <div className="flex flex-col gap-2 px-5 py-4 shrink-0 border-t border-gray-100 mt-3">
            <button
              onClick={onAddRecipe}
              className={`${ACTION_BUTTON} bg-blue-600 text-white hover:bg-blue-700`}
            >
              + Legg til oppskrift
            </button>
            <button
              onClick={onAddCustomCard}
              className={`${ACTION_BUTTON} border border-gray-300 text-gray-700 hover:bg-gray-50`}
            >
              + Legg til notat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Entries belonging to the given day, in the order the API returned them. */
export function plansForDate(plans: MealPlan[], date: Date): MealPlan[] {
  const key = formatDate(date);
  return plans.filter((p) => p.date === key);
}
