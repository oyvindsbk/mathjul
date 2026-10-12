import { apiFetch } from '../api-fetch';
import { appConfig } from '../config';

export const STOCK_LOCATIONS = ['kjoleskap', 'fryser', 'skap', 'annet'] as const;
export type StockLocation = (typeof STOCK_LOCATIONS)[number];

export const LOCATION_LABELS: Record<StockLocation, string> = {
  kjoleskap: 'Kjøleskap',
  fryser: 'Fryser',
  skap: 'Skap',
  annet: 'Annet',
};

export interface StockItem {
  id: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  location: StockLocation;
  bestBefore: string | null; // yyyy-MM-dd
  isStaple: boolean;
}

export interface StockItemInput {
  name: string;
  quantity: number | null;
  unit: string | null;
  location: StockLocation;
  bestBefore: string | null;
  isStaple: boolean;
}

export type ShoppingStatus = 'aapen' | 'kjopt';
export type ShoppingSource = 'manuell' | 'ukeplan';

export interface ShoppingListItem {
  id: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  source: ShoppingSource;
  status: ShoppingStatus;
}

export interface ShoppingListItemInput {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  note?: string | null;
  source?: ShoppingSource;
}

export interface ShoppingListChanges {
  name?: string;
  quantity?: number;
  unit?: string;
  note?: string;
  status?: ShoppingStatus;
}

export type CoverageStatus = 'har' | 'kanskje' | 'mangler';

export interface IngredientCoverage {
  name: string;
  quantity: number | null;
  unit: string | null;
  status: CoverageStatus;
  stockItemId: number | null;
  stockName: string | null;
  stockQuantity: number | null;
  stockUnit: string | null;
  sideDishTitle: string | null;
}

export interface EntryCoverage {
  mealPlanId: number;
  date: string;
  title: string;
  withoutIngredients: boolean;
  ingredients: IngredientCoverage[];
}

export interface Quantity {
  quantity: number | null;
  unit: string | null;
}

export interface MissingIngredient {
  name: string;
  normalizedName: string;
  status: 'mangler' | 'kanskje';
  quantities: Quantity[];
  recipes: string[];
}

export interface WeekCoverage {
  entries: EntryCoverage[];
  missing: MissingIngredient[];
}

export interface Suggestion {
  recipeId: number;
  title: string;
  imageUrl: string | null;
  score: number;
  haveCount: number;
  maybeCount: number;
  missingCount: number;
  missing: string[];
  usesExpiring: string[];
}

export interface DraftItem {
  name: string;
  quantity: number | null;
  unit: string | null;
}

export type ScanMode = 'legg-til' | 'erstatt';

export interface ApplyScanResult {
  added: number;
  updated: number;
  removed: number;
}

export interface CorrectionResult {
  items: DraftItem[];
  applied: string[];
  rejected: string[];
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // Body was not JSON; use the fallback.
  }
  return fallback;
}

class StockService {
  private base(groupId: number): string {
    return `${appConfig.api.baseUrl}/api/groups/${groupId}`;
  }

