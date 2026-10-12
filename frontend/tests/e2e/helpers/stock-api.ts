import type { Page } from '@playwright/test';

export const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5238';
export const GROUP_ID = 1;

export interface FakeStockItem {
  id: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  location: string;
  bestBefore: string | null;
  isStaple: boolean;
}

/** Seed a structurally valid dev token before any page script runs. */
export async function seedAuth(page: Page) {
  await page.addInitScript(() => {
    const b64 = (o: unknown) =>
      btoa(JSON.stringify(o)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const exp = Math.floor(Date.now() / 1000) + 86400;
    const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ email: 'e2e@example.com', exp })}.e2e`;
    localStorage.setItem('jwt_token', token);
    document.cookie = `auth_token=${token}; path=/; SameSite=Lax`;
  });
}

/** One group the caller belongs to, so pages get past the "no groups" branch. */
export async function mockGroups(page: Page) {
  await page.route(`${API}/api/groups`, (route) =>
    route.fulfill({
      json: [
        {
          id: GROUP_ID,
          name: 'Husholdning',
          ownerEmail: 'e2e@example.com',
          memberCount: 1,
          createdAt: new Date().toISOString(),
        },
      ],
    })
  );
}

/** Date offset from today as yyyy-MM-dd. */
export function dateFromToday(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * In-memory stand-in for the stock endpoints. Returns the backing array so a
 * test can assert on what the page sent.
 */
export async function mockStock(page: Page, seeds: FakeStockItem[] = []): Promise<FakeStockItem[]> {
  const items = [...seeds];
  let nextId = Math.max(0, ...items.map((i) => i.id)) + 1;

  await page.route(`${API}/api/groups/${GROUP_ID}/stock`, async (route) => {
    const request = route.request();
    if (request.method() === 'GET') return route.fulfill({ json: items });
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as Omit<FakeStockItem, 'id'>;
      const created = { id: nextId++, ...body };
      items.push(created);
      return route.fulfill({ status: 201, json: created });
    }
    return route.fulfill({ status: 405, body: '' });
  });

  await page.route(new RegExp(`${API}/api/groups/${GROUP_ID}/stock/(\\d+)$`), async (route) => {
    const request = route.request();
    const id = Number(/\/stock\/(\d+)$/.exec(request.url())![1]);
    const index = items.findIndex((i) => i.id === id);
    if (index < 0) return route.fulfill({ status: 404, json: { error: 'Varen finnes ikke' } });

    if (request.method() === 'PUT') {
      items[index] = { id, ...(request.postDataJSON() as Omit<FakeStockItem, 'id'>) };
      return route.fulfill({ json: items[index] });
    }
    if (request.method() === 'DELETE') {
      items.splice(index, 1);
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fulfill({ status: 405, body: '' });
  });

  return items;
}
