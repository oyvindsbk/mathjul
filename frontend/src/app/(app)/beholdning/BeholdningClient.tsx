"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/context/AuthContext";
import { groupsService, type GroupOption } from "@/lib/services/groups.service";
import { StockTab } from "@/components/beholdning/StockTab";
import { ShoppingListTab } from "@/components/beholdning/ShoppingListTab";
import { SuggestionsTab } from "@/components/beholdning/SuggestionsTab";

type TabId = "beholdning" | "handleliste" | "forslag";

const TABS: { id: TabId; label: string }[] = [
  { id: "beholdning", label: "Beholdning" },
  { id: "handleliste", label: "Handleliste" },
  { id: "forslag", label: "Forslag" },
];

export function BeholdningClient() {
  const { token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(() => {
    const param = searchParams.get("groupId");
    return param ? Number(param) : null;
  });
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tabParam = searchParams.get("tab");
  const activeTab: TabId = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : "beholdning";

  useEffect(() => {
    if (authLoading || !token) return;
    groupsService
      .getMyGroups(token)
      .then((gs) => {
        setGroups(gs);
        setSelectedGroupId((current) => current ?? gs[0]?.id ?? null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Kunne ikke laste grupper"))
      .finally(() => setLoadingGroups(false));
  }, [authLoading, token]);

  const updateParams = useCallback(
    (changes: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(changes).forEach(([key, value]) => params.set(key, value));
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const handleGroupChange = (id: number) => {
    setSelectedGroupId(id);
    updateParams({ groupId: String(id) });
  };

  const handleError = useCallback((message: string) => setError(message), []);

  if (authLoading || loadingGroups) {
    return <div className="p-8 text-gray-500">Laster …</div>;
  }

  if (groups.length === 0) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Beholdning</h1>
        <p className="text-gray-600">
          Du er ikke med i noen grupper ennå.{" "}
          <Link href="/grupper" className="text-blue-600 hover:underline">Opprett eller bli med i en gruppe</Link>{" "}
          for å holde oversikt over hva dere har hjemme.
        </p>
      </div>
    );
  }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-8 px-3 sm:px-6 lg:px-8">
      <div className="w-full max-w-3xl mx-auto">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Beholdning</h1>
            {selectedGroup && <p className="text-gray-500 text-sm mt-1">Gruppe: {selectedGroup.name}</p>}
          </div>
          {groups.length > 1 && (
            <div className="flex items-center gap-2">
              <label htmlFor="group-select" className="text-sm text-gray-600 font-medium">Gruppe:</label>
              <select
                id="group-select"
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

        <div role="tablist" className="flex gap-1 border-b border-gray-200 mb-4 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              data-testid={`tab-${tab.id}`}
              onClick={() => updateParams({ tab: tab.id })}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Lukk" className="ml-2 text-red-500 hover:text-red-700">×</button>
          </div>
        )}

        {token && selectedGroupId && activeTab === "beholdning" && (
          <StockTab key={selectedGroupId} groupId={selectedGroupId} token={token} onError={handleError} />
        )}
        {token && selectedGroupId && activeTab === "handleliste" && (
          <ShoppingListTab key={selectedGroupId} groupId={selectedGroupId} token={token} onError={handleError} />
        )}
        {token && selectedGroupId && activeTab === "forslag" && (
          <SuggestionsTab key={selectedGroupId} groupId={selectedGroupId} token={token} onError={handleError} />
        )}
      </div>
    </div>
  );
}
