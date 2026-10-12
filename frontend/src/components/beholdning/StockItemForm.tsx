"use client";

import { useState } from "react";
import {
  LOCATION_LABELS,
  STOCK_LOCATIONS,
  type StockItem,
  type StockItemInput,
  type StockLocation,
} from "@/lib/services/stock.service";

interface Props {
  /** Present when editing; absent when adding. */
  item?: StockItem;
  defaultLocation?: StockLocation;
  onSave: (input: StockItemInput) => Promise<void>;
  onCancel: () => void;
}

function parseQuantity(text: string): number | null {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function StockItemForm({ item, defaultLocation = "kjoleskap", onSave, onCancel }: Props) {
  const [name, setName] = useState(item?.name ?? "");
  const [quantity, setQuantity] = useState(item?.quantity?.toString().replace(".", ",") ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [location, setLocation] = useState<StockLocation>(item?.location ?? defaultLocation);
  const [bestBefore, setBestBefore] = useState(item?.bestBefore ?? "");
  const [isStaple, setIsStaple] = useState(item?.isStaple ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Skriv et navn");
      return;
    }
    const parsed = parseQuantity(quantity);
    if (quantity.trim() !== "" && parsed === null) {
      setError("Antall må være et tall");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        quantity: isStaple ? null : parsed,
        unit: isStaple ? null : unit.trim() || null,
        location,
        bestBefore: bestBefore || null,
        isStaple,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Kunne ikke lagre");
      setSaving(false);
    }
  }

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="stock-form"
      className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-3"
    >
      <h2 className="font-semibold text-gray-900">{item ? "Endre vare" : "Legg til vare"}</h2>

      <div>
        <label htmlFor="stock-name" className="block text-sm text-gray-600 mb-1">Navn</label>
        <input
          id="stock-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          className={inputClass}
          autoFocus
        />
      </div>

      {!isStaple && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="stock-quantity" className="block text-sm text-gray-600 mb-1">Antall</label>
            <input
              id="stock-quantity"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="stock-unit" className="block text-sm text-gray-600 mb-1">Enhet</label>
            <input
              id="stock-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              maxLength={20}
              placeholder="stk, g, l …"
              className={inputClass}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="stock-location" className="block text-sm text-gray-600 mb-1">Plassering</label>
          <select
            id="stock-location"
            value={location}
            onChange={(e) => setLocation(e.target.value as StockLocation)}
            className={inputClass}
          >
            {STOCK_LOCATIONS.map((l) => (
              <option key={l} value={l}>{LOCATION_LABELS[l]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="stock-best-before" className="block text-sm text-gray-600 mb-1">Best før</label>
          <input
            id="stock-best-before"
            type="date"
            value={bestBefore}
            onChange={(e) => setBestBefore(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={isStaple} onChange={(e) => setIsStaple(e.target.checked)} />
        Basisvare (har alltid hjemme, f.eks. salt og olje)
      </label>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          Avbryt
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Lagrer …" : "Lagre"}
        </button>
      </div>
    </form>
  );
}
