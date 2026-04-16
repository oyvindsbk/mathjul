"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/context/AuthContext";
import { groupsService, type GroupOption } from "@/lib/services/groups.service";

export default function GroupsPage() {
  const { token, isLoading: authLoading } = useAuth();
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    groupsService
      .getMyGroups(token ?? undefined)
      .then(setGroups)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Kunne ikke laste grupper"))
      .finally(() => setLoading(false));
  }, [token, authLoading]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const group = await groupsService.createGroup(newGroupName.trim(), token ?? undefined);
      setGroups((prev) => [...prev, group]);
      setNewGroupName("");
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Kunne ikke opprette gruppe");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen p-8 sm:p-12">
      <main className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Grupper</h1>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← Tilbake
          </Link>
        </div>

        {/* Create group form */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Opprett ny gruppe</h2>
          <form onSubmit={handleCreate} className="flex gap-3">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Gruppenavn"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
              disabled={isCreating}
            />
            <button
              type="submit"
              disabled={isCreating || !newGroupName.trim()}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? "Oppretter…" : "Opprett"}
            </button>
          </form>
          {createError && (
            <p className="mt-2 text-sm text-red-600">{createError}</p>
          )}
        </div>

        {/* Group list */}
        {loading ? (
          <p className="text-gray-500">Laster grupper…</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : groups.length === 0 ? (
          <p className="text-gray-500">Du er ikke med i noen grupper ennå.</p>
        ) : (
          <ul className="space-y-3">
            {groups.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/groups/${g.id}`}
                  className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:border-emerald-400 transition-colors"
                >
                  <div>
                    <p className="font-medium">{g.name}</p>
                    <p className="text-sm text-gray-500">{g.memberCount} medlemmer</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
