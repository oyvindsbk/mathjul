"use client";

import type { MealPlan } from "@/lib/services/mealplan.service";

interface DayCellProps {
  date: Date;
  plan: MealPlan | undefined;
  isToday: boolean;
  isHighlighted: boolean;
  onClick: (date: Date) => void;
  onClear: (date: Date) => void;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function DayCell({ date, plan, isToday, isHighlighted, onClick, onClear }: DayCellProps) {
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
            : "bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-200"}
        ${isHighlighted ? "ring-2 ring-blue-400" : ""}
      `}
      onClick={() => onClick(date)}
      title={plan ? `Endre: ${plan.recipe.title}` : "Legg til middag"}
    >
      <div className={`text-xs font-semibold mb-1 ${isToday ? "text-blue-700" : isPast ? "text-gray-400" : "text-gray-700"}`}>
        {date.getDate()}
      </div>

      {plan ? (
        <div className="flex flex-col gap-1">
          {plan.recipe.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={plan.recipe.imageUrl}
              alt={plan.recipe.title}
              className="w-full h-10 object-cover rounded"
            />
          )}
          <p className={`text-xs font-medium leading-tight line-clamp-2 ${isPast ? "text-gray-400" : "text-gray-800"}`}>
            {plan.recipe.title}
          </p>
          <button
            className="absolute top-1 right-1 hidden group-hover:flex items-center justify-center w-5 h-5 bg-red-100 hover:bg-red-200 text-red-600 rounded-full text-xs transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onClear(date);
            }}
            title="Fjern middag"
            aria-label="Fjern middag"
          >
            ×
          </button>
        </div>
      ) : (
        <div className={`flex items-center justify-center h-10 transition-colors ${isPast ? "text-gray-200" : "text-gray-300 group-hover:text-blue-400"}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
        </div>
      )}
    </div>
  );
}

export { formatDate };
