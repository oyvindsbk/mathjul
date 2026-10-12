import { redirect } from "next/navigation";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Stock now lives inside the planner; this keeps old links and bookmarks working. */
export default async function BeholdningPage({ searchParams }: Props) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string" && (key === "groupId" || key === "tab")) params.set(key, value);
  }
  params.set("view", "beholdning");
  redirect(`/ukesplanlegger?${params.toString()}`);
}
