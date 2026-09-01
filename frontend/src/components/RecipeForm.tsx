'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { TILBEHOR_CATEGORY_ID, type Category, type IngredientSection, type InstructionSection, type InstructionStep, type Recipe, type StructuredIngredient } from '@/lib/mock-data';
import { findMentionTrigger, indexIngredients, resolveStepSegments } from '@/lib/instruction-mentions';
import { MentionPicker, filterIngredients, handlePickerKey, optionId } from '@/components/MentionPicker';
import { PAN_PRESETS, findPreset, groupedPresets, presetVolume, type PanPreset } from '@/lib/pan-size';
import { StepText } from '@/components/StepText';
import { useMentions } from '@/hooks/useMentions';
import { parseQuantityInput, toFractionString } from '@/lib/fraction';

interface RecipeFormProps {
  initialData: RecipeFormData;
  onSave: (data: RecipeFormData) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  submitLabel?: string;
  availableCategories?: Category[];
  /** Tilbehør-marked recipes available to attach. Omit to hide the side-dish picker. */
  availableSideDishes?: Recipe[];
  /** Id of the recipe being edited, so it cannot be attached to itself. */
  currentRecipeId?: number;
  /** Called when user selects a photo for a step. Return the URL to display (blob: or remote). */
  onStepPhotoSelected?: (index: number, file: File) => Promise<string | null>;
  /** Called when user removes a step photo. */
  onStepPhotoRemove?: (index: number) => Promise<void>;
}

// Drag handle icon
/**
 * A client-side ingredient id, so a row can be mentioned before it is ever
 * saved. The server preserves ids it receives verbatim, so this one survives
 * the round-trip and the mention stays bound.
 */
function newIngredientId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Give every ingredient in the form data an id, preserving the ones it has. */
function withIngredientIds(data: RecipeFormData): RecipeFormData {
  const fill = (i: StructuredIngredient): StructuredIngredient =>
    i.id ? i : { ...i, id: newIngredientId() };
  return {
    ...data,
    ingredients: data.ingredients.map(fill),
    ingredientSections: data.ingredientSections.map((s) => ({
      ...s,
      ingredients: s.ingredients.map(fill),
    })),
  };
}

/**
 * Render a stored quantity for the input field. Fractions round-trip as
 * fractions, so a quantity entered as "1/4" is not shown back as 0.25.
 */
function formatQuantityInput(quantity: number | null | undefined): string {
  if (quantity == null) return '';
  return toFractionString(quantity) ?? quantity.toString();
}

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
  /** Reports whether this row's quantity text is unparseable, so save can be blocked. */
  onQuantityValidityChange: (id: string, invalid: boolean) => void;
}

