import { TableSkeleton } from '@/components/common/DataTable'

export default function AnnouncementsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
        </div>
      </div>
      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
        <TableSkeleton columns={3} rows={6} />
      </div>
    </div>
  )
}
