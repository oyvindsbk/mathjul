/**
 * Recipe Service
 * Handles all recipe-related API calls. Uses mock data only when explicitly enabled
 * via `appConfig.mocking.enabled`. There is no automatic fallback to mock data
 * on network or API errors.
 */

import { apiFetch } from '../api-fetch';
import { appConfig } from '../config';
import { mockCategories, mockRecipes, TILBEHOR_CATEGORY_ID, type Category, type IngredientSection, type InstructionSection, type InstructionStep, type Recipe, type StructuredIngredient } from '../mock-data';

export interface RecipeFormData {
  title: string;
  description?: string;
  ingredients: StructuredIngredient[];
  instructionSteps: InstructionStep[];
  ingredientSections: IngredientSection[];
  instructionSections: InstructionSection[];
  prepTime?: number | null;
  cookTime?: number | null;
  /**
   * Portion count, or — for `quantityType === "form"` — the baking tin's
   * volume in cm³, which is what the scaling pipeline divides.
   */
  servings?: number | null;
  quantityType?: string;
  customUnit?: string | null;
  /**
   * The baking tin — cake recipes only. Kept alongside the volume in `servings`
   * because volume alone is ambiguous: a round Ø24 and a springform Ø24 measure
   * the same, and only the shape tells them apart.
   */
  panShape?: string | null;
  panDiameter?: number | null;
  panLength?: number | null;
  panWidth?: number | null;
  panHeight?: number | null;
  /** Author-curated subset of pan preset ids to offer. Empty/null means no restriction. */
  availablePanPresetIds?: string[] | null;
  /** Preset id preselected on load. Must be a member of `availablePanPresetIds` when set. */
  defaultPanPresetId?: string | null;
  categoryIds?: number[];
  /** Ids of Tilbehør-marked recipes to attach. List order becomes the display order. */
  sideDishIds?: number[];
  tips?: string[];
  mainImageUrl?: string | null;
  sourceUrl?: string | null;
  sourceImageUrl?: string | null;
}

/**
 * The public share payload, as the API sends it. Deliberately narrower than
 * `Recipe`: no email, likes, groups, or visibility.
 */
interface SharedRecipeDto {
  recipeId: number;
  title: string;
  description: string;
  cookTime: string;
  cookTimeMinutes?: number | null;
  prepTime?: number | null;
  imageUrl?: string | null;
  servings?: number | null;
  quantityType: string;
  customUnit?: string | null;
  /** Baking tin — cake recipes only. See lib/pan-size.ts. */
  panShape?: string | null;
  panDiameter?: number | null;
  panLength?: number | null;
  panWidth?: number | null;
  panHeight?: number | null;
  ingredients: StructuredIngredient[];
  instructionSteps: InstructionStep[];
  ingredientSections: IngredientSection[];
  instructionSections: InstructionSection[];
  tips: string[];
  /** Titles only — never links, since a link would be access to a second recipe. */
  sideDishes: string[];
  ownerDisplayName: string;
  updatedAt: string;
}

/** A shared recipe mapped onto the shape `RecipeBody` renders. */
export interface SharedRecipe {
  recipe: Recipe;
  ownerDisplayName: string;
}

/** Active-share status for a recipe. `token`/`shareUrl` are null when nothing is shared. */
export interface ShareStatus {
  isShared: boolean;
  token?: string | null;
  shareUrl?: string | null;
  createdAt?: string | null;
}