function SortableIngredient({ id, index, ingredient, onChange, onRemove, onQuantityValidityChange }: SortableIngredientProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  // The quantity field holds raw text so fractions can be typed: "1/4" passes
  // through "1" and "1/" on the way, and parsing each keystroke would rewrite
  // the field under the user. Parsing happens on blur instead.
  const [quantityText, setQuantityText] = useState(() => formatQuantityInput(ingredient.quantity));
  const [quantityFocused, setQuantityFocused] = useState(false);
  const quantityInvalid = quantityText.trim() !== '' && parseQuantityInput(quantityText) === null;

  // Follow external changes to the quantity (scaling, undo, a loaded recipe).
  // Skipped while the field is focused, and while the text is unparseable —
  // otherwise the sync would erase what the user typed and hide the error,
  // since an invalid edit deliberately leaves the stored quantity untouched.
  useEffect(() => {
    if (quantityFocused || quantityInvalid) return;
    setQuantityText(formatQuantityInput(ingredient.quantity));
  }, [ingredient.quantity, quantityFocused, quantityInvalid]);

  useEffect(() => {
    onQuantityValidityChange(id, quantityInvalid);
  }, [id, quantityInvalid, onQuantityValidityChange]);

  // Clear this row's invalid flag when it unmounts, so a removed row cannot
  // block saving forever.
  useEffect(() => {
    return () => onQuantityValidityChange(id, false);
  }, [id, onQuantityValidityChange]);

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
          type="text"
          inputMode="decimal"
          value={quantityText}
          onChange={(e) => {
            const raw = e.target.value;
            setQuantityText(raw);
            // Commit only parseable input; partial text like "1/" leaves the
            // stored quantity alone until blur resolves it.
            const parsed = parseQuantityInput(raw);
            if (raw.trim() === '') {
              onChange(index, { ...ingredient, quantity: null });
            } else if (parsed !== null) {
              onChange(index, { ...ingredient, quantity: parsed });
            }
          }}
          onFocus={() => setQuantityFocused(true)}
          onBlur={() => {
            setQuantityFocused(false);
            const parsed = parseQuantityInput(quantityText);
            if (parsed !== null) setQuantityText(formatQuantityInput(parsed));
          }}
          placeholder="Antall"
          aria-invalid={quantityInvalid}
          aria-label="Mengde"
          title={quantityInvalid ? 'Ugyldig mengde. Bruk tall eller brøk, f.eks. 1/4 eller 1 1/2.' : undefined}
          className={`w-16 sm:w-20 px-2 sm:px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-sm ${
            quantityInvalid
              ? 'border-red-500 dark:border-red-500 text-red-600 dark:text-red-400'
              : 'border-gray-300 dark:border-gray-700'
          }`}
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
          data-testid={`remove-ingredient-${index}`}
          onClick={() => onRemove(index)}
          aria-label={`Fjern ${ingredient.name.trim() || 'ingrediens'}`}
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
  onChange: (index: number, updated: InstructionStep) => void;
  onRemove: (index: number) => void;
  onInsertBelow: (index: number) => void;
  onPhotoSelected?: (index: number, file: File) => Promise<void>;
  onPhotoRemove?: (index: number) => Promise<void>;
  /** Every mentionable ingredient of the recipe, flat and sectioned. */
  mentionableIngredients: StructuredIngredient[];
  /** Section heading per ingredient id, for ingredients that belong to a section. */
  mentionSectionById: Map<string, string>;
  /** The same ingredients keyed by id. Built once by the parent rather than per step. */
  previewIngredients: Map<string, StructuredIngredient>;
  /** Base servings, so the preview shows the amount a reader would see. */
  baseServings?: number | null;
}

