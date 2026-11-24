import type { Day, Item, ItemKind, ItemState, Week, WorkContext } from './types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

/** Calls NotesApi through this app's proxy, which adds the token from the httpOnly cookie. */
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/proxy/${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });

  if (response.status === 401) {
    window.location.href = '/login?error=expired';
    throw new ApiError(401, 'Innloggingen har utløpt');
  }
  if (!response.ok) {
    let message = `Noe gikk galt (${response.status})`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // Not JSON; keep the generic message.
    }
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface AddItem {
  kind: ItemKind;
  text: string;
  contextId: number | null;
  indent?: number;
  afterItemId?: number;
}

export interface UpdateItem {
  text?: string;
  kind?: ItemKind;
  state?: Exclude<ItemState, 'Carried'>;
  indent?: number;
}

export const api = {
  week: (key: string) => request<Week>('GET', `weeks/${encodeURIComponent(key)}`),
  day: (date: string) => request<Day>('GET', `days/${date}`),
  addItem: (date: string, item: AddItem) => request<Item>('POST', `days/${date}/items`, item),
  updateItem: (id: number, changes: UpdateItem) => request<Item>('PATCH', `items/${id}`, changes),
  moveItem: (id: number, contextId: number | null, index: number) =>
    request<Item>('POST', `items/${id}/move`, { contextId, index }),
  deleteItem: (id: number) => request<void>('DELETE', `items/${id}`),

  contexts: () => request<WorkContext[]>('GET', 'contexts'),
  createContext: (name: string) => request<WorkContext>('POST', 'contexts', { name }),
  updateContext: (id: number, changes: { name?: string; isArchived?: boolean }) =>
    request<WorkContext>('PATCH', `contexts/${id}`, changes),
  reorderContexts: (ids: number[]) => request<WorkContext[]>('POST', 'contexts/reorder', { ids }),
};
