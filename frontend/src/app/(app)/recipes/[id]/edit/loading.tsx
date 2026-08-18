import { Skeleton } from "@/components/ui/Skeleton";

function FormFieldSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-10 w-full rounded-md" />
    </div>
  );
}

export default function EditRecipeLoading() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Back link */}
        <Skeleton className="h-10 w-36 mb-6" />

        {/* Page title */}
        <Skeleton className="h-9 w-48 mb-8" />

        {/* Form fields */}
        <div className="bg-white rounded-xl shadow-sm p-8 flex flex-col gap-6">
          <FormFieldSkeleton />
          <FormFieldSkeleton />

          {/* Ingredients section */}
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-28" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-2">
                <Skeleton className="h-10 w-20 rounded-md" />
                <Skeleton className="h-10 w-24 rounded-md" />
                <Skeleton className="h-10 flex-1 rounded-md" />
                <Skeleton className="h-10 w-10 rounded-md" />
              </div>
            ))}
            <Skeleton className="h-9 w-40 rounded-md" />
          </div>

          {/* Instructions section */}
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-28" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-2">
                <Skeleton className="h-20 flex-1 rounded-md" />
                <Skeleton className="h-10 w-10 rounded-md" />
              </div>
            ))}
            <Skeleton className="h-9 w-40 rounded-md" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormFieldSkeleton />
            <FormFieldSkeleton />
          </div>

          {/* Submit button */}
          <Skeleton className="h-11 w-full rounded-md mt-2" />
        </div>
      </div>
    </div>
  );
}
