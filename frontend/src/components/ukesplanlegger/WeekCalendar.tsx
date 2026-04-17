"use client";

import { useState } from "react";
import type { MealPlan } from "@/lib/services/mealplan.service";
import { DayCell, formatDate } from "./DayCell";
import { WeekContextMenu } from "./WeekContextMenu";

const DAY_NAMES = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
const MONTH_NAMES = [
  "Januar", "Februar", "Mars", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Desember",
];

interface ContextMenuState {
  x: number;
  y: number;
  weekStart: Date;
}

interface WeekCalendarProps {
  plans: MealPlan[];
  selectedDate: Date | null;
  onDayClick: (date: Date) => void;
  onDeleteEntry: (entryId: number) => void;
  onEntryClick?: (plan: MealPlan) => void;
  onAiPlan: (weekStart: Date) => void;
  onDrop: (date: Date, recipeId: number) => void;
  onDropMatkasse: (date: Date, matkasseRecipeId: number) => void;
  onMoveEntry: (planId: number, date: Date) => void;
  highlightedDays: Set<string>;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeeksInMonth(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const start = getMonday(firstDay);
  const weeks: Date[][] = [];

  const current = new Date(start);
  while (current <= lastDay || weeks.length === 0) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
    if (current > lastDay && weeks.length > 0) break;
  }

  return weeks;
}

export function WeekCalendar({
  plans,
  selectedDate,
  onDayClick,
  onDeleteEntry,
  onEntryClick,
  onAiPlan,
  onDrop,
  onDropMatkasse,
  onMoveEntry,
  highlightedDays,
}: WeekCalendarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Group plans by date — show all entries regardless of active filter
  const plansByDate = new Map<string, MealPlan[]>();
  for (const plan of plans) {
    const existing = plansByDate.get(plan.date) ?? [];
    plansByDate.set(plan.date, [...existing, plan]);
  }

  const selectedDateKey = selectedDate ? formatDate(selectedDate) : null;

  const weeks = getWeeksInMonth(viewYear, viewMonth);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function handleWeekContextMenu(e: React.MouseEvent, weekStart: Date) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, weekStart });
  }

  function handleDragOver(e: React.DragEvent, date: Date) {
    e.preventDefault();
    setDragOverDate(formatDate(date));
  }

  function handleDrop(e: React.DragEvent, date: Date) {
    e.preventDefault();
    setDragOverDate(null);
    const movePlanId = parseInt(e.dataTransfer.getData("movePlanId"), 10);
    if (!isNaN(movePlanId)) {
      onMoveEntry(movePlanId, date);
      return;
    }
    const matkasseRecipeId = parseInt(e.dataTransfer.getData("matkasseRecipeId"), 10);
    if (!isNaN(matkasseRecipeId)) {
      onDropMatkasse(date, matkasseRecipeId);
      return;
    }
    const recipeId = parseInt(e.dataTransfer.getData("recipeId"), 10);
    if (!isNaN(recipeId)) {
      onDrop(date, recipeId);
    }
  }

  return (
    <div className="select-none">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
          aria-label="Forrige måned"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-xl xl:text-2xl font-semibold text-gray-900">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </h2>
        <button
          onClick={nextMonth}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
          aria-label="Neste måned"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-1 mb-1">
        <div className="w-8" />
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-gray-500 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {weeks.map((week, wi) => {
        const weekStart = getMonday(week[0]);
        const weekNumber = getISOWeekNumber(weekStart);

        return (
          <div
            key={wi}
            className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-1 mb-1 group/row"
            onContextMenu={(e) => handleWeekContextMenu(e, weekStart)}
          >
            {/* Week number */}
            <div className="w-8 flex items-center justify-center">
              <span
                className="text-xs text-gray-400 group-hover/row:text-blue-500 cursor-context-menu font-medium"
                title="Høyreklikk for ukemeny"
              >
                {weekNumber}
              </span>
            </div>

            {week.map((day) => {
              const key = formatDate(day);
              const isCurrentMonth = day.getMonth() === viewMonth;
              const isToday = day.getTime() === today.getTime();

              if (!isCurrentMonth) {
                return <div key={key} className="min-h-[80px] lg:min-h-[110px] xl:min-h-[130px] bg-gray-50 rounded-lg border border-dashed border-gray-100" />;
              }

              return (
                <DayCell
                  key={key}
                  date={day}
                  plans={plansByDate.get(key) ?? []}
                  isToday={isToday}
                  isSelected={selectedDateKey === key}
                  isHighlighted={highlightedDays.has(key)}
                  isDragOver={dragOverDate === key}
                  onClick={onDayClick}
                  onDeleteEntry={onDeleteEntry}
                  onEntryClick={onEntryClick}
                  onDragOver={handleDragOver}
                  onDragLeave={() => setDragOverDate(null)}
                  onDrop={handleDrop}
                />
              );
            })}
          </div>
        );
      })}

      {contextMenu && (
        <WeekContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          weekStart={contextMenu.weekStart}
          onAiPlan={onAiPlan}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
