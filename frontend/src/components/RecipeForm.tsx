'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { RecipeFormData } from '@/lib/services/recipe.service';
import type { StructuredIngredient } from '@/lib/mock-data';

interface RecipeFormProps {
  initialData: RecipeFormData;
  onSave: (data: RecipeFormData) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  submitLabel?: string;
}

// Drag handle icon
function GripIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="text-gray-400"
    >
      <circle cx="5" cy="4" r="1.5" />
      <circle cx="11" cy="4" r="1.5" />
      <circle cx="5" cy="8" r="1.5" />
      <circle cx="11" cy="8" r="1.5" />
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="11" cy="12" r="1.5" />
    </svg>
  );
}

interface SortableIngredientProps {
  id: string;
  index: number;
  ingredient: StructuredIngredient;
  onChange: (index: number, updated: StructuredIngredient) => void;
  onRemove: (index: number) => void;
}

function SortableIngredient({ id, index, ingredient, onChange, onRemove }: SortableIngredientProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex gap-2 items-center">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="px-2 py-2 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 touch-none"
        aria-label="Drag to reorder"
      >
        <GripIcon />
      </button>
      <input
        type="number"
        step="any"
        value={ingredient.quantity ?? ''}
        onChange={(e) => onChange(index, { ...ingredient, quantity: e.target.value ? parseFloat(e.target.value) : null })}
        placeholder="Qty"
        className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
      />
      <input
        type="text"
        value={ingredient.unit ?? ''}
        onChange={(e) => onChange(index, { ...ingredient, unit: e.target.value || null })}
        placeholder="Unit"
        className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
      />
      <input
        type="text"
        value={ingredient.name}
        onChange={(e) => onChange(index, { ...ingredient, name: e.target.value })}
        placeholder="Ingredient name"
        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
      />
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
      >
        ✕
      </button>
    </div>
  );
}

interface SortableInstructionProps {
  id: string;
  index: number;
  instruction: string;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  onInsertBelow: (index: number) => void;
}

function SortableInstruction({ id, index, instruction, onChange, onRemove, onInsertBelow }: SortableInstructionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex gap-2">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="px-2 py-2 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 self-start mt-2 touch-none"
        aria-label="Drag to reorder"
      >
        <GripIcon />
      </button>
      <span className="px-3 py-2 bg-gray-200 dark:bg-gray-800 rounded-lg font-medium min-w-[2.5rem] text-center self-start">
        {index + 1}
      </span>
      <textarea
        value={instruction}
        onChange={(e) => onChange(index, e.target.value)}
        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
        rows={2}
      />
      <div className="flex flex-col gap-1 self-start">
        <button
          type="button"
          data-testid={`insert-below-${index}`}
          onClick={() => onInsertBelow(index)}
          title="Insert step below"
          className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-800 text-sm"
        >
          +
        </button>
        <button
          type="button"
          data-testid={`remove-instruction-${index}`}
          onClick={() => onRemove(index)}
          title="Remove step"
          className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default function RecipeForm({
  initialData,
  onSave,
  onCancel,
  isSaving,
  submitLabel = 'Save Recipe',
}: RecipeFormProps) {
  const [formData, setFormData] = useState<RecipeFormData>(initialData);

  // Stable IDs for DnD (index-based keys cause issues when reordering)
  const [ingredientIds] = useState(() => initialData.ingredients.map((_, i) => `ing-${i}-${Date.now()}`));
  const [instructionIds, setInstructionIds] = useState(() => initialData.instructions.map((_, i) => `ins-${i}-${Date.now()}`));
  const [ingIds, setIngIds] = useState(ingredientIds);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleField = (field: keyof RecipeFormData, value: RecipeFormData[typeof field]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Ingredients
  const handleIngredientChange = (index: number, updated: StructuredIngredient) => {
    const newIngredients = [...formData.ingredients];
    newIngredients[index] = updated;
    handleField('ingredients', newIngredients);
  };

  const handleRemoveIngredient = (index: number) => {
    handleField('ingredients', formData.ingredients.filter((_, i) => i !== index));
    setIngIds((ids) => ids.filter((_, i) => i !== index));
  };

  const handleAddIngredient = () => {
    handleField('ingredients', [...formData.ingredients, { quantity: null, unit: null, name: '' }]);
    setIngIds((ids) => [...ids, `ing-${Date.now()}`]);
  };

  const handleIngredientDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ingIds.indexOf(active.id as string);
    const newIndex = ingIds.indexOf(over.id as string);
    setIngIds((ids) => arrayMove(ids, oldIndex, newIndex));
    handleField('ingredients', arrayMove(formData.ingredients, oldIndex, newIndex));
  };

  // Instructions
  const handleInstructionChange = (index: number, value: string) => {
    const newInstructions = [...formData.instructions];
    newInstructions[index] = value;
    handleField('instructions', newInstructions);
  };

  const handleRemoveInstruction = (index: number) => {
    handleField('instructions', formData.instructions.filter((_, i) => i !== index));
    setInstructionIds((ids) => ids.filter((_, i) => i !== index));
  };

  const handleAddInstruction = () => {
    handleField('instructions', [...formData.instructions, '']);
    setInstructionIds((ids) => [...ids, `ins-${Date.now()}`]);
  };

  const handleInsertInstructionBelow = (index: number) => {
    const newInstructions = [...formData.instructions];
    newInstructions.splice(index + 1, 0, '');
    handleField('instructions', newInstructions);
    setInstructionIds((ids) => {
      const newIds = [...ids];
      newIds.splice(index + 1, 0, `ins-${Date.now()}`);
      return newIds;
    });
  };

  const handleInstructionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = instructionIds.indexOf(active.id as string);
    const newIndex = instructionIds.indexOf(over.id as string);
    setInstructionIds((ids) => arrayMove(ids, oldIndex, newIndex));
    handleField('instructions', arrayMove(formData.instructions, oldIndex, newIndex));
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleIngredientDragEnd}>
            <SortableContext items={ingIds} strategy={verticalListSortingStrategy}>
              {formData.ingredients.map((ingredient, index) => (
                <SortableIngredient
                  key={ingIds[index]}
                  id={ingIds[index]}
                  index={index}
                  ingredient={ingredient}
                  onChange={handleIngredientChange}
                  onRemove={handleRemoveIngredient}
                />
              ))}
            </SortableContext>
          </DndContext>
          <button
            type="button"
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleInstructionDragEnd}>
            <SortableContext items={instructionIds} strategy={verticalListSortingStrategy}>
              {formData.instructions.map((instruction, index) => (
                <SortableInstruction
                  key={instructionIds[index]}
                  id={instructionIds[index]}
                  index={index}
                  instruction={instruction}
                  onChange={handleInstructionChange}
                  onRemove={handleRemoveInstruction}
                  onInsertBelow={handleInsertInstructionBelow}
                />
              ))}
            </SortableContext>
          </DndContext>
          <button
            type="button"
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
