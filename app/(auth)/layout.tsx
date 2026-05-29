export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50 dark:bg-[#151f32] text-slate-900 dark:text-slate-100 transition-colors duration-300">{children}</div>
}
