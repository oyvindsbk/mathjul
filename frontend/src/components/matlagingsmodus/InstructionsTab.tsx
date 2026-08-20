"use client";

import type { InstructionSection, InstructionStep, StructuredIngredient } from "@/lib/mock-data";
import { resolveStepSegments, stepPlainText } from "@/lib/instruction-mentions";
import { normalizeInstructions } from "@/lib/recipe-sections";
import { StepText } from "@/components/StepText";
import { CheckCircle } from "./CheckCircle";

interface InstructionsTabProps {
  instructionSteps?: InstructionStep[];
  instructionSections?: InstructionSection[];
  checkedSteps: Set<number>;
  onToggleStep: (stepNumber: number) => void;
  /** Every mentionable ingredient of the recipe, keyed by id. */
  ingredientsById: Map<string, StructuredIngredient>;
  /** The recipe's own serving count — the base the mention amounts scale from. */
  baseServings?: number | null;
  /** Servings the cook has dialled in, so steps and the ingredients tab agree. */
  desiredServings: number;
}

export function InstructionsTab({
  instructionSteps,
  instructionSections,
  checkedSteps,
  onToggleStep,
  ingredientsById,
  baseServings,
  desiredServings,
}: InstructionsTabProps) {
  const sections = normalizeInstructions(instructionSteps, instructionSections);

  if (sections.length === 0) {
    return <p className="text-gray-500 px-1 py-4">Ingen instruksjoner tilgjengelig</p>;
  }

  return (
    <div className="space-y-6">
      {sections.map((section, sIdx) => (
        <div key={sIdx}>
          {section.heading && (
            <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b border-gray-200 pb-1">
              {section.heading}
            </h3>
          )}
          <ol className="space-y-3">
            {section.items.map(({ step, number }) => {
              const checked = checkedSteps.has(number);
              const segments = resolveStepSegments(step, ingredientsById, baseServings, desiredServings);
              return (
                <li key={number}>
                  <button
                    type="button"
                    onClick={() => onToggleStep(number)}
                    aria-pressed={checked}
                    aria-label={`Trinn ${number}: ${stepPlainText(step, ingredientsById, baseServings, desiredServings)}`}
                    className="w-full flex items-start gap-3 text-left rounded-lg border border-gray-200 bg-white px-4 py-3 min-h-[44px] hover:border-gray-300 active:bg-gray-50 transition-colors"
                  >
                    <span className="mt-0.5">
                      <CheckCircle checked={checked} />
                    </span>
                    <span className="flex-1">
                      {/* Unlike the detail page this does not truncate — at the
                          stove the whole step needs to stay readable. */}
                      <span
                        className={`block text-base leading-relaxed ${
                          checked ? "line-through text-gray-400" : "text-gray-700"
                        }`}
                      >
                        <span className={`font-semibold ${checked ? "text-gray-400" : "text-gray-900"}`}>
                          {number}.
                        </span>{" "}
                        <StepText segments={segments} />
                      </span>
                      {!checked && step.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={step.imageUrl}
                          alt={`Trinn ${number}`}
                          className="mt-3 rounded-lg max-h-48 object-cover border border-gray-200"
                        />
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
