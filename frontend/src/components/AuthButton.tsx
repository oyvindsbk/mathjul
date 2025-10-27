'use client';

import { useEffect, useState } from 'react';
import { useAuth as useAuthContext } from '@/lib/context/AuthContext';

interface UserInfo {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
  claims: Array<{ typ: string; val: string }>;
}

function useStaticWebAppsAuth() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('/.auth/me');
        if (response.ok) {
          const data = await response.json();
          if (data.clientPrincipal) {
            setUser(data.clientPrincipal);
          }
        }
      } catch (error) {
        console.error('Failed to fetch user info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, []);

  const getUserEmail = (): string | null => {
    if (!user) return null;
    
    // Try to find email in claims
    const emailClaim = user.claims?.find(
      c => c.typ === 'emails' || c.typ.includes('emailaddress')
    );
    
    return emailClaim?.val || user.userDetails || null;
  };

  return {
    user,
    loading,
    isAuthenticated: !!user,
    email: getUserEmail(),
  };
}

export function AuthButton() {
  const { user, loading, email } = useStaticWebAppsAuth();
  const { logout } = useAuthContext();

  const handleLogout = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5238';
      await fetch(`${apiUrl}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include', // Include cookies
      });
    } catch (error) {
      console.error('Failed to logout from backend:', error);
    }
    
    // Clear the JWT token from context and localStorage
    logout();
    
    // On Azure Static Web Apps, use the built-in logout endpoint
    // This clears the Static Web Apps session
    // post_logout_redirect_uri is optional, defaults to home page
    window.location.href = '/.auth/logout?post_logout_redirect_uri=/login';
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (user) {
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
