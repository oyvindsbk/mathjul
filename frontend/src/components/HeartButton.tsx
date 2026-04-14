"use client";

import { useState } from "react";
import { likesService } from "@/lib/services/likes.service";

interface HeartButtonProps {
  recipeId: number;
  initialLiked: boolean;
  token: string | null;
  className?: string;
}

export function HeartButton({ recipeId, initialLiked, token, className = "" }: HeartButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [pending, setPending] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!token || pending) return;

    const next = !liked;
    setLiked(next);
    setPending(true);

    try {
      if (next) {
        await likesService.likeRecipe(recipeId, token);
      } else {
        await likesService.unlikeRecipe(recipeId, token);
      }
    } catch {
      setLiked(!next);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={!token || pending}
      aria-label={liked ? "Fjern fra favoritter" : "Legg til favoritter"}
      className={`flex items-center justify-center transition-transform duration-150 ${
        token ? "hover:scale-110 active:scale-95" : "opacity-40 cursor-default"
      } ${className}`}
    >
      <svg
        className={`w-6 h-6 transition-colors duration-150 ${
          liked ? "text-red-500 fill-red-500" : "text-gray-400 fill-none"
        }`}
        stroke="currentColor"
        strokeWidth={liked ? 0 : 1.8}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
        />
      </svg>
    </button>
  );
}
