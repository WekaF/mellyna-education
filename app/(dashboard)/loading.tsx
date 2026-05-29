import React from 'react'

export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="rounded-3xl bg-slate-200 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800/40 p-8 h-[120px] flex flex-col justify-center relative overflow-hidden">
        <div className="absolute inset-0 shimmer-bg" />
        <div className="h-7 w-48 bg-slate-300 dark:bg-slate-700 rounded-lg mb-2 relative z-10" />
        <div className="h-4 w-96 bg-slate-300 dark:bg-slate-700 rounded-lg relative z-10" />
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl bg-white dark:bg-[#1e293b]/45 border border-slate-100 dark:border-slate-800/60 p-6 shadow-xs flex items-center gap-4 relative overflow-hidden">
            <div className="absolute inset-0 shimmer-bg" />
            <div className="h-12 w-12 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0 relative z-10" />
            <div className="space-y-2 relative z-10 flex-1">
              <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded-md" />
              <div className="h-7 w-10 bg-slate-300 dark:bg-slate-700 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* List/Table Content Skeleton */}
      <div className="rounded-2xl bg-white dark:bg-[#1e293b]/45 border border-slate-100 dark:border-slate-800/60 shadow-xs overflow-hidden relative">
        <div className="absolute inset-0 shimmer-bg" />
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/60 relative z-10">
          <div className="h-5 w-36 bg-slate-200 dark:bg-slate-700 rounded-md" />
          <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded-md" />
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800/60 relative z-10">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between px-6 py-4">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded-md" />
                <div className="h-3 w-28 bg-slate-200 dark:bg-slate-700 rounded-md" />
              </div>
              <div className="space-y-2 text-right">
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded-md ml-auto" />
                <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded-md ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
