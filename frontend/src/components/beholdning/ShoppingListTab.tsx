"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LOCATION_LABELS,
  STOCK_LOCATIONS,
  stockService,
  type ShoppingListItem,
  type StockLocation,
} from "@/lib/services/stock.service";
import { formatAmount } from "./stockDisplay";

interface Props {
  groupId: number;
  token: string;
  onError: (message: string) => void;
}

function parseQuantity(text: string): number | null {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function ShoppingListTab({ groupId, token, onError }: Props) {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [moveLocation, setMoveLocation] = useState<StockLocation>("kjoleskap");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await stockService.getShoppingList(groupId, token));
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : "Kunne ikke hente handlelisten");
    } finally {
      setLoading(false);
    }
  }, [groupId, token, onError]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    try {
      await action();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const parsed = parseQuantity(quantity);
    if (quantity.trim() !== "" && parsed === null) {
      onError("Antall må være et tall");
      return;
    }
    await run(async () => {
      await stockService.addShoppingItems(
        groupId,
        [{ name: name.trim(), quantity: parsed, unit: unit.trim() || null }],
        token
      );
      setName("");
      setQuantity("");
      setUnit("");
      await load();
    }, "Kunne ikke legge til varen");
  }

  async function toggle(item: ShoppingListItem) {
    await run(async () => {
      const updated = await stockService.updateShoppingItem(
        groupId,
        item.id,
        { status: item.status === "aapen" ? "kjopt" : "aapen" },
        token
      );
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    }, "Kunne ikke oppdatere varen");
  }

  async function remove(item: ShoppingListItem) {
    await run(async () => {
      await stockService.deleteShoppingItem(groupId, item.id, token);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    }, "Kunne ikke slette varen");
  }

  async function clearBought() {
    await run(async () => {
      await stockService.clearBought(groupId, token);
      await load();
    }, "Kunne ikke tømme kjøpte varer");
  }

  async function moveToStock() {
    await run(async () => {
      const { moved } = await stockService.moveBoughtToStock(groupId, moveLocation, token);
      setNotice(`${moved} ${moved === 1 ? "vare" : "varer"} lagt i ${LOCATION_LABELS[moveLocation].toLowerCase()}`);
      await load();
    }, "Kunne ikke flytte varene til beholdningen");
  }

  if (loading) return <p className="text-gray-500 text-sm">Laster …</p>;

  const open = items.filter((i) => i.status === "aapen");
  const bought = items.filter((i) => i.status === "kjopt");

  const inputClass =
    "border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

  function renderRow(item: ShoppingListItem) {
    const done = item.status === "kjopt";
    const amount = formatAmount(item.quantity, item.unit);
    return (
      <li key={item.id} data-testid="shopping-item" className="flex items-center gap-3 px-4 py-3">
        <input
          type="checkbox"
          checked={done}
          disabled={busy}
          onChange={() => toggle(item)}
          aria-label={`${done ? "Angre kjøpt" : "Kjøpt"}: ${item.name}`}
          className="h-5 w-5"
        />
        <div className="flex-1 min-w-0">
          <span className={`font-medium ${done ? "line-through text-gray-400" : "text-gray-900"}`}>{item.name}</span>
          {amount && <span className="text-sm text-gray-500"> · {amount}</span>}
          {item.source === "ukeplan" && (
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">Fra ukeplanen</span>
          )}
          {item.note && <p className="text-sm text-gray-500">{item.note}</p>}
        </div>
        <button
          onClick={() => remove(item)}
          disabled={busy}
          aria-label={`Slett ${item.name}`}
          className="text-sm text-red-600 hover:underline min-h-[44px] px-1"
        >
          Slett
        </button>
      </li>
    );
  }

  return (
    <div data-testid="shopping-tab">
      <form onSubmit={handleAdd} className="flex flex-wrap gap-2 mb-4" data-testid="shopping-form">
        <input
          aria-label="Vare"
          placeholder="Vare"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          className={`${inputClass} flex-1 min-w-[10rem]`}
        />
        <input
          aria-label="Antall"
          placeholder="Antall"
          inputMode="decimal"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className={`${inputClass} w-20`}
        />
        <input
          aria-label="Enhet"
          placeholder="Enhet"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          maxLength={20}
          className={`${inputClass} w-20`}
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Legg til
        </button>
      </form>

      {notice && (
        <p role="status" className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">
          {notice}
        </p>
      )}

      {items.length === 0 && <p className="text-gray-500 text-sm">Handlelisten er tom.</p>}

      {open.length > 0 && (
        <section className="mb-6" data-testid="shopping-open">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">Skal kjøpes</h2>
          <ul className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">{open.map(renderRow)}</ul>
        </section>
      )}

      {bought.length > 0 && (
        <section data-testid="shopping-bought">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">Kjøpt</h2>
          <ul className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 mb-3">
            {bought.map(renderRow)}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="move-location" className="text-sm text-gray-600">Legg i</label>
            <select
              id="move-location"
              value={moveLocation}
              onChange={(e) => setMoveLocation(e.target.value as StockLocation)}
              className={inputClass}
            >
              {STOCK_LOCATIONS.map((l) => (
                <option key={l} value={l}>{LOCATION_LABELS[l]}</option>
              ))}
            </select>
            <button
              onClick={moveToStock}
              disabled={busy}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Legg kjøpte i beholdningen
            </button>
            <button
              onClick={clearBought}
              disabled={busy}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Tøm kjøpte
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
