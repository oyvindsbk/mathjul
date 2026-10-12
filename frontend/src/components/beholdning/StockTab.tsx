"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LOCATION_LABELS,
  STOCK_LOCATIONS,
  stockService,
  type StockItem,
  type StockItemInput,
} from "@/lib/services/stock.service";
import { StockItemForm } from "./StockItemForm";
import { bestBeforeState, formatAmount, formatBestBefore } from "./stockDisplay";

interface Props {
  groupId: number;
  token: string;
  onError: (message: string) => void;
}

const BADGE: Record<"expired" | "soon", { label: string; className: string }> = {
  expired: { label: "Utløpt", className: "bg-red-100 text-red-700" },
  soon: { label: "Går snart ut", className: "bg-amber-100 text-amber-800" },
};

export function StockTab({ groupId, token, onError }: Props) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await stockService.getStock(groupId, token));
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : "Kunne ikke hente beholdningen");
    } finally {
      setLoading(false);
    }
  }, [groupId, token, onError]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(input: StockItemInput) {
    await stockService.createStockItem(groupId, input, token);
    setAdding(false);
    await load();
  }

  async function handleUpdate(id: number, input: StockItemInput) {
    await stockService.updateStockItem(groupId, id, input, token);
    setEditingId(null);
    await load();
  }

  async function handleDelete(item: StockItem) {
    try {
      await stockService.deleteStockItem(groupId, item.id, token);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : "Kunne ikke slette varen");
    }
  }

  if (loading) return <p className="text-gray-500 text-sm">Laster …</p>;

  const editing = items.find((i) => i.id === editingId);

  return (
    <div data-testid="stock-tab">
      {!adding && !editing && (
        <button
          onClick={() => setAdding(true)}
          data-testid="stock-add"
          className="mb-4 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
        >
          + Legg til vare
        </button>
      )}

      {adding && <StockItemForm onSave={handleCreate} onCancel={() => setAdding(false)} />}
      {editing && (
        <StockItemForm
          key={editing.id}
          item={editing}
          onSave={(input) => handleUpdate(editing.id, input)}
          onCancel={() => setEditingId(null)}
        />
      )}

      {items.length === 0 && !adding && (
        <p className="text-gray-500 text-sm">Ingen varer registrert ennå. Legg til det dere har hjemme.</p>
      )}

      {STOCK_LOCATIONS.map((location) => {
        const inLocation = items.filter((i) => i.location === location);
        if (inLocation.length === 0) return null;
        return (
          <section key={location} className="mb-6" data-testid={`stock-location-${location}`}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
              {LOCATION_LABELS[location]}
            </h2>
            <ul className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              {inLocation.map((item) => {
                const state = bestBeforeState(item.bestBefore);
                const amount = formatAmount(item.quantity, item.unit);
                return (
                  <li key={item.id} data-testid="stock-item" className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-900">{item.name}</span>
                        {item.isStaple && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Basisvare</span>
                        )}
                        {(state === "expired" || state === "soon") && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${BADGE[state].className}`}>
                            {BADGE[state].label}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {[amount, item.bestBefore ? `best før ${formatBestBefore(item.bestBefore)}` : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setAdding(false);
                        setEditingId(item.id);
                      }}
                      aria-label={`Endre ${item.name}`}
                      className="text-sm text-blue-600 hover:underline min-h-[44px] px-1"
                    >
                      Endre
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      aria-label={`Slett ${item.name}`}
                      className="text-sm text-red-600 hover:underline min-h-[44px] px-1"
                    >
                      Slett
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
