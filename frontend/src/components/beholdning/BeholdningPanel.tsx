"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StockTab } from "./StockTab";
import { ShoppingListTab } from "./ShoppingListTab";
import { SuggestionsTab } from "./SuggestionsTab";

type TabId = "beholdning" | "handleliste" | "forslag";

const TABS: { id: TabId; label: string }[] = [
  { id: "beholdning", label: "Beholdning" },
  { id: "handleliste", label: "Handleliste" },
  { id: "forslag", label: "Forslag" },
];

interface Props {
  groupId: number;
  token: string;
}

/** Stock, shopping list and suggestions for one group. The active tab lives in `?tab=`. */
export function BeholdningPanel({ groupId, token }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const tabParam = searchParams.get("tab");
  const activeTab: TabId = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : "beholdning";

  const selectTab = (tab: TabId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const handleError = useCallback((message: string) => setError(message), []);

  return (
    <div className="w-full max-w-3xl mx-auto" data-testid="beholdning-panel">
      <div role="tablist" className="flex gap-1 border-b border-gray-200 mb-4 overflow-x-auto overflow-y-hidden">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            data-testid={`tab-${tab.id}`}
            onClick={() => selectTab(tab.id)}
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
        <div
          role="alert"
          className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between"
        >
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Lukk" className="ml-2 text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {activeTab === "beholdning" && <StockTab key={groupId} groupId={groupId} token={token} onError={handleError} />}
      {activeTab === "handleliste" && (
        <ShoppingListTab key={groupId} groupId={groupId} token={token} onError={handleError} />
      )}
      {activeTab === "forslag" && <SuggestionsTab key={groupId} groupId={groupId} token={token} onError={handleError} />}
    </div>
  );
}
