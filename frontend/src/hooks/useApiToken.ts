'use client';

import { useAuth } from '@/lib/context/AuthContext';

export function useApiToken() {
  const { token, isLoading, logout } = useAuth();

  return {
    token,
    loading: isLoading,
    error: null as string | null,
    clearToken: logout,
    isReady: !isLoading && !!token,
  };
}
