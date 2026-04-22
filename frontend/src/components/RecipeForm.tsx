'use client';

import React, { useRef, useState } from 'react';
import CropModal from './CropModal';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
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
import type { Category, IngredientSection, InstructionSection, InstructionStep, StructuredIngredient } from '@/lib/mock-data';

interface RecipeFormProps {
  initialData: RecipeFormData;
  onSave: (data: RecipeFormData) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  submitLabel?: string;
  availableCategories?: Category[];
  /** Called when user selects a photo for a step. Return the URL to display (blob: or remote). */
  onStepPhotoSelected?: (index: number, file: File) => Promise<string | null>;
  /** Called when user removes a step photo. */
  onStepPhotoRemove?: (index: number) => Promise<void>;
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
    <div ref={setNodeRef} style={style} className="flex flex-col sm:flex-row gap-1 sm:gap-2 sm:items-center">
      <div className="flex gap-1 sm:gap-2 items-center">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="px-2 py-2 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 touch-none shrink-0"
          aria-label="Drag to reorder"
        >
          <GripIcon />
        </button>
        <input
          type="number"
          step="any"
          value={ingredient.quantity ?? ''}
          onChange={(e) => onChange(index, { ...ingredient, quantity: e.target.value ? parseFloat(e.target.value) : null })}
          placeholder="Antall"
          className="w-16 sm:w-20 px-2 sm:px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
        />
        <input
          type="text"
          value={ingredient.unit ?? ''}
          onChange={(e) => onChange(index, { ...ingredient, unit: e.target.value || null })}
          placeholder="Enhet"
          className="w-20 sm:w-24 px-2 sm:px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
        />
      </div>
      <div className="flex gap-1 sm:gap-2 items-center pl-8 sm:pl-0 sm:flex-1">
        <input
          type="text"
          value={ingredient.name}
          onChange={(e) => onChange(index, { ...ingredient, name: e.target.value })}
          placeholder="Ingrediensnavn"
          className="flex-1 px-2 sm:px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
        />
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="px-2 sm:px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 shrink-0"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

interface SortableInstructionProps {
  id: string;
  index: number;
  step: InstructionStep;
  onChange: (index: number, text: string) => void;
  onRemove: (index: number) => void;
  onInsertBelow: (index: number) => void;
  onPhotoSelected?: (index: number, file: File) => Promise<void>;
  onPhotoRemove?: (index: number) => Promise<void>;
}

function SortableInstruction({ id, index, step, onChange, onRemove, onInsertBelow, onPhotoSelected, onPhotoRemove }: SortableInstructionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<File | null>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const uploadFile = async (file: File) => {
    if (!onPhotoSelected) return;
    setPhotoError(null);
    setIsPhotoLoading(true);
    try {
      await onPhotoSelected(index, file);
    } catch {
      setPhotoError('Kunne ikke laste opp bilde');
    } finally {
      setIsPhotoLoading(false);
    }
  };

  const handlePhotoFile = (file: File) => {
    if (!onPhotoSelected) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setPhotoError('Kun JPEG, PNG og WEBP godtas');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setPhotoError('Maks 10 MB');
      return;
    }
    setPhotoError(null);
    setCropTarget(file);
  };

