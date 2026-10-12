export const EXPIRING_WITHIN_DAYS = 3;

export type BestBeforeState = "expired" | "soon" | "ok" | "none";

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function bestBeforeState(bestBefore: string | null, now: Date = new Date()): BestBeforeState {
  if (!bestBefore) return "none";
  const days = Math.round((parseDateKey(bestBefore).getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= EXPIRING_WITHIN_DAYS) return "soon";
  return "ok";
}

export function formatBestBefore(bestBefore: string): string {
  return parseDateKey(bestBefore).toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
}

/** "2 stk", "1,5 l", "500 g", or an empty string when nothing is known. */
export function formatAmount(quantity: number | null, unit: string | null): string {
  const parts: string[] = [];
  if (quantity !== null) parts.push(quantity.toLocaleString("nb-NO", { maximumFractionDigits: 3 }));
  if (unit) parts.push(unit);
  return parts.join(" ");
}
