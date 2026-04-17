"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "../api-fetch";

interface AuthContextType {
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setToken: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const ensureUser = (t: string) => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5238";
    apiFetch(`${apiBase}/api/auth/ensure-user`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}` },
      credentials: "include",
    }).catch(() => {
      // Non-critical — ignore errors
    });
  };

  // Load token from localStorage on mount; fall back to server session cookie (set by Google OAuth)
  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem("jwt_token");
      if (stored) {
        setTokenState(stored);
        ensureUser(stored);
        setIsLoading(false);
        return;
      }

      // Check for a server-side httpOnly cookie set by the Google OAuth callback
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const data = (await res.json()) as { token: string | null };
          if (data.token) {
            setTokenState(data.token);
            localStorage.setItem("jwt_token", data.token);
            ensureUser(data.token);
          }
        }
      } catch {
        // Ignore — server may be unavailable
      }

      setIsLoading(false);
    };

    init();
  }, []);

  const setToken = (newToken: string) => {
    setTokenState(newToken);
    localStorage.setItem("jwt_token", newToken);

    // Also set as HTTP-only cookie so middleware can see it
    const expiresDate = new Date();
    expiresDate.setDate(expiresDate.getDate() + 7);
    document.cookie = `auth_token=${newToken}; path=/; expires=${expiresDate.toUTCString()}; SameSite=Lax`;

    ensureUser(newToken);
  };

  const logout = () => {
    setTokenState(null);
    localStorage.removeItem("jwt_token");
    
    // Clear the cookie by setting it to expire in the past
    document.cookie = `auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax`;
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        isLoading,
        isAuthenticated: !!token,
        setToken,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