class RecipeService {
  /**
   * Fetch all recipes, optionally filtered by category IDs and/or a title search
   * term. Ids in the same category group are OR-ed together; different groups
   * are AND-ed. `search` matches substrings of the title, case-insensitively.
   */
  async getAllRecipes(token?: string, categoryIds?: number[], groupId?: number, search?: string): Promise<Recipe[]> {
    if (appConfig.mocking.enabled) {
      const term = search?.trim().toLowerCase();
      if (term) {
        return mockRecipes.filter((r) => r.title.toLowerCase().includes(term));
      }
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
      if (search && search.trim()) {
        url.searchParams.set('search', search.trim());
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
   * Fetch ingredient names per recipe, for client-side ingredient filtering
   * (Snurr mathjulet). The regular list endpoint (getAllRecipes) omits
   * ingredients entirely to keep its payload small, so this dedicated
   * endpoint exists to fetch just the names.
   */
  async getIngredientNamesByRecipe(token?: string): Promise<Record<number, string[]>> {
    if (appConfig.mocking.enabled) {
      const result: Record<number, string[]> = {};
      for (const recipe of mockRecipes) {
        const names = new Set<string>();
        for (const ingredient of recipe.ingredients ?? []) {
          if (ingredient.name.trim()) names.add(ingredient.name.trim());
        }
        for (const section of recipe.ingredientSections ?? []) {
          for (const ingredient of section.ingredients) {
            if (ingredient.name.trim()) names.add(ingredient.name.trim());
          }
        }
        result[recipe.id] = Array.from(names);
      }
      return result;
    }

    const response = await this.fetchWithTimeout(
      `${appConfig.api.baseUrl}/api/recipes/ingredient-names`,
      appConfig.mocking.fetchTimeout,
      token
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch recipe ingredient names: ${response.statusText}`);
    }

    const data: { recipeId: number; ingredientNames: string[] }[] = await response.json();
    const result: Record<number, string[]> = {};
    for (const entry of data) {
      result[entry.recipeId] = entry.ingredientNames;
    }
    return result;
  }

  /**
   * Fetch recipes marked as Tilbehør, for the side-dish picker
   */
  async getTilbehorRecipes(token?: string): Promise<Recipe[]> {
    if (appConfig.mocking.enabled) {
      return mockRecipes.filter((r) =>
        r.categories?.some((c) => c.id === TILBEHOR_CATEGORY_ID)
      );
    }

    return this.getAllRecipes(token, [TILBEHOR_CATEGORY_ID]);
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
      // Surface the server's validation message (e.g. the tilbehør rules) when present.
      const message = await response
        .json()
        .then((body: { message?: string }) => body?.message)
        .catch(() => undefined);
      throw new Error(message ?? `Failed to update recipe: ${response.statusText}`);
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
   * Fetch recipes the signed-in user added, newest first. Includes their private
   * recipes — they are the owner.
   */
  async getMyRecipes(token?: string): Promise<Recipe[]> {
    if (appConfig.mocking.enabled) {
      return mockRecipes.slice(0, 3);
    }

    const response = await this.fetchWithTimeout(
      `${appConfig.api.baseUrl}/api/recipes/mine`,
      appConfig.mocking.fetchTimeout,
      token
    );
    if (!response.ok) throw new Error(`Failed to fetch my recipes: ${response.statusText}`);
    return await response.json();
  }

  /**
   * Fetch recipes added by another user, limited to what the caller may see.
   */
  async getRecipesByUser(userId: number, token?: string): Promise<Recipe[]> {
    if (appConfig.mocking.enabled) {
      return mockRecipes.slice(0, 2);
    }

    const response = await this.fetchWithTimeout(
      `${appConfig.api.baseUrl}/api/recipes/by-user/${userId}`,
      appConfig.mocking.fetchTimeout,
      token
    );
    if (!response.ok) throw new Error(`Failed to fetch user recipes: ${response.statusText}`);
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
   * The shared recipe behind a token, from the unauthenticated public endpoint.
   * Returns null when the token is unknown or revoked, so the caller can show
   * the dead-link page instead of an error.
   */
  async getSharedRecipe(shareToken: string): Promise<SharedRecipe | null> {
    // Plain fetch, not apiFetch: apiFetch bounces a 401 to /login, and a
    // recipient holding a link must never be sent to a login page.
    const response = await fetch(
      `${appConfig.api.baseUrl}/api/public/recipes/shared/${encodeURIComponent(shareToken)}`,
      { headers: { Accept: 'application/json' } }
    );

    if (response.status === 404 || response.status === 401 || response.status === 403) return null;
    if (!response.ok) throw new Error(`Failed to fetch shared recipe: ${response.statusText}`);

    const dto: SharedRecipeDto = await response.json();

    // The public DTO carries side dishes as bare titles — there is no id to link
    // to on purpose. Synthetic indices satisfy the RecipeRef key; RecipeBody is
    // told not to render them as links.
    return {
      recipe: {
        id: dto.recipeId,
        title: dto.title,
        description: dto.description,
        ingredients: dto.ingredients,
        instructionSteps: dto.instructionSteps,
        ingredientSections: dto.ingredientSections,
        instructionSections: dto.instructionSections,
        prepTime: dto.prepTime,
        cookTime: dto.cookTime,
        cookTimeMinutes: dto.cookTimeMinutes,
        servings: dto.servings,
        quantityType: dto.quantityType,
        customUnit: dto.customUnit,
        // Carried through so a shared cake's pan picker can mark the original
        // tin and warn on conversion, exactly as the detail page does.
        panShape: dto.panShape,
        panDiameter: dto.panDiameter,
        panLength: dto.panLength,
        panWidth: dto.panWidth,
        panHeight: dto.panHeight,
        imageUrl: dto.imageUrl,
        tips: dto.tips,
        sideDishes: dto.sideDishes.map((title, index) => ({ id: index, title })),
        updatedAt: dto.updatedAt,
      },
      ownerDisplayName: dto.ownerDisplayName,
    };
  }

  /**
   * The recipe's active share, if any. Owner/admin only — the API answers 403
   * for anyone else.
   */
  async getShare(id: string | number, token?: string): Promise<ShareStatus> {
    const response = await this.fetchWithTimeout(
      `${appConfig.api.baseUrl}/api/recipes/${id}/share`,
      appConfig.mocking.fetchTimeout,
      token
    );
    if (!response.ok) throw new Error(`Failed to fetch share: ${response.statusText}`);
    return await response.json();
  }

  /**
   * Creates a share link, or returns the existing active one. Idempotent, so a
   * double-click cannot mint a second token.
   */
  async createShare(id: string | number, token?: string): Promise<ShareStatus> {
    const response = await this.fetchWithBody(
      `${appConfig.api.baseUrl}/api/recipes/${id}/share`,
      'POST',
      undefined,
      token
    );
    if (!response.ok) throw new Error(`Failed to create share: ${response.statusText}`);
    return await response.json();
  }

  /** Revokes the active share. The link stops working immediately. */
  async revokeShare(id: string | number, token?: string): Promise<void> {
    const response = await this.fetchWithBody(
      `${appConfig.api.baseUrl}/api/recipes/${id}/share`,
      'DELETE',
      undefined,
      token
    );
    if (!response.ok) throw new Error(`Failed to revoke share: ${response.statusText}`);
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
