"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/context/AuthContext";
import { recipeService } from "@/lib/services/recipe.service";
import type { Recipe } from "@/lib/mock-data";
import { recipeHref } from "@/lib/recipe-url";

function getEmailFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.email || payload.sub || null;
  } catch {
    return null;
  }
}

const mainNavLinks = [
  { href: "/alle-oppskrifter", label: "Alle oppskrifter", testId: "nav-alle-oppskrifter" },
  { href: "/profil", label: "Min side", testId: "nav-min-side" },
  { href: "/ukesplanlegger", label: "Ukesplanlegger", testId: "nav-ukesplanlegger" },
  { href: "/snurr-mathjulet", label: "Snurr mathjulet", testId: "nav-snurr" },
  { href: "/last-opp-oppskrift", label: "Last opp oppskrift", testId: "nav-upload" },
];

const RECIPES_PATH = "/alle-oppskrifter";

function HeaderSearchBox({
  className = "hidden md:flex",
  autoFocus = false,
}: {
  className?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const { token } = useAuth();
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<Recipe[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const requestIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce fetching suggestions as the user types
  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    const requestId = ++requestIdRef.current;
    const handle = setTimeout(() => {
      recipeService
        .getAllRecipes(token || undefined, undefined, undefined, query)
        .then((data) => {
          if (requestId !== requestIdRef.current) return;
          setSuggestions(data.slice(0, 8));
          setActiveIndex(-1);
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) return;
          setSuggestions([]);
          setActiveIndex(-1);
        });
    }, 300);
    return () => clearTimeout(handle);
  }, [value, token]);

  // Close the suggestions dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSuggestionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const goToRecipe = (recipe: Recipe) => {
    setSuggestionsOpen(false);
    setActiveIndex(-1);
    setValue("");
    router.push(recipeHref(recipe.id, recipe.title));
  };

  const confirmSearch = () => {
    const query = value.trim();
    if (!query) return;
    setSuggestionsOpen(false);
    setActiveIndex(-1);
    router.push(`${RECIPES_PATH}?q=${encodeURIComponent(query)}`);
  };

  const showSuggestions = suggestionsOpen && value.trim().length >= 2;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
        return;
      }
      if (e.key === "Escape") {
        setSuggestionsOpen(false);
        setActiveIndex(-1);
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        goToRecipe(suggestions[activeIndex]);
      } else {
        confirmSearch();
      }
    }
  };

  return (
    <div className={`${className} items-center relative w-full max-w-md`} ref={containerRef}>
      <svg
        className="absolute left-4 w-4 h-4 text-slate-400 pointer-events-none"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
      </svg>
      <input
        type="text"
        role="combobox"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setActiveIndex(-1);
        }}
        onFocus={() => setSuggestionsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Hva vil du lage i dag?"
        data-testid="header-search"
        autoFocus={autoFocus}
        className="w-full pl-10 pr-9 py-2.5 rounded-full bg-slate-800 border border-slate-700 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        aria-expanded={showSuggestions && suggestions.length > 0}
        aria-controls="header-search-suggestions"
        aria-autocomplete="list"
      />
      {value && (
        <button
          onClick={() => setValue("")}
          aria-label="Tøm søk"
          className="absolute right-3.5 text-slate-400 hover:text-white cursor-pointer"
        >
          ×
        </button>
      )}
      {showSuggestions && suggestions.length > 0 && (
        <ul
          id="header-search-suggestions"
          role="listbox"
          className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden text-gray-800"
        >
          {suggestions.map((recipe, index) => (
            <li
              key={recipe.id}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                goToRecipe(recipe);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`flex items-center gap-3 px-3 py-2 cursor-pointer text-sm ${
                index === activeIndex ? "bg-blue-50" : "hover:bg-gray-50"
              }`}
            >
              <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                {recipe.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={recipe.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              <span className="line-clamp-1">{recipe.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { isAuthenticated, token, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    logout();
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5238";
      await fetch(`${apiUrl}/api/auth/logout`, { method: "POST", credentials: "include" });
    } catch (error) {
      console.error("Failed to logout from backend:", error);
    }
  };

  const email = isAuthenticated && token ? getEmailFromToken(token) : null;

  return (
    <header className="sticky top-0 z-50 w-full bg-slate-900 text-white shadow-md">
      <div className="flex items-stretch h-16 max-w-7xl mx-auto px-6">
        {/* Logo */}
        <Link
          href="/"
          data-testid="sidebar-title"
          className={`items-center gap-2 pr-6 hover:opacity-80 transition-opacity duration-200 shrink-0 ${
            mobileSearchOpen ? "hidden md:flex" : "flex"
          }`}
        >
          <span className="text-xl font-bold tracking-wide text-white">Matoppskrifter</span>
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-1 shrink-0">
          {mainNavLinks.map(({ href, label, testId }) => (
            <Link
              key={href}
              href={href}
              data-testid={testId}
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                isActive(href)
                  ? "text-blue-400"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Search box — centered in the remaining space (desktop) */}
        <div className="flex flex-1 items-center justify-center px-4 min-w-0">
          <HeaderSearchBox />
          {/* Mobile search — replaces the row content when open */}
          {mobileSearchOpen && (
            <div className="flex md:hidden items-center gap-2 w-full">
              <HeaderSearchBox className="flex" autoFocus />
              <button
                onClick={() => setMobileSearchOpen(false)}
                aria-label="Lukk søk"
                data-testid="mobile-search-close"
                className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full text-slate-300 hover:text-white hover:bg-slate-800 transition-colors duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Right icons */}
        <div className={`items-center gap-1 pl-4 ${mobileSearchOpen ? "hidden md:flex" : "flex"}`}>
          {/* Mobile search toggle */}
          <button
            onClick={() => setMobileSearchOpen(true)}
            aria-label="Søk"
            data-testid="mobile-search-toggle"
            className="flex md:hidden items-center justify-center w-9 h-9 rounded-full text-slate-300 hover:text-white hover:bg-slate-800 transition-colors duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
          </button>

          {/* Feature Planner icon — desktop only */}
          <Link
            href="/feature-planner"
            data-testid="nav-feature-planner"
            title="Feature Planner"
            className={`hidden md:flex items-center justify-center w-9 h-9 rounded-full transition-colors duration-200 ${
              isActive("/feature-planner")
                ? "text-blue-400 bg-slate-800"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </Link>

          {/* User menu */}
          {isAuthenticated && token && (
            <div className="relative flex items-center">
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                title={email ?? "Bruker"}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-700">
                      <p className="text-xs text-slate-400 truncate">{email ?? "Bruker"}</p>
                    </div>
                    <Link
                      href="/profil"
                      onClick={() => setUserMenuOpen(false)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 transition-colors duration-200"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Min side
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-slate-700 transition-colors duration-200"
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logg ut
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
