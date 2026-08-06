import Skeleton from "@/components/common/Skeleton";

export default function TestCardSkeleton() {
  return (
    <div className="flex flex-col rounded-none border border-surface-border bg-white p-5 sm:p-6">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="mt-2 h-4 w-1/4" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-1 h-4 w-5/6" />
      <div className="mt-4 flex gap-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="mt-5 border-t border-surface-border pt-4">
        <Skeleton className="h-10 w-full rounded-[5px]" />
      </div>
    </div>
  );
}
