export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F3F4F6] dark:bg-gray-950 texture-bg flex items-center justify-center px-4 py-12">
      {children}
    </div>
  );
}
