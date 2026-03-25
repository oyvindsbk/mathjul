'use client';

import { useState } from 'react';
import type { RecipeFormData } from '@/lib/services/recipe.service';
import type { StructuredIngredient } from '@/lib/mock-data';

interface RecipeFormProps {
  initialData: RecipeFormData;
  onSave: (data: RecipeFormData) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  submitLabel?: string;
}

export default function RecipeForm({
  initialData,
  onSave,
  onCancel,
  isSaving,
  submitLabel = 'Save Recipe',
}: RecipeFormProps) {
  const [formData, setFormData] = useState<RecipeFormData>(initialData);

  const handleField = (field: keyof RecipeFormData, value: RecipeFormData[typeof field]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleIngredientChange = (index: number, updated: StructuredIngredient) => {
    const newIngredients = [...formData.ingredients];
    newIngredients[index] = updated;
    handleField('ingredients', newIngredients);
  };

  const handleRemoveIngredient = (index: number) => {
    handleField('ingredients', formData.ingredients.filter((_, i) => i !== index));
  };

  const handleAddIngredient = () => {
    handleField('ingredients', [...formData.ingredients, { quantity: null, unit: null, name: '' }]);
  };

  const handleInstructionChange = (index: number, value: string) => {
    const newInstructions = [...formData.instructions];
    newInstructions[index] = value;
    handleField('instructions', newInstructions);
  };

  const handleRemoveInstruction = (index: number) => {
    handleField('instructions', formData.instructions.filter((_, i) => i !== index));
  };

  const handleAddInstruction = () => {
    handleField('instructions', [...formData.instructions, '']);
  };

  const handleSubmit = async () => {
    await onSave(formData);
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium mb-2">Title</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => handleField('title', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-2">Description</label>
        <textarea
          value={formData.description || ''}
          onChange={(e) => handleField('description', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
          rows={2}
        />
      </div>

      {/* Difficulty */}
      <div>
        <label className="block text-sm font-medium mb-2">Difficulty</label>
        <select
          value={formData.difficulty || 'Medium'}
          onChange={(e) => handleField('difficulty', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
        >
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
        </select>
      </div>

      {/* Servings, Prep Time, Cook Time */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Servings</label>
          <input
            type="number"
            value={formData.servings ?? ''}
            onChange={(e) => handleField('servings', parseInt(e.target.value) || null)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Prep Time (min)</label>
          <input
            type="number"
            value={formData.prepTime ?? ''}
            onChange={(e) => handleField('prepTime', parseInt(e.target.value) || null)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Cook Time (min)</label>
          <input
            type="number"
            value={formData.cookTime ?? ''}
            onChange={(e) => handleField('cookTime', parseInt(e.target.value) || null)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
          />
        </div>
      </div>

      {/* Ingredients */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Ingredients ({formData.ingredients.length})
        </label>
        <div className="space-y-2">
          {formData.ingredients.map((ingredient, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="number"
                step="any"
                value={ingredient.quantity ?? ''}
                onChange={(e) =>
                  handleIngredientChange(index, {
                    ...ingredient,
                    quantity: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                placeholder="Qty"
                className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
              />
              <input
                type="text"
                value={ingredient.unit ?? ''}
                onChange={(e) =>
                  handleIngredientChange(index, {
                    ...ingredient,
                    unit: e.target.value || null,
                  })
                }
                placeholder="Unit"
                className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
              />
              <input
                type="text"
                value={ingredient.name}
                onChange={(e) =>
                  handleIngredientChange(index, { ...ingredient, name: e.target.value })
                }
                placeholder="Ingredient name"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
              />
              <button
                onClick={() => handleRemoveIngredient(index)}
                className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={handleAddIngredient}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            + Add Ingredient
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Instructions ({formData.instructions.length} steps)
        </label>
        <div className="space-y-2">
          {formData.instructions.map((instruction, index) => (
            <div key={index} className="flex gap-2">
              <span className="px-3 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg font-medium">
                {index + 1}
              </span>
              <textarea
                value={instruction}
                onChange={(e) => handleInstructionChange(index, e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                rows={2}
              />
              <button
                onClick={() => handleRemoveInstruction(index)}
                className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={handleAddInstruction}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            + Add Step
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 pt-4">
        <button
          onClick={handleSubmit}
          disabled={isSaving}
          className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
        >
          {isSaving ? 'Saving...' : submitLabel}
        </button>
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="px-6 py-3 bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
