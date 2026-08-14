import { apiFetch } from '../api-fetch';
import { appConfig } from '../config';

/**
 * Public view of a user, as returned by GET /api/user/{id}.
 * Carries no email — profile pages identify people by name.
 */
export interface UserProfile {
  id: number;
  displayName: string;
  /** Recipes by this user that the caller is allowed to see. */
  recipeCount: number;
}

class UserService {
  /**
   * Fetch a user's public profile. Returns null when no such user exists, so
   * callers can render "not found" without treating it as a failure.
   */
  async getUserProfile(userId: number, token?: string): Promise<UserProfile | null> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await apiFetch(`${appConfig.api.baseUrl}/api/user/${userId}`, {
      headers,
      credentials: 'include',
    });

    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Failed to fetch user profile: ${response.statusText}`);

    return (await response.json()) as UserProfile;
  }
}

export const userService = new UserService();
