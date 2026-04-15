"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/AuthContext";
import { groupsService, type GroupDetail, type GroupMember } from "@/lib/services/groups.service";

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = use(params);
  const groupId = parseInt(idStr, 10);
  const { token, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameName, setRenameName] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);

  // Invite member state
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Delete state
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    groupsService
      .getGroup(groupId, token ?? undefined)
      .then((g) => {
        setGroup(g);
        setRenameName(g.name);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Kunne ikke laste gruppe"))
      .finally(() => setLoading(false));
  }, [groupId, token, authLoading]);

  // Management UI is shown to all members; the backend enforces 403 for unauthorized actions.

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameName.trim() || !group) return;
    setRenameError(null);
    try {
      const updated = await groupsService.renameGroup(group.id, renameName.trim(), token ?? undefined);
      setGroup((prev) => prev ? { ...prev, name: updated.name } : prev);
      setIsRenaming(false);
    } catch (e: unknown) {
      setRenameError(e instanceof Error ? e.message : "Kunne ikke endre navn");
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !group) return;
    setIsInviting(true);
    setInviteError(null);
    try {
      const member = await groupsService.addMember(group.id, inviteEmail.trim(), token ?? undefined);
      setGroup((prev) => prev ? { ...prev, members: [...prev.members, member] } : prev);
      setInviteEmail("");
    } catch (e: unknown) {
      setInviteError(e instanceof Error ? e.message : "Kunne ikke invitere bruker");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (member: GroupMember) => {
    if (!group) return;
    if (!window.confirm(`Fjerne ${member.displayName || member.email} fra gruppen?`)) return;
    try {
      await groupsService.removeMember(group.id, member.userId, token ?? undefined);
      setGroup((prev) => prev ? { ...prev, members: prev.members.filter((m) => m.userId !== member.userId) } : prev);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Kunne ikke fjerne medlem");
    }
  };

  const handleDelete = async () => {
    if (!group) return;
    if (!window.confirm(`Slette gruppen "${group.name}"? Dette kan ikke angres.`)) return;
    setIsDeleting(true);
    try {
      await groupsService.deleteGroup(group.id, token ?? undefined);
      router.push("/groups");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Kunne ikke slette gruppe");
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen p-8"><p className="text-gray-500">Laster gruppe…</p></div>;
  }

  if (error || !group) {
    return (
      <div className="min-h-screen p-8">
        <Link href="/groups" className="text-blue-600 hover:underline text-sm">← Tilbake til grupper</Link>
        <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg">
          {error ?? "Gruppe ikke funnet"}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 sm:p-12">
      <main className="max-w-2xl mx-auto">
        <Link href="/groups" className="text-sm text-blue-600 hover:underline">
          ← Tilbake til grupper
        </Link>

        {/* Group name (editable by owner) */}
        <div className="mt-4 mb-8">
          {isRenaming ? (
            <form onSubmit={handleRename} className="flex items-center gap-3">
              <input
                type="text"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                className="text-2xl font-bold border-b-2 border-emerald-500 outline-none bg-transparent flex-1"
                autoFocus
              />
              <button type="submit" className="px-3 py-1 bg-emerald-600 text-white text-sm rounded">Lagre</button>
              <button type="button" onClick={() => { setIsRenaming(false); setRenameName(group.name); }} className="px-3 py-1 bg-gray-200 text-sm rounded">Avbryt</button>
            </form>
          ) : (
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{group.name}</h1>
              <button onClick={() => setIsRenaming(true)} className="text-sm text-gray-400 hover:text-gray-600" title="Endre navn">✏️</button>
            </div>
          )}
          {renameError && <p className="mt-1 text-sm text-red-600">{renameError}</p>}
          <p className="text-sm text-gray-500 mt-1">Eier: {group.ownerEmail}</p>
        </div>

        {/* Members */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Medlemmer ({group.members.length})</h2>
          <ul className="space-y-2 mb-4">
            {group.members.map((m) => (
              <li key={m.userId} className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-sm">{m.displayName || m.email}</span>
                  {m.displayName && <span className="text-xs text-gray-500 ml-2">{m.email}</span>}
                </div>
                <button
                  onClick={() => handleRemoveMember(m)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Fjern
                </button>
              </li>
            ))}
          </ul>

          {/* Invite form */}
          <form onSubmit={handleInvite} className="flex gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Inviter via e-post"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
              disabled={isInviting}
            />
            <button
              type="submit"
              disabled={isInviting || !inviteEmail.trim()}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {isInviting ? "Inviterer…" : "Inviter"}
            </button>
          </form>
          {inviteError && <p className="mt-2 text-sm text-red-600">{inviteError}</p>}
        </section>

        {/* Recipes */}
        {group.recipes.length > 0 && (
          <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Gruppeoppskrifter ({group.recipes.length})</h2>
            <ul className="space-y-2">
              {group.recipes.map((r) => (
                <li key={r.id}>
                  <Link href={`/recipes/${r.id}`} className="text-blue-600 hover:underline text-sm">
                    {r.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Ukesplanlegger */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Ukesplanlegger</h2>
            <Link
              href={`/ukesplanlegger?groupId=${group.id}`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Åpne ukesplanlegger
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Ukesplanlegger aktiv</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {group.mealPlanEnabled
                  ? "Ukesplanleggeren er aktivert for denne gruppen."
                  : "Ukesplanleggeren er deaktivert for denne gruppen."}
              </p>
            </div>
            <button
              onClick={async () => {
                if (!group) return;
                const newValue = !group.mealPlanEnabled;
                try {
                  await groupsService.updateGroupSettings(group.id, { mealPlanEnabled: newValue }, token ?? undefined);
                  setGroup((prev) => prev ? { ...prev, mealPlanEnabled: newValue } : prev);
                } catch (e: unknown) {
                  alert(e instanceof Error ? e.message : "Kunne ikke oppdatere innstilling");
                }
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                group.mealPlanEnabled ? "bg-blue-600" : "bg-gray-300"
              }`}
              role="switch"
              aria-checked={group.mealPlanEnabled}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  group.mealPlanEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </section>

        {/* Danger zone */}
        <section className="border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-700 mb-3">Faresone</h2>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? "Sletter…" : "Slett gruppe"}
          </button>
        </section>
      </main>
    </div>
  );
}