  const handlePhotoFilePaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
    if (!item) return;
    const file = item.getAsFile();
    if (file) handlePhotoFile(file);
  };

  const handlePhotoRemove = async () => {
    if (!onPhotoRemove) return;
    setIsPhotoLoading(true);
    setPhotoError(null);
    try {
      await onPhotoRemove(index);
    } catch {
      setPhotoError('Kunne ikke fjerne bilde');
    } finally {
      setIsPhotoLoading(false);
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="flex gap-2">
      {cropTarget && (
        <CropModal
          file={cropTarget}
          onConfirm={(cropped) => { setCropTarget(null); void uploadFile(cropped); }}
          onSkip={() => { setCropTarget(null); void uploadFile(cropTarget); }}
        />
      )}
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
      <div className="flex-1 space-y-2">
        <textarea
          value={step.text}
          onChange={(e) => onChange(index, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
          rows={2}
        />
        {/* Per-step photo zone — only shown when photo callbacks are wired */}
        {onPhotoSelected && (
          <div onPaste={handlePhotoFilePaste} tabIndex={-1}>
            {step.imageUrl ? (
              <div className="relative w-40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={step.imageUrl}
                  alt={`Step ${index + 1} photo`}
                  className="w-40 h-28 object-cover rounded border border-gray-200 dark:border-gray-700"
                />
                {isPhotoLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-black/40 rounded">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                <div className="flex gap-1 mt-1">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={isPhotoLoading}
                    className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                  >
                    Erstatt
                  </button>
                  <button
                    type="button"
                    onClick={handlePhotoRemove}
                    disabled={isPhotoLoading}
                    className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/60 disabled:opacity-50"
                  >
                    Fjern
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={isPhotoLoading}
                className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded hover:border-gray-400 dark:hover:border-gray-500 disabled:opacity-50"
              >
                {isPhotoLoading ? (
                  <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                )}
                Legg til bilde
              </button>
            )}
            {photoError && <p className="text-xs text-red-600 dark:text-red-400">{photoError}</p>}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePhotoFile(file);
                e.target.value = '';
              }}
            />
          </div>
        )}
      </div>
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

function DroppableSection({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`min-h-[2rem] transition-colors rounded ${isOver ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
      {children}
    </div>
  );
}

export default function RecipeForm({
  initialData,
  onSave,
  onCancel,
  isSaving,
  submitLabel = 'Lagre oppskrift',
  availableCategories = [],
  onStepPhotoSelected,
  onStepPhotoRemove,
}: RecipeFormProps) {
  const [formData, setFormData] = useState<RecipeFormData>(initialData);

  // Stable IDs for DnD (index-based keys cause issues when reordering)
  const [ingredientIds] = useState(() => initialData.ingredients.map((_, i) => `ing-${i}-${Date.now()}`));
  const [instructionIds, setInstructionIds] = useState(() => initialData.instructionSteps.map((_, i) => `ins-${i}-${Date.now()}`));
  const [ingIds, setIngIds] = useState(ingredientIds);

  // Stable IDs for sectioned DnD
  const [sectionIngIds, setSectionIngIds] = useState<string[][]>(() =>
    initialData.ingredientSections.map((s, si) => s.ingredients.map((_, i) => `sing-${si}-${i}-${Date.now()}`))
  );
  const [sectionStepIds, setSectionStepIds] = useState<string[][]>(() =>
    initialData.instructionSections.map((s, si) => s.steps.map((_, i) => `sstep-${si}-${i}-${Date.now()}`))
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleField = (field: keyof RecipeFormData, value: RecipeFormData[typeof field]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Ingredients (flat)
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

  // Ingredient sections
  const handleAddIngredientSection = () => {
    const newSection: IngredientSection = { heading: '', ingredients: [] };
    if (formData.ingredientSections.length === 0 && formData.ingredients.length > 0) {
      // Convert flat list to first section
      handleField('ingredientSections', [{ heading: '', ingredients: [...formData.ingredients] }, newSection]);
      handleField('ingredients', []);
      setSectionIngIds([
        formData.ingredients.map((_, i) => `sing-${Date.now()}-${i}`),
        [],
      ]);
    } else {
      handleField('ingredientSections', [...formData.ingredientSections, newSection]);
      setSectionIngIds((ids) => [...ids, []]);
    }
  };

  const handleRemoveIngredientSections = () => {
    const allIngredients = formData.ingredientSections.flatMap((s) => s.ingredients);
    handleField('ingredients', allIngredients);
    handleField('ingredientSections', []);
    setSectionIngIds([]);
  };

  const handleIngredientSectionHeading = (sIdx: number, heading: string) => {
    const sections = [...formData.ingredientSections];
    sections[sIdx] = { ...sections[sIdx], heading };
    handleField('ingredientSections', sections);
  };

  const handleRemoveIngredientSection = (sIdx: number) => {
    handleField('ingredientSections', formData.ingredientSections.filter((_, i) => i !== sIdx));
    setSectionIngIds((ids) => ids.filter((_, i) => i !== sIdx));
  };

  const handleSectionIngredientChange = (sIdx: number, iIdx: number, updated: StructuredIngredient) => {
    const sections = formData.ingredientSections.map((s, si) =>
      si === sIdx ? { ...s, ingredients: s.ingredients.map((ing, ii) => (ii === iIdx ? updated : ing)) } : s
    );
    handleField('ingredientSections', sections);
  };

  const handleRemoveSectionIngredient = (sIdx: number, iIdx: number) => {
    const sections = formData.ingredientSections.map((s, si) =>
      si === sIdx ? { ...s, ingredients: s.ingredients.filter((_, ii) => ii !== iIdx) } : s
    );
    handleField('ingredientSections', sections);
    setSectionIngIds((ids) => ids.map((arr, si) => si === sIdx ? arr.filter((_, ii) => ii !== iIdx) : arr));
  };

  const handleAddSectionIngredient = (sIdx: number) => {
    const sections = formData.ingredientSections.map((s, si) =>
      si === sIdx ? { ...s, ingredients: [...s.ingredients, { quantity: null, unit: null, name: '' }] } : s
    );
    handleField('ingredientSections', sections);
    setSectionIngIds((ids) => ids.map((arr, si) => si === sIdx ? [...arr, `sing-${Date.now()}`] : arr));
  };

  const handleSectionIngredientDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    // Find source section
    let fromSection = -1;
    let fromIndex = -1;
    for (let si = 0; si < sectionIngIds.length; si++) {
      const idx = sectionIngIds[si].indexOf(activeId);
      if (idx !== -1) { fromSection = si; fromIndex = idx; break; }
    }
    if (fromSection === -1) return;

    // Find target section and index
    let toSection = -1;
    let toIndex = -1;
    // overId is a droppable section container
    const sectionMatch = overId.match(/^ing-section-(\d+)$/);
    if (sectionMatch) {
      toSection = parseInt(sectionMatch[1]);
      toIndex = sectionIngIds[toSection]?.length ?? 0; // append to end
    } else {
      // overId is an item id
      for (let si = 0; si < sectionIngIds.length; si++) {
        const idx = sectionIngIds[si].indexOf(overId);
        if (idx !== -1) { toSection = si; toIndex = idx; break; }
      }
    }
    if (toSection === -1) return;

    if (fromSection === toSection) {
      // Same section reorder
      setSectionIngIds((allIds) => allIds.map((arr, si) =>
        si === fromSection ? arrayMove(arr, fromIndex, toIndex) : arr
      ));
      const sections = formData.ingredientSections.map((s, si) =>
        si === fromSection ? { ...s, ingredients: arrayMove(s.ingredients, fromIndex, toIndex) } : s
      );
      handleField('ingredientSections', sections);
    } else {
      // Cross-section move
      const ingredient = formData.ingredientSections[fromSection].ingredients[fromIndex];
      const movedId = sectionIngIds[fromSection][fromIndex];
      setSectionIngIds((allIds) => allIds.map((arr, si) => {
        if (si === fromSection) return arr.filter((_, i) => i !== fromIndex);
        if (si === toSection) { const next = [...arr]; next.splice(toIndex, 0, movedId); return next; }
        return arr;
      }));
      const sections = formData.ingredientSections.map((s, si) => {
        if (si === fromSection) return { ...s, ingredients: s.ingredients.filter((_, i) => i !== fromIndex) };
        if (si === toSection) { const next = [...s.ingredients]; next.splice(toIndex, 0, ingredient); return { ...s, ingredients: next }; }
        return s;
      });
      handleField('ingredientSections', sections);
    }
  };

  // Instructions (flat)
  const handleInstructionChange = (index: number, text: string) => {
    const newSteps = [...formData.instructionSteps];
    newSteps[index] = { ...newSteps[index], text };
    handleField('instructionSteps', newSteps);
  };

  const handleStepPhotoSelected = onStepPhotoSelected
    ? async (index: number, file: File) => {
        const url = await onStepPhotoSelected(index, file);
        if (url !== null) {
          const newSteps = [...formData.instructionSteps];
          newSteps[index] = { ...newSteps[index], imageUrl: url };
          handleField('instructionSteps', newSteps);
        }
      }
    : undefined;

  const handleStepPhotoRemove = onStepPhotoRemove
    ? async (index: number) => {
        await onStepPhotoRemove(index);
        const newSteps = [...formData.instructionSteps];
        newSteps[index] = { ...newSteps[index], imageUrl: null };
        handleField('instructionSteps', newSteps);
      }
    : undefined;

  const handleRemoveInstruction = (index: number) => {
    handleField('instructionSteps', formData.instructionSteps.filter((_, i) => i !== index));
    setInstructionIds((ids) => ids.filter((_, i) => i !== index));
  };

  const handleAddInstruction = () => {
    handleField('instructionSteps', [...formData.instructionSteps, { text: '' }]);
    setInstructionIds((ids) => [...ids, `ins-${Date.now()}`]);
  };

  const handleInsertInstructionBelow = (index: number) => {
    const newSteps = [...formData.instructionSteps];
    newSteps.splice(index + 1, 0, { text: '' });
    handleField('instructionSteps', newSteps);
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
    handleField('instructionSteps', arrayMove(formData.instructionSteps, oldIndex, newIndex));
  };

  // Instruction sections
  const handleAddInstructionSection = () => {
    const newSection: InstructionSection = { heading: '', steps: [] };
    if (formData.instructionSections.length === 0 && formData.instructionSteps.length > 0) {
      handleField('instructionSections', [{ heading: '', steps: [...formData.instructionSteps] }, newSection]);
      handleField('instructionSteps', []);
      setSectionStepIds([
        formData.instructionSteps.map((_, i) => `sstep-${Date.now()}-${i}`),
        [],
      ]);
    } else {
      handleField('instructionSections', [...formData.instructionSections, newSection]);
      setSectionStepIds((ids) => [...ids, []]);
    }
  };

  const handleRemoveInstructionSections = () => {
    const allSteps = formData.instructionSections.flatMap((s) => s.steps);
    handleField('instructionSteps', allSteps);
    handleField('instructionSections', []);
    setSectionStepIds([]);
  };

  const handleInstructionSectionHeading = (sIdx: number, heading: string) => {
    const sections = [...formData.instructionSections];
    sections[sIdx] = { ...sections[sIdx], heading };
    handleField('instructionSections', sections);
  };

  const handleRemoveInstructionSection = (sIdx: number) => {
    handleField('instructionSections', formData.instructionSections.filter((_, i) => i !== sIdx));
    setSectionStepIds((ids) => ids.filter((_, i) => i !== sIdx));
  };

  const handleSectionStepChange = (sIdx: number, stIdx: number, text: string) => {
    const sections = formData.instructionSections.map((s, si) =>
      si === sIdx ? { ...s, steps: s.steps.map((st, sti) => (sti === stIdx ? { ...st, text } : st)) } : s
    );
    handleField('instructionSections', sections);
  };

  const handleRemoveSectionStep = (sIdx: number, stIdx: number) => {
    const sections = formData.instructionSections.map((s, si) =>
      si === sIdx ? { ...s, steps: s.steps.filter((_, sti) => sti !== stIdx) } : s
    );
    handleField('instructionSections', sections);
    setSectionStepIds((ids) => ids.map((arr, si) => si === sIdx ? arr.filter((_, sti) => sti !== stIdx) : arr));
  };

  const handleAddSectionStep = (sIdx: number) => {
    const sections = formData.instructionSections.map((s, si) =>
      si === sIdx ? { ...s, steps: [...s.steps, { text: '' }] } : s
    );
    handleField('instructionSections', sections);
    setSectionStepIds((ids) => ids.map((arr, si) => si === sIdx ? [...arr, `sstep-${Date.now()}`] : arr));
  };

  const handleInsertSectionStepBelow = (sIdx: number, stIdx: number) => {
    const sections = formData.instructionSections.map((s, si) => {
      if (si !== sIdx) return s;
      const newSteps = [...s.steps];
      newSteps.splice(stIdx + 1, 0, { text: '' });
      return { ...s, steps: newSteps };
    });
    handleField('instructionSections', sections);
    setSectionStepIds((ids) => ids.map((arr, si) => {
      if (si !== sIdx) return arr;
      const newArr = [...arr];
      newArr.splice(stIdx + 1, 0, `sstep-${Date.now()}`);
      return newArr;
    }));
  };

  const handleSectionStepDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    // Find source section
    let fromSection = -1;
    let fromIndex = -1;
    for (let si = 0; si < sectionStepIds.length; si++) {
      const idx = sectionStepIds[si].indexOf(activeId);
      if (idx !== -1) { fromSection = si; fromIndex = idx; break; }
    }
    if (fromSection === -1) return;

    // Find target section and index
    let toSection = -1;
    let toIndex = -1;
    const sectionMatch = overId.match(/^step-section-(\d+)$/);
    if (sectionMatch) {
      toSection = parseInt(sectionMatch[1]);
      toIndex = sectionStepIds[toSection]?.length ?? 0;
    } else {
      for (let si = 0; si < sectionStepIds.length; si++) {
        const idx = sectionStepIds[si].indexOf(overId);
        if (idx !== -1) { toSection = si; toIndex = idx; break; }
      }
    }
    if (toSection === -1) return;

    if (fromSection === toSection) {
      setSectionStepIds((allIds) => allIds.map((arr, si) =>
        si === fromSection ? arrayMove(arr, fromIndex, toIndex) : arr
      ));
      const sections = formData.instructionSections.map((s, si) =>
        si === fromSection ? { ...s, steps: arrayMove(s.steps, fromIndex, toIndex) } : s
      );
      handleField('instructionSections', sections);
    } else {
      const step = formData.instructionSections[fromSection].steps[fromIndex];
      const movedId = sectionStepIds[fromSection][fromIndex];
      setSectionStepIds((allIds) => allIds.map((arr, si) => {
        if (si === fromSection) return arr.filter((_, i) => i !== fromIndex);
        if (si === toSection) { const next = [...arr]; next.splice(toIndex, 0, movedId); return next; }
        return arr;
      }));
      const sections = formData.instructionSections.map((s, si) => {
        if (si === fromSection) return { ...s, steps: s.steps.filter((_, i) => i !== fromIndex) };
        if (si === toSection) { const next = [...s.steps]; next.splice(toIndex, 0, step); return { ...s, steps: next }; }
        return s;
      });
      handleField('instructionSections', sections);
    }
  };

  const handleToggleCategory = (id: number) => {
    const current = formData.categoryIds ?? [];
    const next = current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
    handleField('categoryIds', next);
  };

  const handleSubmit = async () => {
    await onSave({ ...formData, tips: (formData.tips ?? []).filter(t => t.trim() !== '') });
  };

  const usingSectionedIngredients = formData.ingredientSections.length > 0;
  const usingSectionedInstructions = formData.instructionSections.length > 0;

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium mb-2">Tittel</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => handleField('title', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-2">Beskrivelse</label>
        <textarea
          value={formData.description || ''}
          onChange={(e) => handleField('description', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
          rows={2}
        />
      </div>

      {/* Quantity type + servings */}
      <div>
        <label className="block text-sm font-medium mb-2">Antall / Porsjoner</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {(['porsjoner', 'antall', 'custom'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                handleField('quantityType', type);
                if (type !== 'custom') handleField('customUnit', null);
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                (formData.quantityType ?? 'porsjoner') === type
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
              }`}
            >
              {type === 'porsjoner' ? 'Porsjoner' : type === 'antall' ? 'Antall (stk)' : 'Egendefinert'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            step="any"
            min="0"
            placeholder={(formData.quantityType ?? 'porsjoner') === 'porsjoner' ? 'Porsjoner' : (formData.quantityType === 'custom' ? 'Antall' : 'Antall (stk)')}
            value={formData.servings ?? ''}
            onChange={(e) => handleField('servings', e.target.value === '' ? null : parseFloat(e.target.value))}
            className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
          />
          {formData.quantityType === 'custom' && (
            <input
              type="text"
              placeholder="Enhet (f.eks. brød, brett)"
              value={formData.customUnit ?? ''}
              onChange={(e) => handleField('customUnit', e.target.value || null)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            />
          )}
        </div>
      </div>

      {/* Prep Time, Cook Time */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Forberedelsestid (min)</label>
          <input
            type="number"
            value={formData.prepTime ?? ''}
            onChange={(e) => handleField('prepTime', parseInt(e.target.value) || null)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Steketid (min)</label>
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
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium">
            Ingredienser
          </label>
          {usingSectionedIngredients ? (
            <button
              type="button"
              onClick={handleRemoveIngredientSections}
              className="text-xs text-gray-500 hover:text-red-600 underline"
            >
              Fjern seksjoner
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAddIngredientSection}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              + Legg til seksjon
            </button>
          )}
        </div>

        {usingSectionedIngredients ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionIngredientDragEnd}>
            <div className="space-y-4">
              {formData.ingredientSections.map((section, sIdx) => (
                <div key={sIdx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={section.heading}
                      onChange={(e) => handleIngredientSectionHeading(sIdx, e.target.value)}
                      placeholder="Seksjonstittel (f.eks. Saus, Marinade)"
                      className="flex-1 px-3 py-1.5 text-sm font-semibold border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveIngredientSection(sIdx)}
                      className="px-2 py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      Fjern seksjon
                    </button>
                  </div>
                  <div className="space-y-2 pl-1">
                    <SortableContext items={sectionIngIds[sIdx] ?? []} strategy={verticalListSortingStrategy}>
                      <DroppableSection id={`ing-section-${sIdx}`}>
                        {section.ingredients.map((ingredient, iIdx) => (
                          <SortableIngredient
                            key={(sectionIngIds[sIdx] ?? [])[iIdx] ?? iIdx}
                            id={(sectionIngIds[sIdx] ?? [])[iIdx] ?? `sing-${sIdx}-${iIdx}`}
                            index={iIdx}
                            ingredient={ingredient}
                            onChange={(i, updated) => handleSectionIngredientChange(sIdx, i, updated)}
                            onRemove={(i) => handleRemoveSectionIngredient(sIdx, i)}
                          />
                        ))}
                      </DroppableSection>
                    </SortableContext>
                    <button
                      type="button"
                      onClick={() => handleAddSectionIngredient(sIdx)}
                      className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
                    >
                      + Ingrediens
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddIngredientSection}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm"
              >
                + Ny seksjon
              </button>
            </div>
          </DndContext>
        ) : (
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
              + Legg til ingrediens
            </button>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium">
            Instruksjoner
          </label>
          {usingSectionedInstructions ? (
            <button
              type="button"
              onClick={handleRemoveInstructionSections}
              className="text-xs text-gray-500 hover:text-red-600 underline"
            >
              Fjern seksjoner
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAddInstructionSection}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              + Legg til seksjon
            </button>
          )}
        </div>

        {usingSectionedInstructions ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionStepDragEnd}>
            <div className="space-y-4">
              {formData.instructionSections.map((section, sIdx) => {
                const globalStepOffset = formData.instructionSections
                  .slice(0, sIdx)
                  .reduce((acc, s) => acc + s.steps.length, 0);
                return (
                  <div key={sIdx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={section.heading}
                        onChange={(e) => handleInstructionSectionHeading(sIdx, e.target.value)}
                        placeholder="Seksjonstittel (f.eks. Forberedelser, Steking)"
                        className="flex-1 px-3 py-1.5 text-sm font-semibold border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveInstructionSection(sIdx)}
                        className="px-2 py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Fjern seksjon
                      </button>
                    </div>
                    <div className="space-y-2 pl-1">
                      <SortableContext items={sectionStepIds[sIdx] ?? []} strategy={verticalListSortingStrategy}>
                        <DroppableSection id={`step-section-${sIdx}`}>
                          {section.steps.map((step, stIdx) => (
                            <SortableInstruction
                              key={(sectionStepIds[sIdx] ?? [])[stIdx] ?? stIdx}
                              id={(sectionStepIds[sIdx] ?? [])[stIdx] ?? `sstep-${sIdx}-${stIdx}`}
                              index={globalStepOffset + stIdx}
                              step={step}
                              onChange={(_globalIdx, text) => handleSectionStepChange(sIdx, stIdx, text)}
                              onRemove={() => handleRemoveSectionStep(sIdx, stIdx)}
                              onInsertBelow={() => handleInsertSectionStepBelow(sIdx, stIdx)}
                            />
                          ))}
                        </DroppableSection>
                      </SortableContext>
                      <button
                        type="button"
                        onClick={() => handleAddSectionStep(sIdx)}
                        className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
                      >
                        + Steg
                      </button>
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={handleAddInstructionSection}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm"
              >
                + Ny seksjon
              </button>
            </div>
          </DndContext>
        ) : (
          <div className="space-y-2">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleInstructionDragEnd}>
              <SortableContext items={instructionIds} strategy={verticalListSortingStrategy}>
                {formData.instructionSteps.map((step, index) => (
                  <SortableInstruction
                    key={instructionIds[index]}
                    id={instructionIds[index]}
                    index={index}
                    step={step}
                    onChange={handleInstructionChange}
                    onRemove={handleRemoveInstruction}
                    onInsertBelow={handleInsertInstructionBelow}
                    onPhotoSelected={handleStepPhotoSelected}
                    onPhotoRemove={handleStepPhotoRemove}
                  />
                ))}
              </SortableContext>
            </DndContext>
            <button
              type="button"
              onClick={handleAddInstruction}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              + Legg til steg
            </button>
          </div>
        )}
      </div>

      {/* Tips */}
      <div>
        <label className="block text-sm font-medium mb-2">Tips fra kokken</label>
        <div className="space-y-2">
          {(formData.tips ?? []).map((tip, index) => (
            <div key={index} className="flex gap-2 items-start">
              <textarea
                value={tip}
                onChange={(e) => {
                  const newTips = [...(formData.tips ?? [])];
                  newTips[index] = e.target.value;
                  handleField('tips', newTips);
                }}
                placeholder="Skriv et tips..."
                rows={2}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 resize-none"
              />
              <button
                type="button"
                onClick={() => handleField('tips', (formData.tips ?? []).filter((_, i) => i !== index))}
                className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => handleField('tips', [...(formData.tips ?? []), ''])}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            + Legg til tips
          </button>
        </div>
      </div>

      {/* Categories */}
      {availableCategories.length > 0 && (() => {
        const groups = Array.from(new Set(availableCategories.map((c) => c.group)));
        const selectedIds = formData.categoryIds ?? [];
        return (
          <div>
            <label className="block text-sm font-medium mb-2">Kategorier</label>
            <div className="space-y-3">
              {groups.map((group) => (
                <div key={group}>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{group}</p>
                  <div className="flex flex-wrap gap-2">
                    {availableCategories.filter((c) => c.group === group).map((cat) => {
                      const active = selectedIds.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleToggleCategory(cat.id)}
                          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                            active
                              ? 'bg-blue-500 text-white border-blue-500'
                              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                          }`}
                        >
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        <button
          onClick={handleSubmit}
          disabled={isSaving}
          className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
        >
          {isSaving ? 'Lagrer...' : submitLabel}
        </button>
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="sm:px-6 py-3 bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          Avbryt
        </button>
      </div>
    </div>
  );
}
