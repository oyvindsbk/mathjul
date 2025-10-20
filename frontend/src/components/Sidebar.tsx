"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <aside className="w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-white min-h-screen shadow-lg">
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-2">Matoppskrifter</h1>
        <p className="text-sm text-slate-300">Oppskrift Utforsker</p>
      </div>

      <nav className="mt-8 space-y-2 px-4">
        <Link
          href="/"
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
          className={`block px-4 py-3 rounded-lg transition-colors duration-200 ${
            isActive("/spin")
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
              <path
                fillRule="evenodd"
                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 1111.601 2.566V5a1 1 0 11-2 0v-.101a5 5 0 00-9.053-3.595A1 1 0 014 2zm9 1a1 1 0 100 2 1 1 0 000-2z"
                clipRule="evenodd"
              />
            </svg>
            <span>Snurr mathjulet</span>
          </div>
        </Link>
      </nav>
    </aside>
  );
}
