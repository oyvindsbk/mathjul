"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/context/AuthContext";
import { groupsService, type GroupOption } from "@/lib/services/groups.service";
import { mealPlanService, type MealPlan } from "@/lib/services/mealplan.service";
import { CustomCardModal } from "@/components/ukesplanlegger/CustomCardModal";
import { WeekCalendar } from "@/components/ukesplanlegger/WeekCalendar";
import { MealPlanPreviewModal } from "@/components/ukesplanlegger/MealPlanPreviewModal";
import { MealTypeFilter, type MealType } from "@/components/ukesplanlegger/MealTypeFilter";
import { RecipePickerPanel, RecipePickerSidebar } from "@/components/ukesplanlegger/RecipePickerPanel";
import { MatkassePanelSidebar } from "@/components/matkasse/MatkassePanelSidebar";
import type { MatkasseRecipe } from "@/lib/services/matkasse.service";
import type { Recipe } from "@/lib/mock-data";
import { formatDate } from "@/components/ukesplanlegger/DayCell";

function computeHighlightedDays(monday: Date | null): Set<string> {
  if (!monday) return new Set();
  const result = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    result.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return result;
}

export function UkesplanleggerClient() {
  const { token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [mealPlanEnabled, setMealPlanEnabled] = useState(true);
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const [viewYear] = useState(today.getFullYear());
  const [viewMonth] = useState(today.getMonth());

  const [activeDayDate, setActiveDayDate] = useState<Date | null>(today);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"oppskrifter" | "matkasse">("oppskrifter");
  const [aiLoading, setAiLoading] = useState(false);
  const [matkasseWeekMonday, setMatkasseWeekMonday] = useState<Date | null>(null);
  const [previewPlan, setPreviewPlan] = useState<MealPlan | null>(null);
  const [customCardDate, setCustomCardDate] = useState<Date | null>(null);

  // URL param: mealType
  const mealTypeParam = (searchParams.get("mealType") as MealType) ?? "Middag";
  const [activeMealType, setActiveMealType] = useState<MealType>(mealTypeParam);

  // Sync groupId URL param → state on mount
  useEffect(() => {
    const groupIdParam = searchParams.get("groupId");
    if (groupIdParam) {
      setSelectedGroupId(Number(groupIdParam));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load groups
  useEffect(() => {
    if (authLoading || !token) return;
    groupsService
      .getMyGroups(token)
      .then((gs) => {
        setGroups(gs);
        // Only auto-select if no groupId in URL
        const groupIdParam = searchParams.get("groupId");
        if (!groupIdParam && gs.length > 0) {
          setSelectedGroupId(gs[0].id);
        }
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Kunne ikke laste grupper"))
      .finally(() => setLoadingGroups(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, token]);

  // Fetch mealPlanEnabled when group changes
  useEffect(() => {
    if (!token || !selectedGroupId) return;
    groupsService.getGroup(selectedGroupId, token)
      .then((g) => setMealPlanEnabled(g.mealPlanEnabled))
      .catch(() => setMealPlanEnabled(true));
  }, [token, selectedGroupId]);

  // Sync selectedGroupId to URL
  const handleGroupChange = useCallback((id: number) => {
    setSelectedGroupId(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("groupId", String(id));
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  // Sync mealType to URL
  const handleMealTypeChange = useCallback((type: MealType) => {
    setActiveMealType(type);
    const params = new URLSearchParams(searchParams.toString());
    params.set("mealType", type);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

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
    if (!activeDayDate || !token || !selectedGroupId) return;
    const dateStr = formatDate(activeDayDate);

    try {
      const created = await mealPlanService.createMealPlan(selectedGroupId, dateStr, recipe.id, token);
      const hasCat = (created.recipe?.mealTypeCategories?.length ?? 0) > 0;
      const fallbackType = !hasCat && activeMealType !== "Alle" ? activeMealType : null;
      const withCategory: typeof created = hasCat || !fallbackType || !created.recipe
        ? created
        : {
            ...created,
            recipe: {
              ...created.recipe,
              mealTypeCategory: fallbackType,
              mealTypeCategories: [fallbackType],
            },
          };
      setPlans((prev) => [...prev, withCategory]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Kunne ikke lagre middag");
    }
  }

  async function handleDeleteEntry(entryId: number) {
    if (!token || !selectedGroupId) return;
    try {
      await mealPlanService.deleteMealPlan(selectedGroupId, entryId, token);
      setPlans((prev) => prev.filter((p) => p.id !== entryId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Kunne ikke fjerne middag");
    }
  }

  async function handleDrop(date: Date, recipeId: number) {
    if (!token || !selectedGroupId) return;
    const dateStr = formatDate(date);
    try {
      const created = await mealPlanService.createMealPlan(selectedGroupId, dateStr, recipeId, token);
      const hasCat = (created.recipe?.mealTypeCategories?.length ?? 0) > 0;
      const fallbackType = !hasCat && activeMealType !== "Alle" ? activeMealType : null;
      const withCategory: typeof created = hasCat || !fallbackType || !created.recipe
        ? created
        : {
            ...created,
            recipe: {
              ...created.recipe,
              mealTypeCategory: fallbackType,
              mealTypeCategories: [fallbackType],
            },
          };
      setPlans((prev) => [...prev, withCategory]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Kunne ikke legge til middag");
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

  async function handleMatkasseAdd(matkasseRecipe: MatkasseRecipe, date: Date) {
    if (!token || !selectedGroupId) return;
    const dateStr = formatDate(date);
    try {
      const created = await mealPlanService.createMealPlanMatkasse(selectedGroupId, dateStr, matkasseRecipe.id, token);
      setPlans((prev) => [...prev, created]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Kunne ikke legge til matkasseoppskrift");
    }
  }

  async function handleDropMatkasse(date: Date, matkasseRecipeId: number) {
    if (!token || !selectedGroupId) return;
    const dateStr = formatDate(date);
    try {
      const created = await mealPlanService.createMealPlanMatkasse(selectedGroupId, dateStr, matkasseRecipeId, token);
      setPlans((prev) => [...prev, created]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Kunne ikke legge til matkasseoppskrift");
    }
  }

  async function handleMoveEntry(planId: number, date: Date) {
    if (!token || !selectedGroupId) return;
    const existing = plans.find((p) => p.id === planId);
    if (!existing || formatDate(date) === existing.date) return;
    const dateStr = formatDate(date);
    try {
      await mealPlanService.deleteMealPlan(selectedGroupId, planId, token);
      let created: MealPlan;
      if (existing.matkasseRecipeId != null) {
        created = await mealPlanService.createMealPlanMatkasse(selectedGroupId, dateStr, existing.matkasseRecipeId, token);
      } else if (existing.recipeId != null) {
        created = await mealPlanService.createMealPlan(selectedGroupId, dateStr, existing.recipeId, token);
      } else if (existing.isCustom && existing.customTitle) {
        created = await mealPlanService.createCustomMealPlan(selectedGroupId, dateStr, existing.customTitle, existing.customNote, token);
      } else {
        return;
      }
      setPlans((prev) => [...prev.filter((p) => p.id !== planId), created]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Kunne ikke flytte middag");
    }
  }

  async function handleMatkasseAddToWeek(matkasseRecipes: MatkasseRecipe[], weekMonday: Date) {
    if (!token || !selectedGroupId) return;
    const count = matkasseRecipes.length;
    const days = count <= 3 ? 3 : 5;
    for (let i = 0; i < Math.min(count, days); i++) {
      const date = new Date(weekMonday);
      date.setDate(weekMonday.getDate() + i);
      await handleMatkasseAdd(matkasseRecipes[i], date);
    }
  }

  async function handleCustomCardConfirm(title: string, note: string | null) {
    if (!customCardDate || !token || !selectedGroupId) return;
    const dateStr = formatDate(customCardDate);
    setCustomCardDate(null);
    try {
      const created = await mealPlanService.createCustomMealPlan(selectedGroupId, dateStr, title, note, token);
      setPlans((prev) => [...prev, created]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Kunne ikke lagre kort");
    }
  }

  function handleDayClick(date: Date) {
    setActiveDayDate(date);
    setSidebarOpen(true);
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
          href="/grupper"
          className="inline-block mt-4 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          Gå til grupper
        </Link>
      </div>
    );
  }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
      <div className="w-full max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ukesplanlegger</h1>
            {selectedGroup && (
              <p className="text-gray-500 text-sm mt-1">
                Gruppe:{" "}
                <Link
                  href={`/grupper/${selectedGroup.id}`}
                  className="font-medium text-blue-600 hover:underline"
                >
                  {selectedGroup.name}
                </Link>
              </p>
            )}
          </div>

          {groups.length > 1 && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 font-medium">Gruppe:</label>
              <select
                value={selectedGroupId ?? ""}
                onChange={(e) => handleGroupChange(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
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

        {!mealPlanEnabled ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-gray-500 text-lg mb-2">Ukesplanleggeren er deaktivert for denne gruppen.</p>
            <p className="text-gray-400 text-sm">Gå til gruppeinnstillingene for å aktivere den.</p>
            {selectedGroup && (
              <Link
                href={`/grupper/${selectedGroup.id}`}
                className="inline-block mt-4 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Åpne gruppeinnstillinger
              </Link>
            )}
          </div>
        ) : (
          <div className="flex gap-6 items-start">
            {/* Calendar */}
            <div className="flex-1 min-w-0 bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6 xl:p-8">
              <MealTypeFilter value={activeMealType} onChange={handleMealTypeChange} />

              {loadingPlans ? (
                <div className="flex items-center justify-center py-16 text-gray-400">Laster plan...</div>
              ) : (
                <WeekCalendar
                  plans={plans}
                  selectedDate={activeDayDate}
                  onDayClick={handleDayClick}
                  onDeleteEntry={handleDeleteEntry}
                  onEntryClick={setPreviewPlan}
                  onAiPlan={handleAiPlan}
                  onDrop={handleDrop}
                  onDropMatkasse={handleDropMatkasse}
                  onMoveEntry={handleMoveEntry}
                  highlightedDays={computeHighlightedDays(sidebarTab === "matkasse" ? matkasseWeekMonday : null)}
                  onAddCustomCard={setCustomCardDate}
                />
              )}
            </div>

            {/* Desktop sidebar */}
            {sidebarOpen && token && selectedGroupId && (
              <div className="w-72 xl:w-80 shrink-0 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                {/* Sidebar tab bar */}
                <div className="flex border-b border-gray-200">
                  <button
                    onClick={() => setSidebarTab("oppskrifter")}
                    className={`flex-1 py-2.5 text-sm font-medium transition-colors ${sidebarTab === "oppskrifter" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    Oppskrifter
                  </button>
                  <button
                    onClick={() => setSidebarTab("matkasse")}
                    className={`flex-1 py-2.5 text-sm font-medium transition-colors ${sidebarTab === "matkasse" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    Matkasse
                  </button>
                  <button
                    onClick={() => { setSidebarOpen(false); setActiveDayDate(null); }}
                    className="px-3 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Lukk"
                  >
                    ×
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {sidebarTab === "oppskrifter" ? (
                    <RecipePickerSidebar
                      token={token}
                      activeMealType={activeMealType}
                      onSelect={async (recipe) => { await handleRecipePicked(recipe); }}
                      onClose={() => { setSidebarOpen(false); setActiveDayDate(null); }}
                      embedded
                    />
                  ) : (
                    <MatkassePanelSidebar
                      token={token}
                      groupId={selectedGroupId}
                      activeDayDate={activeDayDate}
                      onAddToWeek={handleMatkasseAddToWeek}
                      onWeekChange={setMatkasseWeekMonday}
                      usedRecipeIds={new Set(plans.flatMap((p) => p.matkasseRecipe != null ? [p.matkasseRecipe.id] : []))}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {previewPlan && (
        <MealPlanPreviewModal plan={previewPlan} onClose={() => setPreviewPlan(null)} />
      )}

      {customCardDate && (
        <CustomCardModal
          date={customCardDate}
          onConfirm={handleCustomCardConfirm}
          onClose={() => setCustomCardDate(null)}
        />
      )}

      {/* Mobile modal */}
      {sidebarOpen && token && (
        <RecipePickerPanel
          token={token}
          activeMealType={activeMealType}
          onSelect={async (recipe) => {
            await handleRecipePicked(recipe);
            setSidebarOpen(false);
            setActiveDayDate(null);
          }}
          onClose={() => { setSidebarOpen(false); setActiveDayDate(null); }}
        />
      )}
    </div>
  );
}