  private headers(token: string, json = true): HeadersInit {
    const h: Record<string, string> = { Accept: 'application/json', Authorization: `Bearer ${token}` };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  private async request<T>(url: string, init: RequestInit, fallback: string): Promise<T> {
    const res = await apiFetch(url, init);
    if (!res.ok) throw new Error(await errorMessage(res, fallback));
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  // --- Stock ---

  getStock(groupId: number, token: string): Promise<StockItem[]> {
    return this.request(`${this.base(groupId)}/stock`, { headers: this.headers(token) }, 'Kunne ikke hente beholdningen');
  }

  createStockItem(groupId: number, input: StockItemInput, token: string): Promise<StockItem> {
    return this.request(
      `${this.base(groupId)}/stock`,
      { method: 'POST', headers: this.headers(token), body: JSON.stringify(input) },
      'Kunne ikke legge til varen'
    );
  }

  updateStockItem(groupId: number, id: number, input: StockItemInput, token: string): Promise<StockItem> {
    return this.request(
      `${this.base(groupId)}/stock/${id}`,
      { method: 'PUT', headers: this.headers(token), body: JSON.stringify(input) },
      'Kunne ikke lagre varen'
    );
  }

  deleteStockItem(groupId: number, id: number, token: string): Promise<void> {
    return this.request(
      `${this.base(groupId)}/stock/${id}`,
      { method: 'DELETE', headers: this.headers(token, false) },
      'Kunne ikke slette varen'
    );
  }

  // --- Shopping list ---

  getShoppingList(groupId: number, token: string): Promise<ShoppingListItem[]> {
    return this.request(`${this.base(groupId)}/shopping-list`, { headers: this.headers(token) }, 'Kunne ikke hente handlelisten');
  }

  addShoppingItems(groupId: number, items: ShoppingListItemInput[], token: string): Promise<ShoppingListItem[]> {
    return this.request(
      `${this.base(groupId)}/shopping-list`,
      { method: 'POST', headers: this.headers(token), body: JSON.stringify({ items }) },
      'Kunne ikke legge til på handlelisten'
    );
  }

  updateShoppingItem(groupId: number, id: number, changes: ShoppingListChanges, token: string): Promise<ShoppingListItem> {
    return this.request(
      `${this.base(groupId)}/shopping-list/${id}`,
      { method: 'PATCH', headers: this.headers(token), body: JSON.stringify(changes) },
      'Kunne ikke oppdatere varen'
    );
  }

  deleteShoppingItem(groupId: number, id: number, token: string): Promise<void> {
    return this.request(
      `${this.base(groupId)}/shopping-list/${id}`,
      { method: 'DELETE', headers: this.headers(token, false) },
      'Kunne ikke slette varen'
    );
  }

  clearBought(groupId: number, token: string): Promise<{ removed: number }> {
    return this.request(
      `${this.base(groupId)}/shopping-list?status=kjopt`,
      { method: 'DELETE', headers: this.headers(token, false) },
      'Kunne ikke tømme kjøpte varer'
    );
  }

  moveBoughtToStock(groupId: number, location: StockLocation, token: string): Promise<{ moved: number }> {
    return this.request(
      `${this.base(groupId)}/shopping-list/move-to-stock`,
      { method: 'POST', headers: this.headers(token), body: JSON.stringify({ location }) },
      'Kunne ikke flytte varene til beholdningen'
    );
  }

  // --- Coverage and suggestions ---

  getWeekCoverage(groupId: number, weekStart: string, token: string): Promise<WeekCoverage> {
    return this.request(
      `${this.base(groupId)}/stock/week-coverage?weekStart=${encodeURIComponent(weekStart)}`,
      { headers: this.headers(token) },
      'Kunne ikke hente ukas dekning'
    );
  }

  getSuggestions(groupId: number, token: string, limit = 10): Promise<Suggestion[]> {
    return this.request(
      `${this.base(groupId)}/stock/suggestions?limit=${limit}`,
      { headers: this.headers(token) },
      'Kunne ikke hente forslag'
    );
  }

  // --- Scan ---

  scan(groupId: number, location: StockLocation, images: File[], token: string): Promise<{ items: DraftItem[] }> {
    const form = new FormData();
    form.append('location', location);
    images.forEach((file) => form.append('images', file));
    return this.request(
      `${this.base(groupId)}/stock/scan`,
      { method: 'POST', headers: this.headers(token, false), body: form },
      'Kunne ikke lese bildet'
    );
  }

  correctDraft(
    groupId: number,
    draft: DraftItem[],
    instruction: string,
    images: File[],
    token: string
  ): Promise<CorrectionResult> {
    const form = new FormData();
    form.append('draft', JSON.stringify(draft));
    form.append('instruction', instruction);
    images.forEach((file) => form.append('images', file));
    return this.request(
      `${this.base(groupId)}/stock/scan/correct`,
      { method: 'POST', headers: this.headers(token, false), body: form },
      'Kunne ikke rette utkastet'
    );
  }

  applyScan(
    groupId: number,
    body: { location: StockLocation; mode: ScanMode; items: DraftItem[]; keepIds: number[] },
    token: string
  ): Promise<ApplyScanResult> {
    return this.request(
      `${this.base(groupId)}/stock/scan/apply`,
      { method: 'POST', headers: this.headers(token), body: JSON.stringify(body) },
      'Kunne ikke lagre beholdningen'
    );
  }
}

export const stockService = new StockService();
