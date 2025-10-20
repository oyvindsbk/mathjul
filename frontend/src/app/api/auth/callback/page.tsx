"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();

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
            // Redirect to home page
            router.push("/");
          }
        }
      } catch (error) {
        console.error("Auth callback error:", error);
        router.push("/login");
      }
    };

    handleAuth();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="mb-4 text-2xl font-semibold">Authenticating...</h2>
        <p className="text-gray-600">Please wait while we sign you in.</p>
      </div>
    </div>
  );
}
