"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/context/AuthContext";

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
  { href: "/grupper", label: "Grupper", testId: "nav-groups" },
  { href: "/spin-the-wheel", label: "Spin the Wheel", testId: "nav-spin" },
  { href: "/last-opp-oppskrift", label: "Last opp oppskrift", testId: "nav-upload" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isAuthenticated, token, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

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
      <div className="flex items-stretch h-16">
        {/* Logo */}
        <Link
          href="/"
          data-testid="sidebar-title"
          className="flex items-center px-6 gap-2 hover:bg-slate-800 transition-colors duration-200 shrink-0"
        >
          <span className="text-xl font-bold tracking-wide text-white">Matoppskrifter</span>
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-stretch flex-1 px-4">
          {mainNavLinks.map(({ href, label, testId }) => (
            <Link
              key={href}
              href={href}
              data-testid={testId}
              className={`flex items-center px-4 text-sm font-medium border-b-2 transition-colors duration-200 ${
                isActive(href)
                  ? "border-blue-400 text-blue-400"
                  : "border-transparent text-slate-300 hover:text-white hover:border-slate-500"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right icons */}
        <div className="flex items-stretch ml-auto">
          {/* Feature Planner icon — desktop only */}
          <Link
            href="/feature-planner"
            data-testid="nav-feature-planner"
            title="Feature Planner"
            className={`hidden md:flex items-center px-5 border-b-2 transition-colors duration-200 ${
              isActive("/feature-planner")
                ? "border-blue-400 text-blue-400"
                : "border-transparent text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </Link>

          {/* User menu */}
          {isAuthenticated && token && (
            <div className="relative flex items-stretch">
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                title={email ?? "Bruker"}
                className="flex items-center gap-2 px-5 border-b-2 border-transparent text-slate-300 hover:text-white hover:bg-slate-800 transition-colors duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="hidden lg:block text-sm max-w-[140px] truncate">{email ?? "Bruker"}</span>
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-0 w-48 bg-slate-800 border border-slate-700 rounded-b-lg shadow-xl z-20 overflow-hidden">
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
