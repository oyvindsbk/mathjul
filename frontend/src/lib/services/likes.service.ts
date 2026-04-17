import { apiFetch } from '../api-fetch';
import { appConfig } from '../config';
import type { Recipe } from '../mock-data';

class LikesService {
  async likeRecipe(id: number, token: string): Promise<void> {
    const response = await apiFetch(`${appConfig.api.baseUrl}/api/recipes/${id}/like`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok && response.status !== 200) {
      throw new Error(`Failed to like recipe: ${response.statusText}`);
    }
  }

  async unlikeRecipe(id: number, token: string): Promise<void> {
    const response = await apiFetch(`${appConfig.api.baseUrl}/api/recipes/${id}/like`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to unlike recipe: ${response.statusText}`);
    }
  }

  async getLikedRecipes(token: string): Promise<Recipe[]> {
    const response = await apiFetch(`${appConfig.api.baseUrl}/api/recipes/liked`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch liked recipes: ${response.statusText}`);
    }

    return await response.json();
  }
}

export const likesService = new LikesService();
