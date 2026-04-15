"use client";

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
  onDragOver: (e: React.DragEvent, date: Date) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, date: Date) => void;
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
  onDragOver,
  onDragLeave,
  onDrop,
}: DayCellProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = date < today;

  return (
    <div
      className={`
        relative min-h-[80px] border rounded-lg p-1.5 cursor-pointer group transition-colors duration-150
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
      <div className={`text-xs font-semibold mb-1 ${isToday ? "text-blue-700" : isPast ? "text-gray-400" : "text-gray-700"}`}>
        {date.getDate()}
      </div>

      {plans.length > 0 ? (
        <div className="flex flex-col gap-1">
          {plans.map((plan) => {
            const iconCategory =
              plan.recipe.mealTypeCategories?.find((c) => MEAL_TYPE_ICONS[c]) ??
              plan.recipe.mealTypeCategory ??
              null;
            const icon = iconCategory ? (MEAL_TYPE_ICONS[iconCategory] ?? "🍴") : "🍴";
            return (
              <div key={plan.id} className="relative group/entry flex items-start gap-1">
                <span className="text-[10px] flex-shrink-0 mt-0.5">{icon}</span>
                <p className={`text-xs font-medium leading-tight line-clamp-2 flex-1 ${isPast ? "text-gray-400" : "text-gray-800"}`}>
                  {plan.recipe.title}
                </p>
                <button
                  className="hidden group-hover/entry:flex items-center justify-center w-4 h-4 bg-red-100 hover:bg-red-200 text-red-600 rounded-full text-[10px] flex-shrink-0 transition-colors"
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
        <div className={`flex items-center justify-center h-10 transition-colors ${isPast ? "text-gray-200" : "text-gray-300 group-hover:text-blue-400"}`}>
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
