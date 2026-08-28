import { Skeleton } from "@/components/ui/Skeleton";

export default function SnurrLoading() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto text-center">
        {/* Title */}
        <Skeleton className="h-10 w-56 mx-auto mb-3" />
        {/* Subtitle */}
        <Skeleton className="h-5 w-80 mx-auto mb-10" />

        {/* Wheel circle */}
        <Skeleton className="h-80 w-80 rounded-full mx-auto mb-8" />

        {/* Spin button */}
        <Skeleton className="h-12 w-40 rounded-full mx-auto mb-8" />

        {/* Recipe list stubs */}
        <div className="flex flex-col gap-3 mt-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}
