"use client";

import { RecipeGridCard } from "@/components/RecipeGridCard";
import type { JulSectionGroup } from "@/lib/jul";

interface JulSectionProps {
  section: JulSectionGroup;
  token: string | null;
}

/** One titled group of Jul recipes, e.g. "Julebakst og kaker". */
export function JulSection({ section, token }: JulSectionProps) {
  const headingId = `jul-section-${section.key}`;

  return (
    <section
      className="mb-10"
      aria-labelledby={headingId}
      data-testid={`jul-section-${section.key}`}
    >
      <h2 id={headingId} className="jul-display jul-section-title text-2xl md:text-4xl mb-4">
        <span aria-hidden="true">❄</span>
        {section.title}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
        {section.recipes.map((recipe) => (
          <div key={recipe.id} className="jul-card-frame" data-testid="jul-recipe">
            <RecipeGridCard recipe={recipe} token={token} />
          </div>
        ))}
      </div>
    </section>
  );
}
