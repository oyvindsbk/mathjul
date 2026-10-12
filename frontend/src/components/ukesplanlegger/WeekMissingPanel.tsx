"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  stockService,
  type MissingIngredient,
  type ShoppingListItemInput,
  type WeekCoverage,
} from "@/lib/services/stock.service";
import { formatAmount } from "@/components/beholdning/stockDisplay";
import { formatDate } from "./entryDisplay";

interface Props {
  groupId: number;
  token: string;
  weekStart: Date;
  onClose: () => void;
}

/** One checkbox per ingredient; ingredients the household has no trace of start checked. */
export function WeekMissingPanel({ groupId, token, weekStart, onClose }: Props) {
  const [coverage, setCoverage] = useState<WeekCoverage | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState<number | null>(null);

  const weekKey = formatDate(weekStart);

  useEffect(() => {
    let cancelled = false;
    stockService
      .getWeekCoverage(groupId, weekKey, token)
      .then((data) => {
        if (cancelled) return;
        setCoverage(data);
        setChecked(new Set(data.missing.filter((m) => m.status === "mangler").map((m) => m.normalizedName)));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Kunne ikke hente ukas dekning");
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, token, weekKey]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function toggle(item: MissingIngredient) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(item.normalizedName)) next.delete(item.normalizedName);
      else next.add(item.normalizedName);
      return next;
    });
  }

  async function handleAdd() {
    if (!coverage) return;
    // One list entry per distinct unit, since amounts in different units are not added together.
    const items: ShoppingListItemInput[] = coverage.missing
      .filter((m) => checked.has(m.normalizedName))
      .flatMap((m) =>
        (m.quantities.length > 0 ? m.quantities : [{ quantity: null, unit: null }]).map((q) => ({
          name: m.name,
          quantity: q.quantity,
          unit: q.unit,
          note: m.recipes.join(", ").slice(0, 200) || null,
          source: "ukeplan" as const,
        }))
      );
    if (items.length === 0) return;

    setSaving(true);
    setError(null);
    try {
      await stockService.addShoppingItems(groupId, items, token);
      setAdded(checked.size);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Kunne ikke legge til på handlelisten");
    } finally {
      setSaving(false);
    }
  }

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const range = `${weekStart.toLocaleDateString("nb-NO", { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}`;

  const withoutIngredients = coverage?.entries.filter((e) => e.withoutIngredients) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        data-testid="week-missing-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="week-missing-heading"
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 pt-5 pb-3 shrink-0">
          <div>
            <h2 id="week-missing-heading" className="text-base font-semibold text-gray-900">Hva mangler denne uka?</h2>
            <p className="text-xs text-gray-500">{range}</p>
          </div>
          <button onClick={onClose} aria-label="Lukk" className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {error && <p role="alert" className="text-sm text-red-600 mb-2">{error}</p>}
          {!coverage && !error && <p className="text-sm text-gray-500 py-2">Laster …</p>}

          {coverage && added === null && (
            <>
              {coverage.entries.length === 0 && (
                <p className="text-sm text-gray-500 py-2">Ingen måltider er planlagt denne uka.</p>
              )}
              {coverage.entries.length > 0 && coverage.missing.length === 0 && (
                <p data-testid="nothing-missing" className="text-sm text-green-700 py-2">
                  Dere har alt som trengs til ukas oppskrifter.
                </p>
              )}

              <ul className="divide-y divide-gray-100">
                {coverage.missing.map((item) => {
                  const amounts = item.quantities.map((q) => formatAmount(q.quantity, q.unit)).filter(Boolean).join(" + ");
                  return (
                    <li key={item.normalizedName} data-testid="missing-item" className="py-2">
                      <label className="flex items-start gap-3 min-h-[44px]">
                        <input
                          type="checkbox"
                          checked={checked.has(item.normalizedName)}
                          onChange={() => toggle(item)}
                          className="mt-1 h-5 w-5"
                        />
                        <span className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900">{item.name}</span>
                          {amounts && <span className="text-sm text-gray-500"> · {amounts}</span>}
                          {item.status === "kanskje" && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              kanskje har dere
                            </span>
                          )}
                          <span className="block text-xs text-gray-500">til {item.recipes.join(", ")}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              {withoutIngredients.length > 0 && (
                <p data-testid="without-ingredients" className="text-xs text-gray-500 italic mt-3">
                  Ikke med i oversikten (ingen ingrediensliste): {withoutIngredients.map((e) => e.title).join(", ")}
                </p>
              )}
            </>
          )}

          {added !== null && (
            <p role="status" className="text-sm text-green-800 py-2">
              {added} {added === 1 ? "vare" : "varer"} lagt på handlelisten.{" "}
              <Link href={`/beholdning?tab=handleliste&groupId=${groupId}`} className="text-blue-600 hover:underline">
                Åpne handlelisten
              </Link>
            </p>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 shrink-0 border-t border-gray-100 mt-3">
          <button
            onClick={onClose}
            className="flex-1 min-h-[44px] rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {added !== null ? "Lukk" : "Avbryt"}
          </button>
          {added === null && (
            <button
              onClick={handleAdd}
              disabled={saving || checked.size === 0}
              className="flex-1 min-h-[44px] rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {saving ? "Legger til …" : "Legg på handlelisten"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
