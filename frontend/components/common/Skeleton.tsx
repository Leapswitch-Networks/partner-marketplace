interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className = "" }: SkeletonProps) {
  // Dark variants added with the PM-19 loading boundaries: the light gradient was
  // tolerable on a small inline placeholder and glaring as a full-page one.
  return (
    <div
      className={`rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 ${className}`}
      aria-hidden="true"
      style={{
        animation: "shimmer 2s infinite",
        backgroundSize: "200% 100%",
      }}
    />
  );
}
