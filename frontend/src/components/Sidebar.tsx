"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <aside className="w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-white min-h-screen shadow-lg">
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-2" data-testid="sidebar-title">Matoppskrifter</h1>
      </div>

      <nav className="mt-8 space-y-2 px-4">
        <Link
          href="/"
          data-testid="nav-home"
          className={`block px-4 py-3 rounded-lg transition-colors duration-200 ${
            isActive("/")
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-700"
          }`}
        >
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            <span>Hjem</span>
          </div>
        </Link>

        <Link
          href="/spin"
          data-testid="nav-spin"
          className={`block px-4 py-3 rounded-lg transition-colors duration-200 ${
            isActive("/spin")
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-700"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">🎡</span>
            <span>Spin the Wheel</span>
          </div>
        </Link>

        <Link
          href="/upload"
          data-testid="nav-upload"
          className={`block px-4 py-3 rounded-lg transition-colors duration-200 ${
            isActive("/upload")
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-700"
          }`}
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Last opp oppskrift</span>
          </div>
        </Link>

        <Link
          href="/groups"
          data-testid="nav-groups"
          className={`block px-4 py-3 rounded-lg transition-colors duration-200 ${
            pathname.startsWith("/groups")
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-700"
          }`}
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Grupper</span>
          </div>
        </Link>

      </nav>
    </aside>
  );
}
