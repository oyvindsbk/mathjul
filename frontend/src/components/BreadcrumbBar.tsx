"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { recipeService } from "@/lib/services/recipe.service";
import { useAuth } from "@/lib/context/AuthContext";

const LIST_PAGES: Record<string, string> = {
  "/alle-oppskrifter": "Alle oppskrifter",
  "/profil": "Min side",
  "/ukesplanlegger": "Ukesplanlegger",
  "/grupper": "Grupper",
  "/snurr-mathjulet": "Snurr mathjulet",
  "/last-opp-oppskrift": "Last opp oppskrift",
  "/feature-planner": "Feature Planner",
};

interface CrumbItem {
  label: string;
  href?: string;
}

function getRecipeIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/recipes\/([^/]+)/);
  return match ? match[1] : null;
}

function buildCrumbs(
  pathname: string,
  recipeTitle: string | null,
  parentContext: { href: string; label: string } | null
): CrumbItem[] | null {
  if (pathname === "/") return null;

  const recipeId = getRecipeIdFromPath(pathname);

  if (recipeId) {
    const parent = parentContext ?? { href: "/alle-oppskrifter", label: "Alle oppskrifter" };
    const recipeLabel = recipeTitle ?? "Oppskrift";
    const isEdit = pathname.endsWith("/edit");

    const crumbs: CrumbItem[] = [
      { label: "Hjem", href: "/" },
      { label: parent.label, href: parent.href },
    ];

    if (isEdit) {
      crumbs.push({ label: recipeLabel, href: `/recipes/${recipeId}` });
      crumbs.push({ label: "Rediger" });
    } else {
      crumbs.push({ label: recipeLabel });
    }

    return crumbs;
  }

  // Group detail: /grupper/[id]
  if (/^\/grupper\/[^/]+$/.test(pathname)) {
    return [
      { label: "Hjem", href: "/" },
      { label: "Grupper", href: "/grupper" },
      { label: "Gruppe" },
    ];
  }

  // Edit profile: /profil/rediger — a child of Min side, not another user.
  if (pathname === "/profil/rediger") {
    return [
      { label: "Hjem", href: "/" },
      { label: "Min side", href: "/profil" },
      { label: "Rediger profil" },
    ];
  }

  // Another user's profile: /profil/[userId]
  if (/^\/profil\/[^/]+$/.test(pathname)) {
    return [
      { label: "Hjem", href: "/" },
      { label: "Profil" },
    ];
  }

  // Known list pages
  const known = LIST_PAGES[pathname];
  if (known) {
    return [{ label: "Hjem", href: "/" }, { label: known }];
  }

  return [{ label: "Hjem", href: "/" }];
}

export function BreadcrumbBar() {
  const pathname = usePathname();
  const { token } = useAuth();
  const [recipeTitle, setRecipeTitle] = useState<string | null>(null);
  const [parentContext, setParentContext] = useState<{ href: string; label: string } | null>(null);

  // Track list-page visits so recipe pages can show the right parent crumb
  useEffect(() => {
    if (LIST_PAGES[pathname]) {
      sessionStorage.setItem(
        "lastListPage",
        JSON.stringify({ href: pathname, label: LIST_PAGES[pathname] })
      );
    }
  }, [pathname]);

  // Load parent context from sessionStorage on recipe routes
  useEffect(() => {
    const recipeId = getRecipeIdFromPath(pathname);
    if (recipeId) {
      const stored = sessionStorage.getItem("lastListPage");
      if (stored) {
        try {
          setParentContext(JSON.parse(stored) as { href: string; label: string });
        } catch {
          setParentContext(null);
        }
      } else {
        setParentContext(null);
      }
    } else {
      setParentContext(null);
    }
  }, [pathname]);

  // Fetch recipe title when on a recipe route
  useEffect(() => {
    const recipeId = getRecipeIdFromPath(pathname);
    if (!recipeId) {
      setRecipeTitle(null);
      return;
    }

    setRecipeTitle(null);
    recipeService
      .getRecipeById(recipeId, token ?? undefined)
      .then((recipe) => setRecipeTitle(recipe?.title ?? null))
      .catch(() => setRecipeTitle(null));
  }, [pathname, token]);

  const crumbs = buildCrumbs(pathname, recipeTitle, parentContext);
  if (!crumbs) return null;

  return (
    <div className="hidden md:block sticky top-16 z-40 w-full bg-white border-b border-gray-200 shadow-sm">
      <nav
        aria-label="Breadcrumb"
        className="max-w-7xl mx-auto px-6 py-2 flex items-center gap-1.5 text-sm text-gray-500"
      >
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <span key={index} className="flex items-center gap-1.5">
              {index > 0 && (
                <svg
                  className="w-3.5 h-3.5 text-gray-400 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              )}
              {isLast || !crumb.href ? (
                <span className={isLast ? "text-gray-900 font-medium" : ""}>
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="hover:text-gray-700 transition-colors"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>
    </div>
  );
}
