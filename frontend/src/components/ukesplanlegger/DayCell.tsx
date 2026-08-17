"use client";

import { useRef } from "react";
import type { MealPlan } from "@/lib/services/mealplan.service";
import { resolveEntryDisplay } from "./entryDisplay";

// A mobile day column is ~43px wide. 64px was enough when a cell held one
// truncated line, but two chips at two lines each need the extra height —
// below this a title clamps to a single letter.
const CELL_HEIGHT = "min-h-[88px] lg:min-h-[110px] xl:min-h-[130px]";

const SHORT_MONTH_NAMES = [
  "jan", "feb", "mar", "apr", "mai", "jun",
  "jul", "aug", "sep", "okt", "nov", "des",
];

// A ~43px mobile column fits two chips before the cell stops being readable;
// lg+ has the height for three. The cap is applied in CSS rather than JS —
// a viewport check would need matchMedia, which does not exist during SSR and
// would hydrate as a mismatch. Anything past the cap collapses into "+N", and
// the day modal lists them all regardless.
const VISIBLE_CHIPS_MOBILE = 2;
const VISIBLE_CHIPS_DESKTOP = 3;

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
  onEntryClick?: (plan: MealPlan) => void;
  onDragOver: (e: React.DragEvent, date: Date) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, date: Date) => void;
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
  onEntryClick,
  onDragOver,
  onDragLeave,
  onDrop,
}: DayCellProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = date < today;
  const draggingRef = useRef(false);

  // Both caps are computed; CSS decides which set of chips and which "+N" is shown.
  // When a breakpoint overflows, one chip is given up so "+N" has a row of its own.
  const visibleMobile = plans.length > VISIBLE_CHIPS_MOBILE ? VISIBLE_CHIPS_MOBILE - 1 : plans.length;
  const visibleDesktop = plans.length > VISIBLE_CHIPS_DESKTOP ? VISIBLE_CHIPS_DESKTOP - 1 : plans.length;
  const hiddenMobile = plans.length - visibleMobile;
  const hiddenDesktop = plans.length - visibleDesktop;
  // The large centred card only makes sense when it is the day's only content
  // at both breakpoints.
  const single = plans.length === 1;

  return (
    <div
      data-testid="day-cell"
      className={`
        relative ${CELL_HEIGHT} overflow-hidden border rounded-lg p-1 lg:p-2 cursor-pointer group transition-colors duration-150 flex flex-col
        ${isToday
          ? "bg-blue-50 border-blue-400 shadow-sm"
          : isPast
            // Muted via colour, not opacity: the per-element text colours are
            // already dimmed, and opacity on top of them left past days unreadable.
            ? "bg-gray-50 border-gray-200"
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
      </div>

      {plans.length > 0 ? (
        <div className="flex flex-col gap-0.5 lg:gap-1 flex-1 min-h-0">
          {plans.slice(0, visibleDesktop).map((plan, i) => {
            const { title, icon, matkasseLogo, sideDishTitles, isCustom } = resolveEntryDisplay(plan);
            // Chips past the mobile cap exist in the DOM but only show from lg up.
            const desktopOnly = i >= visibleMobile;
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
                className={`cursor-grab active:cursor-grabbing active:opacity-50 rounded border ${
                  desktopOnly ? "hidden lg:flex" : "flex"
                } ${
                  isCustom ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-100"
                } ${
                  single
                    ? "flex-col items-center justify-center flex-1 gap-1 px-0.5 py-1 lg:px-1 lg:py-2 text-center"
                    : "items-start gap-1 px-1 py-0.5"
                }`}
              >
                {/* Stacked chips drop the emoji below lg: a ~43px column has no room
                    for both a glyph and a readable title. The matkasse logo stays —
                    it is the only thing identifying the provider. */}
                {matkasseLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={matkasseLogo}
                    alt={plan.matkasseRecipe!.leverandor}
                    draggable={false}
                    className={single ? "w-6 h-6 lg:w-8 lg:h-8 object-contain rounded" : "w-3 h-3 lg:w-4 lg:h-4 object-contain rounded flex-shrink-0 mt-0.5"}
                  />
                ) : (
                  <span className={single ? "text-base lg:text-xl leading-none" : "hidden lg:block text-[10px] flex-shrink-0 mt-0.5"}>{icon}</span>
                )}
                {/* min-w-0 + break-words: long single words (e.g. "gyroskjøttdeig")
                    are wider than a ~43px mobile column, and line-clamp only limits
                    line count — without these they render past the cell edge. */}
                <div className={single ? "w-full min-w-0" : "flex-1 min-w-0"}>
                  <p className={`font-medium leading-tight break-words hyphens-auto ${isPast ? "text-gray-500" : isCustom ? "text-amber-800" : "text-gray-800"} ${single ? "text-[11px] line-clamp-2 lg:text-xs lg:line-clamp-3" : "text-[10px] line-clamp-2"}`}>
                    {title}
                  </p>
                  {sideDishTitles.length > 0 && (
                    <p className={`leading-tight break-words hyphens-auto ${isPast ? "text-gray-300" : "text-gray-500"} ${single ? "text-[10px] line-clamp-2" : "text-[9px] line-clamp-1"}`}>
                      + {sideDishTitles.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          {/* Two variants rather than one computed count: the number itself differs
              per breakpoint, and CSS cannot recompute it. */}
          {hiddenMobile > 0 && (
            <span
              data-testid="day-cell-overflow"
              className={`lg:hidden text-[9px] font-medium leading-tight px-1 ${isPast ? "text-gray-300" : "text-gray-500"}`}
            >
              +{hiddenMobile} til
            </span>
          )}
          {hiddenDesktop > 0 && (
            <span
              data-testid="day-cell-overflow"
              className={`hidden lg:block text-[10px] font-medium leading-tight px-1 ${isPast ? "text-gray-300" : "text-gray-500"}`}
            >
              +{hiddenDesktop} til
            </span>
          )}
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
