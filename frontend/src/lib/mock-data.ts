/**
 * Mock data for recipes
 * Used as fallback when API is unavailable
 */

export interface StructuredIngredient {
  /**
   * Stable id assigned by the backend, used to bind @-mentions in instruction
   * steps. Absent on rows the form has just added and on legacy recipes that
   * have not been read back since ids were introduced.
   */
  id?: string | null;
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

/** How a mention renders: the full amount, or just the ingredient's name. */
export type MentionDisplay = "full" | "name";

/** An ingredient referenced from a step's text via an `@[n]` token. */
export interface IngredientMention {
  /** Matches {@link StructuredIngredient.id}. */
  ingredientId: string;
  /** The ingredient's name at authoring time, shown if the ingredient is gone. */
  fallbackName: string;
  /** "full" (amount + unit + name) or "name" (name only). */
  display: MentionDisplay;
}

export interface InstructionStep {
  /** May contain `@[0]`, `@[1]`, … tokens indexing into {@link mentions}. */
  text: string;
  imageUrl?: string | null;
  mentions?: IngredientMention[];
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
  /** Owner shown by name rather than email. Null when the recipe has no owner. */
  ownerDisplayName?: string | null;
  /** Owner's user id for profile links. Null when the owner has no user record. */
  ownerUserId?: number | null;
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
    // Ids are what mentions bind to; the server assigns them, and this fixture
    // carries its own so the mention below stays bound in mock mode.
    ingredients: [
      { id: 'mock-1-spaghetti', quantity: 400, unit: 'g', name: 'spaghetti' },
      { id: 'mock-1-pancetta', quantity: 200, unit: 'g', name: 'pancetta' },
      { id: 'mock-1-eggs', quantity: 4, unit: null, name: 'eggs' },
      { id: 'mock-1-parmesan', quantity: 100, unit: 'g', name: 'parmesan' },
      { id: 'mock-1-salt', quantity: null, unit: null, name: 'salt and pepper to taste' },
    ],
    instructionSteps: [
      // Step 1 carries a mention so the read surfaces have something to resolve:
      // its amount scales with the servings stepper, unlike the dead text in the
      // steps below it.
      {
        text: 'Cook @[0] according to package instructions.',
        mentions: [
          { ingredientId: 'mock-1-spaghetti', fallbackName: 'spaghetti', display: 'full' },
        ],
      },
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
      { id: 'mock-2-chicken', quantity: 600, unit: 'g', name: 'chicken breast' },
      { id: 'mock-2-tomato', quantity: 400, unit: 'ml', name: 'tomato sauce' },
      { id: 'mock-2-cream', quantity: 200, unit: 'ml', name: 'heavy cream' },
      { id: 'mock-2-spice', quantity: 2, unit: 'tbsp', name: 'tikka masala spice mix' },
    ],
    instructionSteps: [
      {
        text: 'Marinate @[0] in spices and yogurt for 1 hour.',
        mentions: [
          { ingredientId: 'mock-2-chicken', fallbackName: 'chicken breast', display: 'name' },
        ],
      },
      {
        // A deliberately broken reference: the ingredient it points at was removed
        // from the list above. The step must still read, falling back to the stored
        // name as ordinary text — it just stops scaling.
        text: 'Grill or pan-fry @[0] until cooked.',
        mentions: [
          { ingredientId: 'mock-2-removed', fallbackName: 'yogurt', display: 'full' },
        ],
      },
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
