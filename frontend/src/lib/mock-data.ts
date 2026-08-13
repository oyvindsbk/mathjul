/**
 * Mock data for recipes
 * Used as fallback when API is unavailable
 */

export interface StructuredIngredient {
  quantity: number | null;
  unit: string | null;
  name: string;
}

export interface Category {
  id: number;
  name: string;
  group: string;
}

/**
 * Id of the seeded "Tilbehør" category.
 * Must match RecipeCategories.TilbehorId on the backend.
 */
export const TILBEHOR_CATEGORY_ID = 16;

/** Lightweight reference to a recipe in a side-dish (tilbehør) relationship. */
export interface RecipeRef {
  id: number;
  title: string;
  imageUrl?: string | null;
}

export interface InstructionStep {
  text: string;
  imageUrl?: string | null;
}

export interface IngredientSection {
  heading: string;
  ingredients: StructuredIngredient[];
}

export interface InstructionSection {
  heading: string;
  steps: InstructionStep[];
}

export interface Recipe {
  id: number;
  title: string;
  description?: string;
  ingredients?: StructuredIngredient[];
  instructionSteps?: InstructionStep[];
  ingredientSections?: IngredientSection[];
  instructionSections?: InstructionSection[];
  prepTime?: number | null;
  cookTime?: string | null;
  cookTimeMinutes?: number | null;
  servings?: number | null;
  /** How `servings` is counted: "porsjoner" (default), "antall", or "custom". */
  quantityType?: string;
  /** Unit label used when quantityType is "custom". */
  customUnit?: string | null;
  imageUrl?: string | null;
  categories?: Category[];
  tips?: string[];
  isLikedByMe?: boolean;
  ownerEmail?: string | null;
  sourceUrl?: string | null;
  createdAt?: string;
  /** Last edit timestamp. Scopes persisted cooking progress — see lib/cooking-progress.ts. */
  updatedAt?: string;
  /** Side dishes attached to this recipe, in order. */
  sideDishes?: RecipeRef[];
  /** Recipes this one is attached to as a side dish. Read-only. */
  usedAsSideDishIn?: RecipeRef[];
}

export const mockCategories: Category[] = [
  { id: 1, name: 'Frokost', group: 'Måltidstype' },
  { id: 2, name: 'Lunsj', group: 'Måltidstype' },
  { id: 3, name: 'Middag', group: 'Måltidstype' },
  { id: 4, name: 'Dessert', group: 'Måltidstype' },
  { id: 5, name: 'Kveldsmat', group: 'Måltidstype' },
  { id: 6, name: 'Søtbakst', group: 'Måltidstype' },
  { id: 7, name: 'Snacks', group: 'Måltidstype' },
  { id: 8, name: 'Drikke', group: 'Måltidstype' },
  { id: 9, name: 'Enkel', group: 'Vanskelighetsgrad' },
  { id: 10, name: 'Middels', group: 'Vanskelighetsgrad' },
  { id: 11, name: 'Avansert', group: 'Vanskelighetsgrad' },
  { id: 12, name: 'Under 15 min', group: 'Tilberedningstid' },
  { id: 13, name: 'Under 30 min', group: 'Tilberedningstid' },
  { id: 14, name: 'Under 1 time', group: 'Tilberedningstid' },
  { id: 15, name: 'Over 1 time', group: 'Tilberedningstid' },
  { id: TILBEHOR_CATEGORY_ID, name: 'Tilbehør', group: 'Måltidstype' },
];

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
    instructionSteps: [
      { text: 'Cook spaghetti according to package instructions.' },
      { text: 'Fry pancetta until crispy.' },
      { text: 'Whisk eggs with parmesan.' },
      { text: 'Toss hot pasta with pancetta, remove from heat, add egg mixture.' },
      { text: 'Season and serve immediately.' },
    ],
    prepTime: 10,
    cookTimeMinutes: 20,
    servings: 4,

    categories: [
      { id: 3, name: 'Middag', group: 'Måltidstype' },
      { id: 10, name: 'Middels', group: 'Vanskelighetsgrad' },
      { id: 13, name: 'Under 30 min', group: 'Tilberedningstid' },
    ],
    tips: [
      'Bruk romtempererte egg for en kremere saus.',
      'Ta pannen av varmen før du rører inn eggeblandingen – da unngår du eggerøre.',
    ],
  },
  {
    id: 2,
    title: 'Chicken Tikka Masala',
    description: 'Indian spiced chicken curry',
    ingredients: [
      { quantity: 600, unit: 'g', name: 'chicken breast' },
      { quantity: 400, unit: 'ml', name: 'tomato sauce' },
      { quantity: 200, unit: 'ml', name: 'heavy cream' },
      { quantity: 2, unit: 'tbsp', name: 'tikka masala spice mix' },
    ],
    instructionSteps: [
      { text: 'Marinate chicken in spices and yogurt for 1 hour.' },
      { text: 'Grill or pan-fry chicken until cooked.' },
      { text: 'Make sauce with tomatoes and cream.' },
      { text: 'Combine chicken and sauce, simmer 10 minutes.' },
    ],
    prepTime: 70,
    cookTimeMinutes: 30,
    servings: 4,

    categories: [
      { id: 3, name: 'Middag', group: 'Måltidstype' },
      { id: 10, name: 'Middels', group: 'Vanskelighetsgrad' },
      { id: 15, name: 'Over 1 time', group: 'Tilberedningstid' },
    ],
  },
  {
    id: 3,
    title: 'Chocolate Chip Cookies',
    description: 'Classic American cookies',
    ingredients: [
      { quantity: 225, unit: 'g', name: 'butter' },
      { quantity: 200, unit: 'g', name: 'sugar' },
      { quantity: 2, unit: null, name: 'eggs' },
      { quantity: 280, unit: 'g', name: 'flour' },
      { quantity: 200, unit: 'g', name: 'chocolate chips' },
    ],
    instructionSteps: [
      { text: 'Preheat oven to 180°C.' },
      { text: 'Cream butter and sugar.' },
      { text: 'Beat in eggs, then mix in flour and chocolate chips.' },
      { text: 'Drop spoonfuls on baking sheet and bake 10-12 minutes.' },
    ],
    prepTime: 15,
    cookTimeMinutes: 12,
    servings: 24,

    categories: [
      { id: 4, name: 'Dessert', group: 'Måltidstype' },
      { id: 6, name: 'Søtbakst', group: 'Måltidstype' },
      { id: 9, name: 'Enkel', group: 'Vanskelighetsgrad' },
      { id: 13, name: 'Under 30 min', group: 'Tilberedningstid' },
    ],
  },
  {
    id: 4,
    title: 'Caesar Salad',
    description: 'Fresh and crispy salad',
    ingredients: [
      { quantity: 1, unit: null, name: 'romaine lettuce' },
      { quantity: 50, unit: 'g', name: 'parmesan' },
      { quantity: 100, unit: 'g', name: 'croutons' },
      { quantity: 3, unit: 'tbsp', name: 'Caesar dressing' },
    ],
    instructionSteps: [
      { text: 'Tear lettuce into pieces.' },
      { text: 'Toss with dressing.' },
      { text: 'Top with parmesan and croutons.' },
    ],
    prepTime: 10,
    cookTimeMinutes: 0,
    servings: 2,

    categories: [
      { id: 2, name: 'Lunsj', group: 'Måltidstype' },
      { id: 9, name: 'Enkel', group: 'Vanskelighetsgrad' },
      { id: 12, name: 'Under 15 min', group: 'Tilberedningstid' },
    ],
  },
];
