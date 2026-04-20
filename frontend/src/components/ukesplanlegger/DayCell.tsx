"use client";

import { useRef } from "react";
import type { MealPlan } from "@/lib/services/mealplan.service";
import { MEAL_TYPE_ICONS } from "./MealTypeFilter";

interface DayCellProps {
  date: Date;
  plans: MealPlan[];
  isToday: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  isDragOver: boolean;
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
      className={`
        relative min-h-[80px] lg:min-h-[110px] xl:min-h-[130px] border rounded-lg p-1.5 lg:p-2 cursor-pointer group transition-colors duration-150 flex flex-col
        ${isToday
          ? "bg-blue-50 border-blue-400 shadow-sm"
          : isPast
            ? "bg-gray-50 border-gray-100 opacity-50"
            : isDragOver
              ? "bg-green-50 border-green-400"
              : isSelected
                ? "bg-blue-50 border-blue-500"
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
        <div className={`text-xs lg:text-sm font-semibold ${isToday ? "text-blue-700" : isPast ? "text-gray-400" : "text-gray-700"}`}>
          {date.getDate()}
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
                ? "🥡"
                : (iconCategory ? (MEAL_TYPE_ICONS[iconCategory] ?? "🍴") : "🍴");
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
                      ? "flex flex-col items-center justify-center flex-1 gap-1 rounded-md bg-amber-50 border border-amber-200 px-1 py-2 text-center"
                      : "flex items-start gap-1"
                    : single
                      ? "flex flex-col items-center justify-center flex-1 gap-1 rounded-md bg-blue-50 border border-blue-100 px-1 py-2 text-center"
                      : "flex items-start gap-1"
                }`}
              >
                <span className={single ? "text-xl leading-none" : "text-[10px] flex-shrink-0 mt-0.5"}>{icon}</span>
                <p className={`font-medium leading-tight flex-1 ${isPast ? "text-gray-400" : isCustom ? "text-amber-800" : "text-gray-800"} ${single ? "text-xs line-clamp-3" : "text-[10px] line-clamp-2"}`}>
                  {title}
                </p>
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
        <div className={`flex items-center justify-center h-10 lg:h-16 xl:h-20 transition-colors ${isPast ? "text-gray-200" : "text-gray-300 group-hover:text-blue-400"}`}>
          {isDragOver ? (
            <span className="text-green-400 text-lg">+</span>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
          )}
        </div>
      )}
    </div>
  );
}

export { formatDate };
