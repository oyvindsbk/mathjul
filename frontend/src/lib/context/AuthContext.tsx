"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

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

  // Load token from localStorage and cookie on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("jwt_token");
    if (storedToken) {
      setTokenState(storedToken);
    }
    setIsLoading(false);
  }, []);

  const setToken = (newToken: string) => {
    setTokenState(newToken);
    localStorage.setItem("jwt_token", newToken);
    
    // Also set as HTTP-only cookie so middleware can see it
    // Set to expire in 7 days
    const expiresDate = new Date();
    expiresDate.setDate(expiresDate.getDate() + 7);
    document.cookie = `auth_token=${newToken}; path=/; expires=${expiresDate.toUTCString()}; SameSite=Lax`;
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
