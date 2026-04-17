/**
 * Recipe Service
 * Handles all recipe-related API calls. Uses mock data only when explicitly enabled
 * via `appConfig.mocking.enabled`. There is no automatic fallback to mock data
 * on network or API errors.
 */

import { apiFetch } from '../api-fetch';
import { appConfig } from '../config';
import { mockCategories, mockRecipes, type Category, type IngredientSection, type InstructionSection, type InstructionStep, type Recipe, type StructuredIngredient } from '../mock-data';

export interface RecipeFormData {
  title: string;
  description?: string;
  ingredients: StructuredIngredient[];
  instructionSteps: InstructionStep[];
  ingredientSections: IngredientSection[];
  instructionSections: InstructionSection[];
  prepTime?: number | null;
  cookTime?: number | null;
  servings?: number | null;
  categoryIds?: number[];
  tips?: string[];
  mainImageUrl?: string | null;
  sourceUrl?: string | null;
  sourceImageUrl?: string | null;
}

class RecipeService {
  /**
   * Fetch all recipes, optionally filtered by category IDs (AND-logic)
   */
  async getAllRecipes(token?: string, categoryIds?: number[], groupId?: number): Promise<Recipe[]> {
    if (appConfig.mocking.enabled) {
      return mockRecipes;
    }

    try {
      const url = new URL(`${appConfig.api.baseUrl}/api/recipes`);
      if (categoryIds && categoryIds.length > 0) {
        url.searchParams.set('categories', categoryIds.join(','));
      }
      if (groupId !== undefined) {
        url.searchParams.set('groupId', String(groupId));
      }

      const response = await this.fetchWithTimeout(
        url.toString(),
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
   * Fetch all categories
   */
  async getAllCategories(token?: string): Promise<Category[]> {
    if (appConfig.mocking.enabled) {
      return mockCategories;
    }

    const response = await this.fetchWithTimeout(
      `${appConfig.api.baseUrl}/api/categories`,
      appConfig.mocking.fetchTimeout,
      token
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch categories: ${response.statusText}`);
    }

    return await response.json();
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
      if (response.status === 403) {
        throw new Error('Du har ikke tilgang til å redigere denne oppskriften');
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
   * Fetch the N newest recipes (sorted by createdAt desc)
   */
  async getNewestRecipes(token?: string, take = 8): Promise<Recipe[]> {
    if (appConfig.mocking.enabled) {
      return mockRecipes.slice(0, take);
    }

    const url = new URL(`${appConfig.api.baseUrl}/api/recipes/newest`);
    url.searchParams.set('take', String(take));

    const response = await this.fetchWithTimeout(url.toString(), appConfig.mocking.fetchTimeout, token);
    if (!response.ok) throw new Error(`Failed to fetch newest recipes: ${response.statusText}`);
    return await response.json();
  }

  /**
   * Fetch the current user's favourite recipes
   */
  async getFavoriteRecipes(token?: string): Promise<Recipe[]> {
    if (appConfig.mocking.enabled) {
      return mockRecipes.filter((r) => r.isLikedByMe);
    }

    const response = await this.fetchWithTimeout(
      `${appConfig.api.baseUrl}/api/recipes/liked`,
      appConfig.mocking.fetchTimeout,
      token
    );
    if (!response.ok) throw new Error(`Failed to fetch favorite recipes: ${response.statusText}`);
    return await response.json();
  }

  /**
   * Get recipe IDs for static generation
   */
  async getRecipeIds(token?: string): Promise<number[]> {
    const recipes = await this.getAllRecipes(token);
    return recipes.map((r: Recipe) => r.id);
  }

  /**
   * Upload or replace the main photo for a recipe
   */
  async uploadMainImage(id: string | number, file: File, token?: string): Promise<Recipe> {
    const formData = new FormData();
    formData.append('image', file);
    const response = await this.fetchMultipart(`${appConfig.api.baseUrl}/api/recipes/${id}/main-image`, 'PUT', formData, token);
    if (!response.ok) throw new Error(`Failed to upload main image: ${response.statusText}`);
    return await response.json();
  }

  /**
   * Remove the main photo from a recipe
   */
  async deleteMainImage(id: string | number, token?: string): Promise<void> {
    const response = await this.fetchWithBody(`${appConfig.api.baseUrl}/api/recipes/${id}/main-image`, 'DELETE', undefined, token);
    if (!response.ok) throw new Error(`Failed to delete main image: ${response.statusText}`);
  }

  /**
   * Upload or replace a step photo
   */
  async uploadStepImage(id: string | number, stepIndex: number, file: File, token?: string): Promise<InstructionStep> {
    const formData = new FormData();
    formData.append('image', file);
    const response = await this.fetchMultipart(`${appConfig.api.baseUrl}/api/recipes/${id}/steps/${stepIndex}/image`, 'PUT', formData, token);
    if (!response.ok) throw new Error(`Failed to upload step image: ${response.statusText}`);
    return await response.json();
  }

  /**
   * Remove a step photo
   */
  async deleteStepImage(id: string | number, stepIndex: number, token?: string): Promise<void> {
    const response = await this.fetchWithBody(`${appConfig.api.baseUrl}/api/recipes/${id}/steps/${stepIndex}/image`, 'DELETE', undefined, token);
    if (!response.ok) throw new Error(`Failed to delete step image: ${response.statusText}`);
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

    return apiFetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Helper for multipart/form-data requests
   */
  private fetchMultipart(url: string, method: string, body: FormData, token?: string): Promise<Response> {
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return apiFetch(url, { method, headers, body });
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

    return apiFetch(url, {
      signal: controller.signal,
      headers,
    })
      .finally(() => clearTimeout(timeoutId));
  }
}

// Export singleton instance
export const recipeService = new RecipeService();
