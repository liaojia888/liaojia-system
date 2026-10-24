export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-slate-100 px-4 py-12">
      {children}
    </div>
  );
}
