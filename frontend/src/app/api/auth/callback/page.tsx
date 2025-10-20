"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/AuthContext";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { setToken } = useAuth();

  useEffect(() => {
    const handleAuth = async () => {
      try {
        // Get the token from Static Web Apps
        const response = await fetch("/.auth/me");
        const authData = await response.json();

        if (authData && authData.clientPrincipal) {
          // Get JWT token from our backend
          const tokenResponse = await fetch("/api/auth/token", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            if (tokenData.token) {
              // Store the JWT token in context and localStorage
              setToken(tokenData.token);
              // Redirect to home page
              router.push("/");
            } else {
              throw new Error("No token received from backend");
            }
          } else {
            throw new Error(`Token request failed: ${tokenResponse.statusText}`);
          }
        }
      } catch (error) {
        console.error("Auth callback error:", error);
        router.push("/login");
      }
    };

    handleAuth();
  }, [router, setToken]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="mb-4 text-2xl font-semibold">Authenticating...</h2>
        <p className="text-gray-600">Please wait while we sign you in.</p>
      </div>
    </div>
  );
}
