import { apiFetch } from '../api-fetch';
import { appConfig } from '../config';

export interface GroupOption {
  id: number;
  name: string;
  ownerEmail: string;
  memberCount: number;
  createdAt: string;
}

export interface GroupMember {
  userId: number;
  email: string;
  displayName: string;
  joinedAt: string;
}

export interface GroupRecipe {
  id: number;
  title: string;
}

export interface GroupDetail {
  id: number;
  name: string;
  ownerEmail: string;
  createdAt: string;
  mealPlanEnabled: boolean;
  members: GroupMember[];
  recipes: GroupRecipe[];
}

class GroupsService {
  private baseUrl = appConfig.api.baseUrl;

  private headers(token?: string): HeadersInit {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }

  async getMyGroups(token?: string): Promise<GroupOption[]> {
    const res = await apiFetch(`${this.baseUrl}/api/groups`, {
      headers: this.headers(token),
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to fetch groups: ${res.statusText}`);
    return res.json() as Promise<GroupOption[]>;
  }

  async getGroup(id: number, token?: string): Promise<GroupDetail> {
    const res = await apiFetch(`${this.baseUrl}/api/groups/${id}`, {
      headers: this.headers(token),
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to fetch group: ${res.statusText}`);
    return res.json() as Promise<GroupDetail>;
  }

  async createGroup(name: string, token?: string): Promise<GroupOption> {
    const res = await apiFetch(`${this.baseUrl}/api/groups`, {
      method: 'POST',
      headers: this.headers(token),
      credentials: 'include',
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`Failed to create group: ${res.statusText}`);
    return res.json() as Promise<GroupOption>;
  }

  async renameGroup(id: number, name: string, token?: string): Promise<GroupOption> {
    const res = await apiFetch(`${this.baseUrl}/api/groups/${id}`, {
      method: 'PUT',
      headers: this.headers(token),
      credentials: 'include',
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`Failed to rename group: ${res.statusText}`);
    return res.json() as Promise<GroupOption>;
  }

  async deleteGroup(id: number, token?: string): Promise<void> {
    const res = await apiFetch(`${this.baseUrl}/api/groups/${id}`, {
      method: 'DELETE',
      headers: this.headers(token),
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to delete group: ${res.statusText}`);
  }

  async addMember(groupId: number, email: string, token?: string): Promise<GroupMember> {
    const res = await apiFetch(`${this.baseUrl}/api/groups/${groupId}/members`, {
      method: 'POST',
      headers: this.headers(token),
      credentials: 'include',
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? `Failed to add member: ${res.statusText}`);
    }
    return res.json() as Promise<GroupMember>;
  }

  async removeMember(groupId: number, userId: number, token?: string): Promise<void> {
    const res = await apiFetch(`${this.baseUrl}/api/groups/${groupId}/members/${userId}`, {
      method: 'DELETE',
      headers: this.headers(token),
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to remove member: ${res.statusText}`);
  }

  async updateGroupSettings(groupId: number, settings: { mealPlanEnabled: boolean }, token?: string): Promise<void> {
    const res = await apiFetch(`${this.baseUrl}/api/groups/${groupId}/settings`, {
      method: 'PATCH',
      headers: this.headers(token),
      credentials: 'include',
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error(`Failed to update group settings: ${res.statusText}`);
  }
}

export const groupsService = new GroupsService();
