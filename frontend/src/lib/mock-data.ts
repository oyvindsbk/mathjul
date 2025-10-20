/**
 * Mock data for recipes
 * Used as fallback when API is unavailable
 */

export interface Recipe {
  id: number;
  title: string;
  description?: string;
  ingredients?: string[];
  instructions?: string[];
}

export const mockRecipes: Recipe[] = [
  {
    id: 1,
    title: 'Classic Spaghetti Carbonara',
    description: 'A traditional Italian pasta dish',
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
