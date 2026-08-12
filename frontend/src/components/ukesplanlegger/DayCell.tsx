"use client";

import { useRef } from "react";
import type { MealPlan } from "@/lib/services/mealplan.service";
import type { Leverandor } from "@/lib/services/matkasse.service";
import { MEAL_TYPE_ICONS } from "./MealTypeFilter";

// On mobile a day column is ~43px wide, so the cell is kept near-square.
const CELL_HEIGHT = "min-h-[64px] lg:min-h-[110px] xl:min-h-[130px]";

const SHORT_MONTH_NAMES = [
  "jan", "feb", "mar", "apr", "mai", "jun",
  "jul", "aug", "sep", "okt", "nov", "des",
];

const LEVERANDOR_LOGOS: Record<Leverandor, string> = {
  Hellofresh: "/icons/logo-hellofresh.png",
  Kokkeloren: "/icons/logo-kokkeloren.png",
  GodtLevert: "/icons/logo-godtlevert.png",
};

interface DayCellProps {
  date: Date;
  plans: MealPlan[];
  isToday: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  isDragOver: boolean;
  /** Day belongs to a neighbouring month but is shown to complete the week. */
  isOtherMonth?: boolean;
  onClick: (date: Date) => void;
  onDeleteEntry: (entryId: number) => void;
  onEntryClick?: (plan: MealPlan) => void;
  onDragOver: (e: React.DragEvent, date: Date) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, date: Date) => void;
  onAddCustomCard?: (date: Date) => void;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function DayCell({
  date,
  plans,
  isToday,
  isSelected,
  isHighlighted,
  isDragOver,
  isOtherMonth = false,
  onClick,
  onDeleteEntry,
  onEntryClick,
  onDragOver,
  onDragLeave,
  onDrop,
  onAddCustomCard,
}: DayCellProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = date < today;
  const draggingRef = useRef(false);

  return (
    <div
      data-testid="day-cell"
      className={`
        relative ${CELL_HEIGHT} overflow-hidden border rounded-lg p-1 lg:p-2 cursor-pointer group transition-colors duration-150 flex flex-col
        ${isToday
          ? "bg-blue-50 border-blue-400 shadow-sm"
          : isPast
            ? "bg-gray-50 border-gray-100 opacity-50"
            : isDragOver
              ? "bg-green-50 border-green-400"
              : isSelected
                ? "bg-blue-50 border-blue-500"
                : isOtherMonth
                  ? "bg-gray-50/70 border-gray-200 border-dashed hover:bg-blue-50 hover:border-blue-200 hover:border-solid"
                  : "bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-200"}
        ${isSelected && !isToday ? "ring-2 ring-blue-500" : ""}
        ${isHighlighted ? "ring-2 ring-blue-400" : ""}
      `}
      onClick={() => onClick(date)}
      onDragOver={(e) => onDragOver(e, date)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, date)}
      title={plans.length > 0 ? `Legg til / endre` : "Legg til middag"}
    >
      <div className="flex items-center justify-between mb-1">
        <div className={`text-xs lg:text-sm font-semibold ${isToday ? "text-blue-700" : isPast ? "text-gray-400" : isOtherMonth ? "text-gray-400" : "text-gray-700"}`}>
          {date.getDate()}
          {/* Name the month on overflow days so "1" next to "31" isn't ambiguous. */}
          {isOtherMonth && (
            <span className="ml-0.5 font-normal text-[9px] lg:text-[10px]">
              {SHORT_MONTH_NAMES[date.getMonth()]}
            </span>
          )}
        </div>
        {!isPast && onAddCustomCard && (
          <button
            className="hidden group-hover:flex items-center justify-center w-4 h-4 rounded text-gray-400 hover:text-blue-500 transition-colors text-[10px] leading-none"
            onClick={(e) => {
              e.stopPropagation();
              onAddCustomCard(date);
            }}
            title="Legg til egendefinert kort"
            aria-label="Legg til egendefinert kort"
          >
            ✏️
          </button>
        )}
      </div>

      {plans.length > 0 ? (
        <div className="flex flex-col gap-1 flex-1">
          {plans.map((plan) => {
            const isCustom = plan.isCustom;
            const isMatkasse = plan.matkasseRecipe != null;
            const title = isCustom
              ? (plan.customTitle ?? "")
              : isMatkasse
                ? plan.matkasseRecipe!.tittel
                : (plan.recipe?.title ?? "");
            const iconCategory = isMatkasse
              ? null
              : (plan.recipe?.mealTypeCategories?.find((c) => MEAL_TYPE_ICONS[c]) ?? plan.recipe?.mealTypeCategory ?? null);
            const icon = isCustom
              ? "✏️"
              : isMatkasse
                ? null
                : (iconCategory ? (MEAL_TYPE_ICONS[iconCategory] ?? "🍴") : "🍴");
            const matkasseLogo = isMatkasse
              ? LEVERANDOR_LOGOS[plan.matkasseRecipe!.leverandor as Leverandor]
              : null;
            const sideDishTitles = isCustom || isMatkasse
              ? []
              : (plan.recipe?.sideDishTitles ?? []);
            const single = plans.length === 1;
            return (
              <div
                key={plan.id}
                draggable
                onDragStart={(e) => {
                  draggingRef.current = true;
                  e.stopPropagation();
                  e.dataTransfer.setData("movePlanId", String(plan.id));
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => { draggingRef.current = false; }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!draggingRef.current) onEntryClick?.(plan);
                }}
                className={`relative group/entry cursor-grab active:cursor-grabbing active:opacity-50 ${
                  isCustom
                    ? single
                      ? "flex flex-col items-center justify-center flex-1 gap-1 rounded-md bg-amber-50 border border-amber-200 px-0.5 py-1 lg:px-1 lg:py-2 text-center"
                      : "flex items-start gap-1"
                    : single
                      ? "flex flex-col items-center justify-center flex-1 gap-1 rounded-md bg-blue-50 border border-blue-100 px-0.5 py-1 lg:px-1 lg:py-2 text-center"
                      : "flex items-start gap-1"
                }`}
              >
                {matkasseLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={matkasseLogo}
                    alt={plan.matkasseRecipe!.leverandor}
                    draggable={false}
                    className={single ? "w-6 h-6 lg:w-8 lg:h-8 object-contain rounded" : "w-4 h-4 object-contain rounded flex-shrink-0 mt-0.5"}
                  />
                ) : (
                  <span className={single ? "text-base lg:text-xl leading-none" : "text-[10px] flex-shrink-0 mt-0.5"}>{icon}</span>
                )}
                {/* Title and side dishes share a wrapper so the delete button stays on the row */}
                {/* min-w-0 + break-words: long single words (e.g. "gyroskjøttdeig")
                    are wider than a ~43px mobile column, and line-clamp only limits
                    line count — without these they render past the cell edge. */}
                <div className={single ? "w-full min-w-0" : "flex-1 min-w-0"}>
                  <p className={`font-medium leading-tight break-words hyphens-auto ${isPast ? "text-gray-400" : isCustom ? "text-amber-800" : "text-gray-800"} ${single ? "text-[11px] line-clamp-2 lg:text-xs lg:line-clamp-3" : "text-[10px] line-clamp-2"}`}>
                    {title}
                  </p>
                  {sideDishTitles.length > 0 && (
                    <p className={`leading-tight break-words hyphens-auto ${isPast ? "text-gray-300" : "text-gray-500"} ${single ? "text-[10px] line-clamp-2" : "text-[9px] line-clamp-1"}`}>
                      + {sideDishTitles.join(", ")}
                    </p>
                  )}
                </div>
                <button
                  className={`hidden group-hover/entry:flex items-center justify-center w-4 h-4 bg-red-100 hover:bg-red-200 text-red-600 rounded-full text-[10px] flex-shrink-0 transition-colors ${single ? "absolute top-1 right-1" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteEntry(plan.id);
                  }}
                  title="Fjern"
                  aria-label="Fjern"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`flex items-center justify-center h-6 lg:h-16 xl:h-20 transition-colors ${isPast ? "text-gray-200" : "text-gray-300 group-hover:text-blue-400"}`}>
          {isDragOver ? (
            <span className="text-green-400 text-lg">+</span>
          ) : (
            <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
          )}
        </div>
      )}
    </div>
  );
}

export { formatDate };
