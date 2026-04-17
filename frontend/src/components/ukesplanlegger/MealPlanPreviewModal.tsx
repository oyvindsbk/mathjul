"use client";

import { LEVERANDOR_COLORS, LEVERANDOR_LABELS, type Leverandor } from "@/lib/services/matkasse.service";
import type { MealPlan } from "@/lib/services/mealplan.service";

interface Props {
  plan: MealPlan;
  onClose: () => void;
}

export function MealPlanPreviewModal({ plan, onClose }: Props) {
  const isMatkasse = plan.matkasseRecipe != null;
  const title = isMatkasse ? plan.matkasseRecipe!.tittel : (plan.recipe?.title ?? "");
  const description = isMatkasse ? plan.matkasseRecipe!.beskrivelse : null;
  const imageUrl = isMatkasse ? plan.matkasseRecipe!.imageUrl : plan.recipe?.imageUrl;
  const leverandor = isMatkasse ? (plan.matkasseRecipe!.leverandor as Leverandor) : null;
  const colors = leverandor ? (LEVERANDOR_COLORS[leverandor] ?? { bg: "bg-gray-100", text: "text-gray-800", border: "border-gray-200" }) : null;
  const leverandorLabel = leverandor ? (LEVERANDOR_LABELS[leverandor] ?? leverandor) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {imageUrl && (
          <div className="aspect-video w-full overflow-hidden">
            <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              {leverandorLabel && colors && (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium mb-2 ${colors.bg} ${colors.text} ${colors.border} border`}>
                  {leverandorLabel}
                </span>
              )}
              <h2 className="text-base font-semibold text-gray-900 leading-snug">{title}</h2>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              aria-label="Lukk"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {description && (
            <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
          )}
          {!description && !imageUrl && (
            <p className="text-sm text-gray-400 italic">Ingen beskrivelse tilgjengelig.</p>
          )}
        </div>
      </div>
    </div>
  );
}
