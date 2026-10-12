import type { Page } from '@playwright/test';
import { API, GROUP_ID } from './stock-api';

export interface FakeShoppingItem {
  id: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  source: string;
  status: string;
}

export interface ShoppingState {
  items: FakeShoppingItem[];
  /** Locations passed to move-to-stock, in call order. */
  moves: string[];
}

/** In-memory stand-in for the shopping-list endpoints. */
export async function mockShoppingList(page: Page, seeds: FakeShoppingItem[] = []): Promise<ShoppingState> {
  const state: ShoppingState = { items: [...seeds], moves: [] };
  let nextId = Math.max(0, ...seeds.map((i) => i.id)) + 1;

  await page.route(new RegExp(`${API}/api/groups/${GROUP_ID}/shopping-list(\\?.*)?$`), async (route) => {
    const request = route.request();
    if (request.method() === 'GET') return route.fulfill({ json: state.items });
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as { items: Partial<FakeShoppingItem>[] };
      const created = body.items.map((i) => ({
        id: nextId++,
        name: i.name ?? '',
        quantity: i.quantity ?? null,
        unit: i.unit ?? null,
        note: i.note ?? null,
        source: i.source ?? 'manuell',
        status: 'aapen',
      }));
      state.items.push(...created);
      return route.fulfill({ json: created });
    }
    if (request.method() === 'DELETE') {
      const removed = state.items.filter((i) => i.status === 'kjopt').length;
      state.items = state.items.filter((i) => i.status !== 'kjopt');
      return route.fulfill({ json: { removed } });
    }
    return route.fulfill({ status: 405, body: '' });
  });

  await page.route(`${API}/api/groups/${GROUP_ID}/shopping-list/move-to-stock`, async (route) => {
    const { location } = route.request().postDataJSON() as { location: string };
    state.moves.push(location);
    const moved = state.items.filter((i) => i.status === 'kjopt').length;
    state.items = state.items.filter((i) => i.status !== 'kjopt');
    return route.fulfill({ json: { moved } });
  });

  await page.route(new RegExp(`${API}/api/groups/${GROUP_ID}/shopping-list/(\\d+)$`), async (route) => {
    const request = route.request();
    const id = Number(/\/shopping-list\/(\d+)$/.exec(request.url())![1]);
    const item = state.items.find((i) => i.id === id);
    if (!item) return route.fulfill({ status: 404, json: { error: 'Varen finnes ikke' } });

    if (request.method() === 'PATCH') {
      Object.assign(item, request.postDataJSON());
      return route.fulfill({ json: item });
    }
    if (request.method() === 'DELETE') {
      state.items = state.items.filter((i) => i.id !== id);
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fulfill({ status: 405, body: '' });
  });

  return state;
}
