import { appConfig } from '../config';

export interface MealPlanRecipe {
  id: number;
  title: string;
  imageUrl: string | null;
  mealTypeCategory: string | null;
  mealTypeCategories: string[];
}

export interface MealPlan {
  id: number;
  groupId: number;
  date: string; // yyyy-MM-dd
  recipeId: number;
  recipe: MealPlanRecipe;
  createdByEmail: string | null;
}

class MealPlanService {
  async getMealPlans(groupId: number, from: string, to: string, token: string): Promise<MealPlan[]> {
    const url = new URL(`${appConfig.api.baseUrl}/api/groups/${groupId}/mealplans`);
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) throw new Error(`Failed to fetch meal plans: ${response.statusText}`);
    return response.json();
  }

  async createMealPlan(groupId: number, date: string, recipeId: number, token: string): Promise<MealPlan> {
    const response = await fetch(`${appConfig.api.baseUrl}/api/groups/${groupId}/mealplans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ date, recipeId }),
    });

    if (!response.ok) throw new Error(`Failed to create meal plan: ${response.statusText}`);
    return response.json();
  }

  async deleteMealPlan(groupId: number, entryId: number, token: string): Promise<void> {
    const response = await fetch(`${appConfig.api.baseUrl}/api/groups/${groupId}/mealplans/${entryId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete meal plan: ${response.statusText}`);
    }
  }

  async generateAiPlan(groupId: number, weekStart: string, token: string): Promise<MealPlan[]> {
    const response = await fetch(`${appConfig.api.baseUrl}/api/groups/${groupId}/mealplans/ai-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ weekStart }),
    });

    if (!response.ok) throw new Error(`Failed to generate AI plan: ${response.statusText}`);
    return response.json();
  }
}

export const mealPlanService = new MealPlanService();
