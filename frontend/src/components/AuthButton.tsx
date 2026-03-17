'use client';

import { useAuth } from '@/lib/context/AuthContext';

function getEmailFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.email || payload.sub || null;
  } catch {
    return null;
  }
}

export function AuthButton() {
  const { isAuthenticated, isLoading, token, logout } = useAuth();

  const handleLogout = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5238';
      await fetch(`${apiUrl}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Failed to logout from backend:', error);
    }
    logout();
    window.location.href = '/login';
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isAuthenticated && token) {
    const email = getEmailFromToken(token);
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">
          👤 {email || 'Bruker'}
        </span>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Logg ut
        </button>
      </div>
    );
  }

  return (
    <a
      href="/login"
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
    >
      Logg inn med Google
    </a>
  );
}
