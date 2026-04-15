import { appConfig } from '../config';

export type CardType = 'Feature' | 'Bug';

export interface FeatureCardData {
  id: number;
  columnId: number;
  title: string;
  summary: string;
  motivation: string;
  requirements: string;
  outOfScope: string | null;
  openQuestions: string | null;
  stacksFrontend: boolean;
  stacksBackend: boolean;
  stacksInfrastructure: boolean;
  dataModel: string | null;
  apiSketch: string | null;
  uiSketch: string | null;
  cardType: CardType;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface BugCardData extends FeatureCardData {
  cardType: 'Bug';
  bugUrl: string;
}

export interface FeatureColumnData {
  id: number;
  name: string;
  sortOrder: number;
  cards: FeatureCardData[];
}

export interface FeatureBoardData {
  columns: FeatureColumnData[];
}

export interface CreateCardPayload {
  columnId: number;
  title: string;
  summary: string;
  motivation: string;
  requirements: string;
  outOfScope?: string;
  openQuestions?: string;
  stacksFrontend: boolean;
  stacksBackend: boolean;
  stacksInfrastructure: boolean;
  dataModel?: string;
  apiSketch?: string;
  uiSketch?: string;
  cardType?: CardType;
}

export interface CreateBugCardPayload {
  columnId: number;
  title: string;
  summary: string;
  requirements: string;
  uiSketch?: string;
  bugUrl: string;
  cardType: 'Bug';
}

export interface UpdateCardPayload {
  title?: string;
  summary?: string;
  motivation?: string;
  requirements?: string;
  outOfScope?: string;
  openQuestions?: string;
  stacksFrontend?: boolean;
  stacksBackend?: boolean;
  stacksInfrastructure?: boolean;
  dataModel?: string;
  apiSketch?: string;
  uiSketch?: string;
  cardType?: CardType;
}

export interface GeneratedPrd {
  title: string;
  summary: string;
  motivation: string;
  requirements: string;
  outOfScope: string | null;
  openQuestions: string | null;
  stacksFrontend: boolean;
  stacksBackend: boolean;
  stacksInfrastructure: boolean;
  dataModel: string | null;
  apiSketch: string | null;
  uiSketch: string | null;
  cardType: CardType;
}

class FeaturePlannerService {
  private baseUrl = `${appConfig.api.baseUrl}/api/feature-board`;

  private async request<T>(path: string, options?: RequestInit, token?: string): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const res = await fetch(`${this.baseUrl}${path}`, { ...options, headers });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Feature planner API error ${res.status}: ${body}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  async getBoard(token?: string): Promise<FeatureBoardData> {
    return this.request<FeatureBoardData>('', undefined, token);
  }

  async addColumn(name: string, token?: string): Promise<FeatureColumnData> {
    return this.request<FeatureColumnData>('/columns', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }, token);
  }

  async updateColumn(id: number, payload: { name?: string; sortOrder?: number }, token?: string): Promise<FeatureColumnData> {
    return this.request<FeatureColumnData>(`/columns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, token);
  }

  async deleteColumn(id: number, token?: string): Promise<void> {
    return this.request<void>(`/columns/${id}`, { method: 'DELETE' }, token);
  }

  async createCard(payload: CreateCardPayload | CreateBugCardPayload, token?: string): Promise<FeatureCardData> {
    return this.request<FeatureCardData>('/cards', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  }

  async updateCard(id: number, payload: UpdateCardPayload, token?: string): Promise<FeatureCardData> {
    return this.request<FeatureCardData>(`/cards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, token);
  }

  async deleteCard(id: number, token?: string): Promise<void> {
    return this.request<void>(`/cards/${id}`, { method: 'DELETE' }, token);
  }

  async moveCard(id: number, columnId: number, sortOrder?: number, token?: string): Promise<FeatureCardData> {
    return this.request<FeatureCardData>(`/cards/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ columnId, sortOrder }),
    }, token);
  }

  async generatePrd(prompt: string, token?: string): Promise<GeneratedPrd> {
    return this.request<GeneratedPrd>('/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }, token);
  }
}

export const featurePlannerService = new FeaturePlannerService();
