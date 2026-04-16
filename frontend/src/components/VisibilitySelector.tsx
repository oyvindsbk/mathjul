"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { groupsService, type GroupOption } from "@/lib/services/groups.service";
import { useAuth } from "@/lib/context/AuthContext";

export type Visibility = "Public" | "Private" | "Group";

interface Props {
  value: Visibility;
  groupIds: number[];
  onChange: (value: Visibility, groupIds: number[]) => void;
}

export default function VisibilitySelector({ value, groupIds, onChange }: Props) {
  const { token } = useAuth();
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (value !== "Group") return;
    setLoading(true);
    groupsService
      .getMyGroups(token ?? undefined)
      .then(setGroups)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [value, token]);

  const handleVisibilityChange = (next: Visibility) => {
    onChange(next, next === "Group" ? groupIds : []);
  };

  const toggleGroup = (id: number) => {
    const updated = groupIds.includes(id)
      ? groupIds.filter((g) => g !== id)
      : [...groupIds, id];
    onChange(value, updated);
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Synlighet
      </label>
      <div className="flex gap-3">
        {(["Public", "Private", "Group"] as Visibility[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => handleVisibilityChange(v)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              value === v
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
            }`}
          >
            {v === "Public" && "🌍 Offentlig"}
            {v === "Private" && "🔒 Privat"}
            {v === "Group" && "👥 Gruppe"}
          </button>
        ))}
      </div>

      {value === "Group" && (
        <div className="rounded-lg border border-gray-200 p-3">
          {loading ? (
            <p className="text-sm text-gray-500">Laster grupper…</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-gray-500">
              Ingen grupper funnet.{" "}
              <Link href="/grupper" className="text-emerald-600 underline">
                Opprett en gruppe
              </Link>
              .
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Velg hvilke grupper som kan se oppskriften:</p>
              {groups.map((g) => (
                <label key={g.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={groupIds.includes(g.id)}
                    onChange={() => toggleGroup(g.id)}
                    className="rounded border-gray-300 text-emerald-600"
                  />
                  <span>{g.name}</span>
                  <span className="text-xs text-gray-400">({g.memberCount} medlemmer)</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
