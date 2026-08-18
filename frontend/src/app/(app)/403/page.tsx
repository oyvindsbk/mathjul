'use client';

import { useAuth } from '@/lib/context/AuthContext';
import Link from 'next/link';

export default function AccessDenied() {
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    window.location.href = '/.auth/logout';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
            <svg
              className="h-8 w-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Tilgang nektet
        </h1>

        <p className="text-gray-600 mb-6">
          Kontoen din har ikke tilgang til denne appen.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            💡 <strong>Trenger tilgang?</strong> Kontakt en administrator for å anmode om tilgang til appen.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Logg ut
          </button>
          <Link
            href="/"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            ← Tilbake til hjem
          </Link>
        </div>
      </div>
    </div>
  );
}
