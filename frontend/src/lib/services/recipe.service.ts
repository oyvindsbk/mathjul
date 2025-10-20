/**
 * Recipe Service
 * Handles all recipe-related API calls with fallback to mock data
 */

import { appConfig } from '../config';
import { mockRecipes, type Recipe } from '../mock-data';

class RecipeService {
  /**
   * Fetch all recipes
   */
  async getAllRecipes(token?: string): Promise<Recipe[]> {
    if (appConfig.mocking.enabled) {
      return mockRecipes;
    }

    try {
      const response = await this.fetchWithTimeout(
        `${appConfig.api.baseUrl}/api/recipes`,
        appConfig.mocking.fetchTimeout,
        token
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch recipes: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.warn('Failed to fetch recipes from API, using mock data:', error);
      return mockRecipes;
    }
  }

  /**
   * Fetch a single recipe by ID
   */
  async getRecipeById(id: string | number, token?: string): Promise<Recipe | null> {
    if (appConfig.mocking.enabled) {
      const recipe = mockRecipes.find((r) => r.id === Number(id));
      return recipe || null;
    }

    try {
      const response = await this.fetchWithTimeout(
        `${appConfig.api.baseUrl}/api/recipes/${id}`,
        appConfig.mocking.fetchTimeout,
        token
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch recipe: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.warn(`Failed to fetch recipe ${id} from API, using mock data:`, error);
      const recipe = mockRecipes.find((r: Recipe) => r.id === Number(id));
      return recipe || null;
    }
  }

  /**
   * Get recipe IDs for static generation
   */
  async getRecipeIds(token?: string): Promise<number[]> {
    const recipes = await this.getAllRecipes(token);
    return recipes.map((r: Recipe) => r.id);
  }

  /**
   * Helper method to fetch with timeout
   */
  private fetchWithTimeout(url: string, timeoutMs: number, token?: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return fetch(url, {
      signal: controller.signal,
      headers,
    })
      .finally(() => clearTimeout(timeoutId));
  }
}

// Export singleton instance
export const recipeService = new RecipeService();
