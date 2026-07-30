interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 ${className}`}
      aria-hidden="true"
      style={{
        animation: "shimmer 2s infinite",
        backgroundSize: "200% 100%",
      }}
    />
  );
}
