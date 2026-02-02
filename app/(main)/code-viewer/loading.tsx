import { Skeleton } from "@/shared/components/ui/skeleton";
import { Card, CardContent } from "@/shared/components/ui/card";

export default function Loading() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-80" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>

      <Card>
        <CardContent className="p-0 sm:p-6">
          <div className="w-full min-h-[500px] border rounded-md overflow-hidden">
            <div className="flex h-full">
              <div className="w-1/5 bg-gray-100 dark:bg-gray-800 border-r">
                <div className="p-4">
                  <Skeleton className="h-4 w-3/4 mb-3" />
                  <Skeleton className="h-4 w-1/2 mb-3" />
                  <Skeleton className="h-4 w-2/3 mb-3" />
                  <Skeleton className="h-4 w-3/5 mb-3" />
                  <Skeleton className="h-4 w-2/5" />
                </div>
              </div>
              <div className="w-4/5 bg-gray-50 dark:bg-gray-900">
                <div className="border-b p-2">
                  <Skeleton className="h-6 w-32" />
                </div>
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
