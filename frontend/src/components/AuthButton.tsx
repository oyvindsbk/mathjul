'use client';

import { useEffect, useState } from 'react';

interface UserInfo {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
  claims: Array<{ typ: string; val: string }>;
}

export function useAuth() {
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
  const { user, loading, email } = useAuth();

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
          👤 {email || 'User'}
        </span>
        <a
          href="/.auth/logout"
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Logout
        </a>
      </div>
    );
  }

  return (
    <a
      href="/.auth/login/google"
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
    >
      Login with Google
    </a>
  );
}
