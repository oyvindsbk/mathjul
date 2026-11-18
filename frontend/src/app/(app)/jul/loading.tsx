import { JulTheme } from "@/components/jul/JulTheme";
import { JulGarland } from "@/components/jul/JulGarland";

/** Skeleton for /jul while the route loads, already in the Jul palette. */
export default function JulLoading() {
  return (
    <JulTheme>
      <JulGarland />
      <div className="py-4 md:py-10 px-3 sm:px-6 lg:px-8" data-testid="jul-loading" aria-busy="true">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <p className="jul-display jul-title text-5xl md:text-7xl">Jul på mathjul</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="jul-panel h-48 md:h-72 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </JulTheme>
  );
}
