/**
 * Mock data for recipes
 * Used as fallback when API is unavailable
 */

export interface StructuredIngredient {
  quantity: number | null;
  unit: string | null;
  name: string;
}

export interface Recipe {
  id: number;
  title: string;
  description?: string;
  ingredients?: StructuredIngredient[];
  instructions?: string[];
}

export const mockRecipes: Recipe[] = [
  {
    id: 1,
    title: 'Classic Spaghetti Carbonara',
    description: 'A traditional Italian pasta dish',
    ingredients: [
      { quantity: 400, unit: 'g', name: 'spaghetti' },
      { quantity: 200, unit: 'g', name: 'pancetta' },
      { quantity: 4, unit: null, name: 'eggs' },
      { quantity: 100, unit: 'g', name: 'parmesan' },
      { quantity: null, unit: null, name: 'salt and pepper to taste' },
    ],
  },
  {
    id: 2,
    title: 'Chicken Tikka Masala',
    description: 'Indian spiced chicken curry',
  },
  {
    id: 3,
    title: 'Chocolate Chip Cookies',
    description: 'Classic American cookies',
  },
  {
    id: 4,
    title: 'Caesar Salad',
    description: 'Fresh and crispy salad',
  },
];
