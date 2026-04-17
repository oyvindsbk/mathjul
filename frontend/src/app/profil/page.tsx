"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/context/AuthContext";
import { apiFetch } from "@/lib/api-fetch";

export default function ProfilPage() {
  const { token, userId, name, nickname, setProfile, isLoading: authLoading } = useAuth();
  const [nameInput, setNameInput] = useState("");
  const [nicknameInput, setNicknameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNameInput(name ?? "");
    setNicknameInput(nickname ?? "");
  }, [name, nickname]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !userId) return;

    setSaving(true);
    setSuccess(false);
    setError(null);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5238";
      const res = await apiFetch(`${apiBase}/api/user/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          name: nameInput.trim() || null,
          nickname: nicknameInput.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Kunne ikke lagre profilen");
        return;
      }

      const data = (await res.json()) as { name: string | null; nickname: string | null };
      setProfile({ name: data.name, nickname: data.nickname });
      setSuccess(true);
    } catch {
      setError("Noe gikk galt. Prøv igjen.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Du må være logget inn for å se profilen din.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Profilinnstillinger</h1>

        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Navn
              </label>
              <input
                id="name"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={100}
                placeholder="Ditt fulle navn"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-1">
                Kallenavn
              </label>
              <input
                id="nickname"
                type="text"
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                maxLength={50}
                placeholder="Ditt kallenavn"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            {success && (
              <p className="text-sm text-green-600">Profilen er oppdatert!</p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Lagrer…" : "Lagre"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
