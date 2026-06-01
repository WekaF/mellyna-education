export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="h-32 rounded-3xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-44 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
