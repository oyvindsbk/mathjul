/**
 * Recipe Service
 * Handles all recipe-related API calls. Uses mock data only when explicitly enabled
 * via `appConfig.mocking.enabled`. There is no automatic fallback to mock data
 * on network or API errors.
 */

import { appConfig } from '../config';
import { mockRecipes, type Recipe, type StructuredIngredient } from '../mock-data';

export interface RecipeFormData {
  title: string;
  description?: string;
  ingredients: StructuredIngredient[];
  instructions: string[];
  prepTime?: number | null;
  cookTime?: number | null;
  servings?: number | null;
  difficulty?: string;
}

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
      // Propagate error to caller. Do not silently fallback to mock data.
      throw error;
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
      // Propagate error to caller. Do not silently fallback to mock data.
      throw error;
    }
  }

  /**
   * Update an existing recipe
   */
  async updateRecipe(id: string | number, data: RecipeFormData, token?: string): Promise<Recipe> {
    const response = await this.fetchWithBody(
      `${appConfig.api.baseUrl}/api/recipes/${id}`,
      'PUT',
      data,
      token
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Recipe not found');
      }
      throw new Error(`Failed to update recipe: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Delete a recipe
   */
  async deleteRecipe(id: string | number, token?: string): Promise<void> {
    const response = await this.fetchWithBody(
      `${appConfig.api.baseUrl}/api/recipes/${id}`,
      'DELETE',
      undefined,
      token
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Recipe not found');
      }
      throw new Error(`Failed to delete recipe: ${response.statusText}`);
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
   * Helper for mutation requests (POST/PUT/DELETE)
   */
  private fetchWithBody(url: string, method: string, body?: unknown, token?: string): Promise<Response> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
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
