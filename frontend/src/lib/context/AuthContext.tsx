"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface UserProfile {
  userId: number | null;
  name: string | null;
  nickname: string | null;
}

interface AuthContextType {
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  userId: number | null;
  name: string | null;
  nickname: string | null;
  setToken: (token: string) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  setProfile: (profile: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<number | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);

  const ensureUser = async (t: string) => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5238";
    try {
      const res = await fetch(`${apiBase}/api/auth/ensure-user`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` },
        credentials: "include",
      });
      if (res.ok) {
        const data = (await res.json()) as { id: number; name: string | null; nickname: string | null };
        setUserId(data.id);
        setName(data.name ?? null);
        setNickname(data.nickname ?? null);
      }
    } catch {
      // Non-critical — ignore errors
    }
  };

  // Load token from localStorage on mount; fall back to server session cookie (set by Google OAuth)
  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem("jwt_token");
      if (stored) {
        setTokenState(stored);
        await ensureUser(stored);
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
            await ensureUser(data.token);
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
    setUserId(null);
    setName(null);
    setNickname(null);
    localStorage.removeItem("jwt_token");
    
    // Clear the cookie by setting it to expire in the past
    document.cookie = `auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax`;
  };

  const refreshProfile = async () => {
    if (token) {
      await ensureUser(token);
    }
  };

  const setProfile = (profile: Partial<UserProfile>) => {
    if (profile.userId !== undefined) setUserId(profile.userId);
    if (profile.name !== undefined) setName(profile.name);
    if (profile.nickname !== undefined) setNickname(profile.nickname);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        isLoading,
        isAuthenticated: !!token,
        userId,
        name,
        nickname,
        setToken,
        logout,
        refreshProfile,
        setProfile,
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
