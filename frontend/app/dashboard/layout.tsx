import AuthInitializer from "@/components/common/AuthInitializer";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthInitializer>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-950 texture-bg">
        {children}
      </div>
    </AuthInitializer>
  );
}
