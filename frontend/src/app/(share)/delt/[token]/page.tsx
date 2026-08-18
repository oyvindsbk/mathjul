import type { Metadata } from "next";
import SharedRecipeClient from "./client";

export const metadata: Metadata = {
  title: "Delt oppskrift",
  robots: { index: false, follow: false },
};

export default async function SharedRecipePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SharedRecipeClient shareToken={token} />;
}
