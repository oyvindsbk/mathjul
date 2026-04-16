import { Skeleton } from "@/components/ui/Skeleton";

export default function UploadLoading() {
  return (
    <div className="min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <Skeleton className="h-10 w-48" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-24 rounded-lg" />
            <Skeleton className="h-10 w-40 rounded-lg" />
          </div>
        </div>

        {/* Tab toggle */}
        <Skeleton className="h-10 w-56 rounded-lg mb-6" />

        {/* Drop zone */}
        <Skeleton className="h-52 w-full rounded-lg mb-8" />

        {/* Extract button */}
        <Skeleton className="h-11 w-48 rounded-lg mb-8" />

        {/* Form fields */}
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-24 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-48 rounded-md mt-2" />
        </div>
      </main>
    </div>
  );
}