function SortableInstruction({ id, index, step, onChange, onRemove, onInsertBelow, onPhotoSelected, onPhotoRemove, mentionableIngredients, mentionSectionById, previewIngredients, baseServings }: SortableInstructionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const photoInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<File | null>(null);

  // The open `@` trigger, or null when the picker is closed.
  const [trigger, setTrigger] = useState<{ start: number; query: string } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  // Set after an insertion so the caret can be restored once React has painted
  // the new value — assigning it before that would be overwritten.
  const pendingCaret = useRef<number | null>(null);

  const { slots, insert, remove, toggleDisplay, syncText } = useMentions(step);
  const listboxId = `mention-listbox-${id}`;
  const options = trigger ? filterIngredients(mentionableIngredients, trigger.query) : [];

  useEffect(() => {
    if (pendingCaret.current === null) return;
    const caret = pendingCaret.current;
    pendingCaret.current = null;
    const field = textareaRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(caret, caret);
  }, [step.text]);

  /** Re-read the trigger after anything that can move the caret. */
  const refreshTrigger = (value: string, caret: number | null) => {
    const next = caret === null ? null : findMentionTrigger(value, caret);
    setTrigger(next);
    setActiveIndex(0);
  };

  const handleTextChange = (value: string, caret: number | null) => {
    // Route through the hook so a token the author deleted by hand takes its
    // mention with it.
    onChange(index, syncText(value));
    refreshTrigger(value, caret);
  };

  const acceptOption = (optionIdx: number) => {
    const ingredient = options[optionIdx];
    if (!ingredient || !trigger) return;
    const caret = textareaRef.current?.selectionStart ?? trigger.start;
    const result = insert(ingredient, trigger.start, caret);
    if (!result) return;
    onChange(index, result.step);
    pendingCaret.current = result.caret;
    setTrigger(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!trigger) return;
    const consumed = handlePickerKey(e.key, options.length, activeIndex, {
      onActiveIndexChange: setActiveIndex,
      onAccept: acceptOption,
      onDismiss: () => setTrigger(null),
    });
    if (consumed) e.preventDefault();
  };

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
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={step.text}
            onChange={(e) => handleTextChange(e.target.value, e.target.selectionStart)}
            onKeyDown={handleKeyDown}
            // Clicking or arrowing elsewhere can leave or enter a trigger.
            onSelect={(e) => refreshTrigger(e.currentTarget.value, e.currentTarget.selectionStart)}
            onBlur={() => setTrigger(null)}
            role="combobox"
            aria-expanded={trigger !== null}
            aria-controls={trigger ? listboxId : undefined}
            aria-activedescendant={
              trigger && options.length > 0 ? optionId(listboxId, activeIndex) : undefined
            }
            aria-autocomplete="list"
            data-testid={`instruction-text-${index}`}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            rows={2}
          />
          {trigger && (
            <MentionPicker
              id={listboxId}
              ingredients={mentionableIngredients}
              sectionById={mentionSectionById}
              query={trigger.query}
              activeIndex={activeIndex}
              onActiveIndexChange={setActiveIndex}
              onSelect={(ingredient) => {
                const at = options.findIndex((o) => o.id === ingredient.id);
                if (at >= 0) acceptOption(at);
              }}
              baseServings={baseServings}
              desiredServings={baseServings ?? 1}
            />
          )}
        </div>

        {/* A textarea cannot style its own content, so the resolved sentence is
            shown beneath it — otherwise the author only ever sees `@[0]`. */}
        {slots.length > 0 && (
          <p
            className="text-sm text-gray-600 dark:text-gray-400 px-1"
            data-testid={`instruction-preview-${index}`}
          >
            <StepText
              segments={resolveStepSegments(
                step,
                previewIngredients,
                baseServings,
                baseServings ?? 1,
              )}
            />
          </p>
        )}

        {slots.length > 0 && (
          <div className="flex flex-wrap gap-1.5" data-testid={`mention-chips-${index}`}>
            {slots.map(({ index: slot, mention }) => {
              const name =
                previewIngredients.get(mention.ingredientId)?.name ?? mention.fallbackName;
              return (
                <span
                  key={slot}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-xs text-blue-800 dark:text-blue-200"
                >
                  <span>{name}</span>
                  <button
                    type="button"
                    onClick={() => onChange(index, toggleDisplay(slot))}
                    title={
                      mention.display === 'full'
                        ? 'Vis bare navnet'
                        : 'Vis mengde og navn'
                    }
                    aria-label={`${name}: ${mention.display === 'full' ? 'vis bare navnet' : 'vis mengde og navn'}`}
                    className="rounded px-1 text-[10px] font-semibold uppercase tracking-wide hover:bg-blue-100 dark:hover:bg-blue-800"
                  >
                    {mention.display === 'full' ? 'mengde' : 'navn'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(index, remove(slot))}
                    aria-label={`Fjern ${name} fra trinnet`}
                    className="rounded px-1 hover:bg-blue-100 dark:hover:bg-blue-800"
                  >
                    ✕
                  </button>
                </span>
              );
            })}
          </div>
        )}
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
  availableSideDishes = [],
  currentRecipeId,
  onStepPhotoSelected,
  onStepPhotoRemove,
}: RecipeFormProps) {
  // Ingredients arriving without an id cannot be mentioned. The server backfills
  // ids on read, but a recipe can still reach the form without them (mock data,
  // or a draft that has never been saved), so the form mints its own rather than
  // showing an empty picker. Ids the server did send are kept verbatim — that is
  // what keeps existing mentions bound.
  const [formData, setFormData] = useState<RecipeFormData>(() => withIngredientIds(initialData));

  // Derived from the stored shape and dimensions rather than held in state, so
  // the highlighted chip can never disagree with what a save would post.
  const selectedPanPreset = findPreset(formData.panShape, {
    diameter: formData.panDiameter,
    length: formData.panLength,
    width: formData.panWidth,
  });

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

  // Every ingredient the author can mention, flat and sectioned, in list order.
  const mentionableIngredients: StructuredIngredient[] = [
    ...formData.ingredients,
    ...formData.ingredientSections.flatMap((s) => s.ingredients),
  ];

  // Section heading per ingredient id, so the picker can show "<section> - <ingredient>"
  // for ingredients that belong to a section.
  const mentionSectionById = new Map<string, string>();
  formData.ingredientSections.forEach((section) => {
    section.ingredients.forEach((ingredient) => {
      if (ingredient.id) mentionSectionById.set(ingredient.id, section.heading);
    });
  });

  // Keyed once here rather than rebuilt inside every step row.
  const previewIngredients = indexIngredients({
    ingredients: mentionableIngredients,
    ingredientSections: undefined,
  });

  /**
   * Step numbers mentioning `ingredientId`, for the warning shown before a
   * removal. The removal is still allowed — this only tells the author what it
   * will cost, since those mentions fall back to their stored name.
   */
  const stepsMentioning = (ingredientId: string | null | undefined): number[] => {
    if (!ingredientId) return [];
    const all = formData.instructionSections.length > 0
      ? formData.instructionSections.flatMap((s) => s.steps)
      : formData.instructionSteps;
    return all
      .map((step, i) => (step.mentions?.some((m) => m.ingredientId === ingredientId) ? i + 1 : 0))
      .filter((n) => n > 0);
  };

  /** Ask before dropping an ingredient some step still points at. */
  const confirmIngredientRemoval = (ingredient: StructuredIngredient): boolean => {
    const steps = stepsMentioning(ingredient.id);
    if (steps.length === 0) return true;
    const list = steps.join(', ');
    const label = ingredient.name.trim() || 'Ingrediensen';
    return window.confirm(
      `${label} er nevnt i trinn ${list}. Fjerner du den, viser trinnene navnet uten mengde. Fjerne likevel?`
    );
  };

  const handleField = (field: keyof RecipeFormData, value: RecipeFormData[typeof field]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  /**
   * Switch the quantity type, keeping the fields that only apply to one type
   * from surviving into another.
   *
   * Written as a single update rather than several `handleField` calls: each of
   * those reads `prev` separately, and clearing a stale pan while setting a new
   * type has to be one transition or the intermediate state can post a "form"
   * recipe with no tin — which the API rejects.
   */
  const handleQuantityType = (type: 'porsjoner' | 'antall' | 'custom' | 'form') => {
    setFormData((prev) => ({
      ...prev,
      quantityType: type,
      customUnit: type === 'custom' ? prev.customUnit : null,
      // Servings means portions for every type but "form", where it means the
      // tin's volume. Carrying the number across either boundary is nonsense in
      // both directions: 4 portions would claim a 4 cm³ tin, and a 2941 cm³ tin
      // would claim 2941 portions. Only a switch between two portion-counted
      // types keeps the value.
      servings:
        type === 'form' || prev.quantityType === 'form' ? null : prev.servings,
      ...(type === 'form'
        ? {}
        : { panShape: null, panDiameter: null, panLength: null, panWidth: null, panHeight: null }),
    }));
  };

  /**
   * Record the tin the recipe is authored for.
   *
   * Stores the preset's own dimensions alongside the volume, because the volume
   * is ambiguous on its own — a round Ø24 and a springform Ø24 are the same number
   * — and the detail page needs the shape to mark the original tin.
   */
  const handlePanPreset = (preset: PanPreset) => {
    setFormData((prev) => ({
      ...prev,
      quantityType: 'form',
      servings: Math.round(presetVolume(preset)),
      panShape: preset.shape,
      panDiameter: preset.diameter ?? null,
      panLength: preset.length ?? null,
      panWidth: preset.width ?? null,
      // Height is the user's own field, not the preset's — leave it alone.
      panHeight: prev.panHeight ?? null,
    }));
  };

  // Ingredients (flat)
  const handleIngredientChange = (index: number, updated: StructuredIngredient) => {
    const newIngredients = [...formData.ingredients];
    newIngredients[index] = updated;
    handleField('ingredients', newIngredients);
  };

  const handleRemoveIngredient = (index: number) => {
    if (!confirmIngredientRemoval(formData.ingredients[index])) return;
    handleField('ingredients', formData.ingredients.filter((_, i) => i !== index));
    setIngIds((ids) => ids.filter((_, i) => i !== index));
  };

  const handleAddIngredient = () => {
    handleField('ingredients', [...formData.ingredients, { id: newIngredientId(), quantity: null, unit: null, name: '' }]);
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
    const target = formData.ingredientSections[sIdx]?.ingredients[iIdx];
    if (target && !confirmIngredientRemoval(target)) return;
    const sections = formData.ingredientSections.map((s, si) =>
      si === sIdx ? { ...s, ingredients: s.ingredients.filter((_, ii) => ii !== iIdx) } : s
    );
    handleField('ingredientSections', sections);
    setSectionIngIds((ids) => ids.map((arr, si) => si === sIdx ? arr.filter((_, ii) => ii !== iIdx) : arr));
  };

  const handleAddSectionIngredient = (sIdx: number) => {
    const sections = formData.ingredientSections.map((s, si) =>
      si === sIdx ? { ...s, ingredients: [...s.ingredients, { id: newIngredientId(), quantity: null, unit: null, name: '' }] } : s
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
  const handleInstructionChange = (index: number, updated: InstructionStep) => {
    const newSteps = [...formData.instructionSteps];
    newSteps[index] = updated;
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

  const handleSectionStepChange = (sIdx: number, stIdx: number, updated: InstructionStep) => {
    const sections = formData.instructionSections.map((s, si) =>
      si === sIdx ? { ...s, steps: s.steps.map((st, sti) => (sti === stIdx ? updated : st)) } : s
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

    // A tilbehør cannot itself have tilbehør, so marking it as such drops any selection.
    if (id === TILBEHOR_CATEGORY_ID && next.includes(TILBEHOR_CATEGORY_ID)) {
      setFormData((prev) => ({ ...prev, categoryIds: next, sideDishIds: [] }));
      return;
    }

    handleField('categoryIds', next);
  };

  const handleToggleSideDish = (id: number) => {
    const current = formData.sideDishIds ?? [];
    const next = current.includes(id) ? current.filter((s) => s !== id) : [...current, id];
    handleField('sideDishIds', next);
  };

  const handleMoveSideDish = (id: number, direction: -1 | 1) => {
    const current = [...(formData.sideDishIds ?? [])];
    const from = current.indexOf(id);
    const to = from + direction;
    if (from === -1 || to < 0 || to >= current.length) return;
    handleField('sideDishIds', arrayMove(current, from, to));
  };

  // Ingredient rows with unparseable quantity text, keyed by row id. Saving is
  // blocked while any remain, so a typo cannot silently store a null quantity.
  const [invalidQuantityIds, setInvalidQuantityIds] = useState<Set<string>>(new Set());
  const hasInvalidQuantity = invalidQuantityIds.size > 0;

  // A cake with no tin has no area to scale by, and the API rejects it outright.
  // Blocking here turns a round-trip 400 into an answer the user can act on.
  const missingPan = formData.quantityType === 'form' && !formData.panShape;

  const handleQuantityValidityChange = useCallback((id: string, invalid: boolean) => {
    setInvalidQuantityIds((prev) => {
      if (invalid === prev.has(id)) return prev;
      const next = new Set(prev);
      if (invalid) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  const handleSubmit = async () => {
    if (hasInvalidQuantity || missingPan) return;
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
          {(['porsjoner', 'antall', 'custom', 'form'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleQuantityType(type)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                (formData.quantityType ?? 'porsjoner') === type
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
              }`}
            >
              {type === 'porsjoner'
                ? 'Porsjoner'
                : type === 'antall'
                  ? 'Antall (stk)'
                  : type === 'custom'
                    ? 'Egendefinert'
                    : 'Kakeform'}
            </button>
          ))}
        </div>
        {formData.quantityType === 'form' ? (
          // A cake has no portion count to type — it has a tin. Picking one sets
          // both the dimensions and the area the scaling reads from `servings`.
          <div data-testid="form-picker">
            {/* A select rather than fourteen chips, matching FormVelger on the
                recipe page. This form cannot reuse that component: it needs the
                preset object to store the shape and dimensions, where the
                recipe page only ever needs the resulting area. */}
            <select
              aria-label="Bakeform"
              value={selectedPanPreset?.id ?? ''}
              onChange={(e) => {
                const preset = PAN_PRESETS.find((p) => p.id === e.target.value);
                if (preset) handlePanPreset(preset);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            >
              {!selectedPanPreset && <option value="">Velg form</option>}
              {groupedPresets().map((group) => (
                <optgroup key={group.shape} label={group.label}>
                  {group.presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            <div className="mt-3 flex items-center gap-2">
              <label className="text-sm text-gray-700 dark:text-gray-300" htmlFor="pan-height">
                Høyde (cm)
              </label>
              <input
                id="pan-height"
                type="number"
                step="any"
                min="0"
                placeholder="Valgfritt"
                value={formData.panHeight ?? ''}
                onChange={(e) =>
                  handleField('panHeight', e.target.value === '' ? null : parseFloat(e.target.value))
                }
                className="w-28 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
              />
            </div>

            {!formData.panShape && (
              <p className="mt-2 text-sm text-amber-700">Velg en bakeform for kakeoppskriften.</p>
            )}
          </div>
        ) : (
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
        )}
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
                            onQuantityValidityChange={handleQuantityValidityChange}
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
                    onQuantityValidityChange={handleQuantityValidityChange}
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
                              onChange={(_globalIdx, updated) => handleSectionStepChange(sIdx, stIdx, updated)}
                              onRemove={() => handleRemoveSectionStep(sIdx, stIdx)}
                              onInsertBelow={() => handleInsertSectionStepBelow(sIdx, stIdx)}
                              mentionableIngredients={mentionableIngredients}
                              mentionSectionById={mentionSectionById}
                              previewIngredients={previewIngredients}
                              baseServings={formData.servings}
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
                    mentionableIngredients={mentionableIngredients}
                    mentionSectionById={mentionSectionById}
                    previewIngredients={previewIngredients}
                    baseServings={formData.servings}
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

      {/* Tilbehør — hidden when this recipe is itself a tilbehør (one level only) */}
      {availableSideDishes.length > 0 && !(formData.categoryIds ?? []).includes(TILBEHOR_CATEGORY_ID) && (() => {
        const selectedIds = formData.sideDishIds ?? [];
        const selectable = availableSideDishes.filter((r) => r.id !== currentRecipeId);
        if (selectable.length === 0) return null;

        // Selected first, in the order they will be saved, so the ordering is visible.
        const selected = selectedIds
          .map((id) => selectable.find((r) => r.id === id))
          .filter((r): r is Recipe => r !== undefined);
        const unselected = selectable.filter((r) => !selectedIds.includes(r.id));

        return (
          <div data-testid="side-dish-picker">
            <label className="block text-sm font-medium mb-2">Tilbehør</label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Velg oppskrifter som serveres som tilbehør til denne retten.
            </p>

            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selected.map((recipe, index) => (
                  <span
                    key={recipe.id}
                    className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full text-sm border bg-blue-500 text-white border-blue-500"
                  >
                    {recipe.title}
                    <button
                      type="button"
                      onClick={() => handleMoveSideDish(recipe.id, -1)}
                      disabled={index === 0}
                      aria-label={`Flytt ${recipe.title} opp`}
                      className="px-1 leading-none disabled:opacity-30 hover:text-blue-100"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveSideDish(recipe.id, 1)}
                      disabled={index === selected.length - 1}
                      aria-label={`Flytt ${recipe.title} ned`}
                      className="px-1 leading-none disabled:opacity-30 hover:text-blue-100"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleSideDish(recipe.id)}
                      aria-label={`Fjern ${recipe.title}`}
                      className="px-1 leading-none hover:text-blue-100"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {unselected.map((recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  data-testid={`side-dish-option-${recipe.id}`}
                  onClick={() => handleToggleSideDish(recipe.id)}
                  className="px-3 py-1 rounded-full text-sm border transition-colors bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400"
                >
                  {recipe.title}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        {hasInvalidQuantity && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400 self-center">
            Rett opp ugyldig mengde før du lagrer.
          </p>
        )}
        <button
          onClick={handleSubmit}
          disabled={isSaving || hasInvalidQuantity || missingPan}
          title={hasInvalidQuantity ? 'Rett opp ugyldig mengde før du lagrer.' : undefined}
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
