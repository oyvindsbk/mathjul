"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/context/AuthContext";
import { groupsService, type GroupOption } from "@/lib/services/groups.service";
import { mealPlanService, type MealPlan } from "@/lib/services/mealplan.service";
import { WeekCalendar } from "@/components/ukesplanlegger/WeekCalendar";
import { RecipePickerModal } from "@/components/ukesplanlegger/RecipePickerModal";
import type { Recipe } from "@/lib/mock-data";
import { formatDate } from "@/components/ukesplanlegger/DayCell";

export function UkesplanleggerClient() {
  const { token, isLoading: authLoading } = useAuth();

  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pickingDate, setPickingDate] = useState<Date | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const today = new Date();
  const [viewYear] = useState(today.getFullYear());
  const [viewMonth] = useState(today.getMonth());

  useEffect(() => {
    if (authLoading || !token) return;
    groupsService
      .getMyGroups(token)
      .then((gs) => {
        setGroups(gs);
        if (gs.length > 0) setSelectedGroupId(gs[0].id);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Kunne ikke laste grupper"))
      .finally(() => setLoadingGroups(false));
  }, [authLoading, token]);

  const fetchPlans = useCallback(async () => {
    if (!token || !selectedGroupId) return;
    setLoadingPlans(true);
    try {
      const from = formatDate(new Date(viewYear, viewMonth - 1, 1));
      const to = formatDate(new Date(viewYear, viewMonth + 2, 0));
      const data = await mealPlanService.getMealPlans(selectedGroupId, from, to, token);
      setPlans(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Kunne ikke laste ukesplan");
    } finally {
      setLoadingPlans(false);
    }
  }, [token, selectedGroupId, viewYear, viewMonth]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  async function handleRecipePicked(recipe: Recipe) {
    if (!pickingDate || !token || !selectedGroupId) return;
    const dateStr = formatDate(pickingDate);
    setPickingDate(null);

    try {
      const updated = await mealPlanService.setMealPlan(selectedGroupId, dateStr, recipe.id, token);
      setPlans((prev) => {
        const filtered = prev.filter((p) => p.date !== dateStr);
        return [...filtered, updated];
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Kunne ikke lagre middag");
    }
  }

  async function handleClearDay(date: Date) {
    if (!token || !selectedGroupId) return;
    const dateStr = formatDate(date);
    try {
      await mealPlanService.deleteMealPlan(selectedGroupId, dateStr, token);
      setPlans((prev) => prev.filter((p) => p.date !== dateStr));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Kunne ikke fjerne middag");
    }
  }

  async function handleAiPlan(weekStart: Date) {
    if (!token || !selectedGroupId) return;
    setAiLoading(true);
    setError(null);
    try {
      const newPlans = await mealPlanService.generateAiPlan(selectedGroupId, formatDate(weekStart), token);
      setPlans((prev) => {
        const generatedDates = new Set(newPlans.map((p) => p.date));
        const filtered = prev.filter((p) => !generatedDates.has(p.date));
        return [...filtered, ...newPlans];
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Kunne ikke generere ukesplan");
    } finally {
      setAiLoading(false);
    }
  }

  if (authLoading || loadingGroups) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">Laster...</div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-600 mb-4">Du er ikke med i noen grupper.</p>
        <p className="text-gray-500 text-sm">Opprett eller bli med i en gruppe for å bruke ukesplanleggeren.</p>
        <Link
          href="/groups"
          className="inline-block mt-4 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          Gå til grupper
        </Link>
      </div>
    );
  }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ukesplanlegger</h1>
            <p className="text-gray-500 text-sm mt-1">
              Planlegg middager for uken. Høyreklikk på ukenummeret for å planlegge en hel uke.
            </p>
          </div>

          {groups.length > 1 && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 font-medium">Gruppe:</label>
              <select
                value={selectedGroupId ?? ""}
                onChange={(e) => setSelectedGroupId(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          {groups.length === 1 && selectedGroup && (
            <div className="text-sm text-gray-600">
              Gruppe: <span className="font-medium">{selectedGroup.name}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">×</button>
          </div>
        )}

        {aiLoading && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Genererer ukesplan...
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {loadingPlans ? (
            <div className="flex items-center justify-center py-16 text-gray-400">Laster plan...</div>
          ) : (
            <WeekCalendar
              plans={plans}
              onDayClick={setPickingDate}
              onClearDay={handleClearDay}
              onAiPlan={handleAiPlan}
              highlightedDays={new Set()}
            />
          )}
        </div>
      </div>

      {pickingDate && token && (
        <RecipePickerModal
          token={token}
          onSelect={handleRecipePicked}
          onClose={() => setPickingDate(null)}
        />
      )}
    </div>
  );
}
