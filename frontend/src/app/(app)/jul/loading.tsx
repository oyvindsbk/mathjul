import { Skeleton } from "@/components/ui/Skeleton";

/** Skeleton for /jul while recipes load: heading plus one section of cards. */
export default function JulLoading() {
  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-12 px-3 sm:px-6 lg:px-8" data-testid="jul-loading">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8 md:mb-12">
          <Skeleton className="h-10 w-64 mx-auto mb-4" />
          <Skeleton className="h-5 w-80 max-w-full mx-auto" />
        </div>
        <Skeleton className="h-7 w-48 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-md overflow-hidden">
              <Skeleton className="h-28 md:h-48 w-full rounded-none" />
              <div className="p-3 md:p-6 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
