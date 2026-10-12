"use client";

import { useRef, useState } from "react";
import {
  LOCATION_LABELS,
  STOCK_LOCATIONS,
  stockService,
  type DraftItem,
  type ScanMode,
  type StockItem,
  type StockLocation,
} from "@/lib/services/stock.service";
import { formatAmount } from "./stockDisplay";

interface Props {
  groupId: number;
  token: string;
  /** The whole current stock; used to preview what saving would change. */
  stock: StockItem[];
  onSaved: (message: string) => void;
  onCancel: () => void;
}

interface DraftRow {
  key: number;
  name: string;
  quantity: string;
  unit: string;
}

function parseQuantity(text: string): number | null | undefined {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/\(.*?\)/g, "").split(",")[0].trim();
}

/** Mirrors the server's matching closely enough to preview; the server decides on save. */
function matchExisting(row: DraftRow, existing: StockItem[]): StockItem | undefined {
  const name = normalize(row.name);
  if (!name) return undefined;
  return existing.find(
    (s) =>
      normalize(s.name) === name &&
      (!row.unit.trim() || !s.unit || s.unit.toLowerCase() === row.unit.trim().toLowerCase())
  );
}

export function ScanFlow({ groupId, token, stock, onSaved, onCancel }: Props) {
  const nextKey = useRef(1);
  const [location, setLocation] = useState<StockLocation>("kjoleskap");
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<DraftRow[] | null>(null);
  const [mode, setMode] = useState<ScanMode>("legg-til");
  const [keepIds, setKeepIds] = useState<Set<number>>(new Set());
  const [instruction, setInstruction] = useState("");
  const [lookAgain, setLookAgain] = useState(false);
  const [applied, setApplied] = useState<string[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toRows = (items: DraftItem[]): DraftRow[] =>
    items.map((i) => ({
      key: nextKey.current++,
      name: i.name,
      quantity: i.quantity === null ? "" : String(i.quantity).replace(".", ","),
      unit: i.unit ?? "",
    }));

  /** Null when a row has an unreadable quantity; the error is set as a side effect. */
  function toDraft(): DraftItem[] | null {
    const items: DraftItem[] = [];
    for (const row of rows ?? []) {
      if (!row.name.trim()) continue;
      const quantity = parseQuantity(row.quantity);
      if (quantity === undefined) {
        setError(`Antall for «${row.name.trim()}» må være et tall`);
        return null;
      }
      items.push({ name: row.name.trim(), quantity, unit: row.unit.trim() || null });
    }
    return items;
  }

  async function handleScan() {
    setBusy(true);
    setError(null);
    try {
      const result = await stockService.scan(groupId, location, files, token);
      setRows(toRows(result.items));
      setApplied([]);
      setRejected([]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Kunne ikke lese bildet");
    } finally {
      setBusy(false);
    }
  }

  async function handleCorrect() {
    const draft = toDraft();
    if (!draft || !instruction.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await stockService.correctDraft(
        groupId,
        draft,
        instruction.trim(),
        lookAgain ? files : [],
        token
      );
      setRows(toRows(result.items));
      setApplied(result.applied);
      setRejected(result.rejected);
      setInstruction("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Kunne ikke rette utkastet");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    const draft = toDraft();
    if (!draft) return;
    if (draft.length === 0) {
      setError("Utkastet er tomt — legg til minst én vare");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await stockService.applyScan(
        groupId,
        { location, mode, items: draft, keepIds: [...keepIds] },
        token
      );
      const parts = [
        result.added > 0 ? `${result.added} nye` : null,
        result.updated > 0 ? `${result.updated} oppdatert` : null,
        result.removed > 0 ? `${result.removed} fjernet` : null,
      ].filter(Boolean);
      onSaved(parts.length > 0 ? `Lagret: ${parts.join(", ")}` : "Ingen endringer");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Kunne ikke lagre beholdningen");
      setBusy(false);
    }
  }

  function updateRow(key: number, changes: Partial<DraftRow>) {
    setRows((prev) => prev?.map((r) => (r.key === key ? { ...r, ...changes } : r)) ?? null);
  }

  function toggleKeep(id: number) {
    setKeepIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const inputClass =
    "border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

  // --- Step 1: choose location and photos ---
  if (rows === null) {
    return (
      <div data-testid="scan-start" className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
        <h2 className="font-semibold text-gray-900">Skann med bilde</h2>
        <p className="text-sm text-gray-600">
          Ta bilde av kjøleskapet, fryseren eller skapet. Du får se gjennom listen før noe lagres.
        </p>

        <div>
          <label htmlFor="scan-location" className="block text-sm text-gray-600 mb-1">Hva er på bildet?</label>
          <select
            id="scan-location"
            value={location}
            onChange={(e) => setLocation(e.target.value as StockLocation)}
            className={`${inputClass} w-full`}
          >
            {STOCK_LOCATIONS.map((l) => (
              <option key={l} value={l}>{LOCATION_LABELS[l]}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="scan-files" className="block text-sm text-gray-600 mb-1">Bilder (maks 4)</label>
          <input
            id="scan-files"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 4))}
            className="block w-full text-sm"
          />
          {files.length > 0 && (
            <p className="text-sm text-gray-500 mt-1">{files.length} {files.length === 1 ? "bilde" : "bilder"} valgt</p>
          )}
        </div>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Avbryt
          </button>
          <button
            onClick={handleScan}
            disabled={busy || files.length === 0}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Leser bildet …" : "Les av bildet"}
          </button>
        </div>
      </div>
    );
  }

  // --- Step 2: review ---
  const existing = stock.filter((s) => s.location === location);
  const matchedIds = new Set<number>();
  const badges = rows.map((row) => {
    const match = matchExisting(row, existing);
    if (match) matchedIds.add(match.id);
    return match;
  });
  const removable =
    mode === "erstatt" ? existing.filter((s) => !s.isStaple && !matchedIds.has(s.id)) : [];

  return (
    <div data-testid="scan-review" className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-4">
      <div>
        <h2 className="font-semibold text-gray-900">Gjennomgå: {LOCATION_LABELS[location].toLowerCase()}</h2>
        <p className="text-sm text-gray-600">Rett opp det som er feil. Ingenting er lagret ennå.</p>
      </div>

      <ul className="space-y-2" data-testid="draft-list">
        {rows.length === 0 && <li className="text-sm text-gray-500">Ingen varer funnet. Legg til under.</li>}
        {rows.map((row, i) => (
          <li key={row.key} data-testid="draft-row" className="flex flex-wrap items-center gap-2">
            <input
              aria-label="Navn"
              value={row.name}
              onChange={(e) => updateRow(row.key, { name: e.target.value })}
              maxLength={100}
              className={`${inputClass} flex-1 min-w-[8rem]`}
            />
            <input
              aria-label="Antall"
              inputMode="decimal"
              value={row.quantity}
              onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
              className={`${inputClass} w-16`}
            />
            <input
              aria-label="Enhet"
              value={row.unit}
              onChange={(e) => updateRow(row.key, { unit: e.target.value })}
              maxLength={20}
              className={`${inputClass} w-16`}
            />
            <span
              data-testid="draft-badge"
              className={`text-xs px-2 py-0.5 rounded-full ${
                badges[i] ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"
              }`}
            >
              {badges[i] ? "finnes" : "ny"}
            </span>
            <button
              onClick={() => setRows((prev) => prev?.filter((r) => r.key !== row.key) ?? null)}
              aria-label={`Fjern ${row.name || "rad"} fra utkastet`}
              className="text-sm text-red-600 hover:underline min-h-[44px] px-1"
            >
              Fjern
            </button>
          </li>
        ))}
      </ul>

      <button
        onClick={() => setRows((prev) => [...(prev ?? []), { key: nextKey.current++, name: "", quantity: "", unit: "" }])}
        className="text-sm text-blue-600 hover:underline"
      >
        + Legg til rad
      </button>

      <fieldset className="border-t border-gray-100 pt-3">
        <legend className="text-sm font-medium text-gray-700 mb-1">Hva skal skje med det som allerede er registrert?</legend>
        <label className="flex items-start gap-2 text-sm text-gray-700 mb-1">
          <input type="radio" name="scan-mode" checked={mode === "legg-til"} onChange={() => setMode("legg-til")} className="mt-1" />
          <span>Legg til og oppdater — behold resten</span>
        </label>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="radio" name="scan-mode" checked={mode === "erstatt"} onChange={() => setMode("erstatt")} className="mt-1" />
          <span>Erstatt — fjern varer som ikke er på bildet (basisvarer beholdes alltid)</span>
        </label>

        {removable.length > 0 && (
          <div data-testid="removal-list" className="mt-3">
            <p className="text-sm text-gray-600 mb-1">Disse fjernes. Huk av de du vil beholde:</p>
            <ul className="space-y-1">
              {removable.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    id={`keep-${s.id}`}
                    checked={keepIds.has(s.id)}
                    onChange={() => toggleKeep(s.id)}
                  />
                  <label htmlFor={`keep-${s.id}`} className="text-gray-800">
                    Behold {s.name}
                    {formatAmount(s.quantity, s.unit) && ` (${formatAmount(s.quantity, s.unit)})`}
                  </label>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700">
                    {keepIds.has(s.id) ? "beholdes" : "fjernes"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </fieldset>

      <div className="border-t border-gray-100 pt-3">
        <label htmlFor="scan-instruction" className="block text-sm font-medium text-gray-700 mb-1">
          Rett med tekst
        </label>
        <div className="flex gap-2">
          <input
            id="scan-instruction"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            maxLength={500}
            placeholder="F.eks. fjern yoghurten, det er 2 melk, legg til 12 egg"
            className={`${inputClass} flex-1`}
          />
          <button
            onClick={handleCorrect}
            disabled={busy || !instruction.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-50"
          >
            Rett
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 mt-2">
          <input type="checkbox" checked={lookAgain} onChange={(e) => setLookAgain(e.target.checked)} />
          Se på bildet igjen
        </label>

        {applied.length > 0 && (
          <ul data-testid="correction-applied" className="mt-2 text-sm text-green-800 list-disc list-inside">
            {applied.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        )}
        {rejected.length > 0 && (
          <ul data-testid="correction-rejected" className="mt-2 text-sm text-amber-800 list-disc list-inside">
            {rejected.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          Avbryt
        </button>
        <button
          onClick={handleSave}
          disabled={busy || rows.length === 0}
          className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Jobber …" : "Lagre"}
        </button>
      </div>
    </div>
  );
}
