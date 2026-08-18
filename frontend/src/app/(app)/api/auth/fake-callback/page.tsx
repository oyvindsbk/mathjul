"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/AuthContext";

export default function FakeAuthCallbackPage() {
  const router = useRouter();
  const { setToken } = useAuth();

  useEffect(() => {
    const handleFakeAuth = async () => {
      try {
        // Request fake token from dev endpoint
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
            throw new Error("No token received from endpoint");
          }
        } else {
          throw new Error(`Token request failed: ${tokenResponse.statusText}`);
        }
      } catch (error) {
        console.error("Fake auth error:", error);
        router.push("/login");
      }
    };

    handleFakeAuth();
  }, [router, setToken]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="mb-4 text-2xl font-semibold">Logging in...</h2>
        <p className="text-gray-600">
          Using development fake authentication.
        </p>
      </div>
    </div>
  );
}
