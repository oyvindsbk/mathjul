"use client";

import type { ReactNode } from "react";

interface ProfileHeaderProps {
  displayName: string;
  recipeCount: number;
  /** Omitted on other people's profiles — favourites are private. */
  favoriteCount?: number;
  /** Actions shown beside the name. Only your own profile passes any. */
  action?: ReactNode;
}

function plural(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Name and counts at the top of a profile page. */
export function ProfileHeader({
  displayName,
  recipeCount,
  favoriteCount,
  action,
}: ProfileHeaderProps) {
  const parts = [plural(recipeCount, "oppskrift", "oppskrifter")];
  if (favoriteCount !== undefined) {
    parts.push(plural(favoriteCount, "favoritt", "favoritter"));
  }

  return (
    <div className="mb-6 md:mb-8 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 break-words">{displayName}</h1>
        <p className="text-sm text-gray-500 mt-1">{parts.join(" · ")}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
