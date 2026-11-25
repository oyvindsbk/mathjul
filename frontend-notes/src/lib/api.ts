import type { ProjectColor } from './projectColors';
import type { Day, Item, ItemKind, ItemState, Week, Project } from './types';

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
  projectId: number | null;
  indent?: number;
  afterItemId?: number;
}

export interface UpdateItem {
  text?: string;
  kind?: ItemKind;
  state?: Exclude<ItemState, 'Carried'>;
  indent?: number;
}

export interface UpdateProject {
  name?: string;
  isArchived?: boolean;
  color?: ProjectColor;
  /** Removes the color; leaving out color just keeps it. */
  clearColor?: boolean;
}

export const api = {
  week: (key: string) => request<Week>('GET', `weeks/${encodeURIComponent(key)}`),
  day: (date: string) => request<Day>('GET', `days/${date}`),
  addItem: (date: string, item: AddItem) => request<Item>('POST', `days/${date}/items`, item),
  updateItem: (id: number, changes: UpdateItem) => request<Item>('PATCH', `items/${id}`, changes),
  /** Without an index the item is appended to the target group. */
  moveItem: (id: number, projectId: number | null, index?: number) =>
    request<Item>('POST', `items/${id}/move`, { projectId, index }),
  deleteItem: (id: number) => request<void>('DELETE', `items/${id}`),

  projects: () => request<Project[]>('GET', 'projects'),
  createProject: (name: string) => request<Project>('POST', 'projects', { name }),
  updateProject: (id: number, changes: UpdateProject) =>
    request<Project>('PATCH', `projects/${id}`, changes),
  reorderProjects: (ids: number[]) => request<Project[]>('POST', 'projects/reorder', { ids }),
};
