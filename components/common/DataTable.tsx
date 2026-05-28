'use client'

import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface DataTableProps<TData> {
  // columns must be defined outside the render function or wrapped in useMemo
  // to avoid unnecessary re-renders when the parent component re-renders
  columns: ColumnDef<TData, any>[]
  data: TData[]
  loading?: boolean
  searchPlaceholder?: string
  emptyMessage?: string
  emptyIcon?: string
  defaultPageSize?: number
}

export function TableSkeleton({
  columns = 5,
  rows = 5,
}: {
  columns?: number
  rows?: number
}) {
  return (
    <div className="animate-pulse">
      <div className="p-4 border-b border-slate-100">
        <div className="h-9 w-64 bg-slate-200 dark:bg-slate-700 rounded-xl" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-6 py-3.5">
                  <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: columns }).map((_, j) => (
                  <td key={j} className="px-6 py-4">
                    <div
                      className="h-4 bg-slate-100 dark:bg-slate-800 rounded"
                      style={{ width: `${50 + ((i * 3 + j * 7) % 40)}%` }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
        <div className="h-4 w-32 bg-slate-100 dark:bg-slate-800 rounded" />
        <div className="flex gap-2">
          <div className="h-7 w-7 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          <div className="h-7 w-7 bg-slate-100 dark:bg-slate-800 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export default function DataTable<TData>({
  columns,
  data,
  loading = false,
  searchPlaceholder = 'Cari...',
  emptyMessage = 'Tidak ada data.',
  emptyIcon = '📭',
  defaultPageSize = 10,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: defaultPageSize } },
  })

  if (loading) {
    return <TableSkeleton columns={columns.length} />
  }

  const rows = table.getRowModel().rows
  const { pageIndex, pageSize } = table.getState().pagination
  const totalFiltered = table.getFilteredRowModel().rows.length

  return (
    <div>
      {/* Search bar */}
      <div className="p-4 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={globalFilter}
            onChange={(e) => {
              table.setPageIndex(0)
              setGlobalFilter(e.target.value)
            }}
            placeholder={searchPlaceholder}
            className="w-full sm:w-72 pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-colors"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-10 text-center text-slate-400">
          <p className="text-3xl">{emptyIcon}</p>
          <p className="mt-2 text-sm">{globalFilter ? 'Data tidak ditemukan.' : emptyMessage}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  {table.getHeaderGroups()[0].headers.map((header) => (
                    <th
                      key={header.id}
                      className="text-left px-6 py-3.5 font-semibold text-slate-500 text-xs uppercase whitespace-nowrap"
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex items-center gap-1 hover:text-slate-800 transition-colors cursor-pointer"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === 'asc' ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/30">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Baris per halaman:</span>
              <select
                value={pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                className="px-2 py-1 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:border-indigo-500"
              >
                {[10, 25, 50].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>
                {totalFiltered === 0
                  ? '0 data'
                  : `${pageIndex * pageSize + 1}–${Math.min(
                      (pageIndex + 1) * pageSize,
                      totalFiltered
                    )} dari ${totalFiltered}`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-medium px-1">
                  {pageIndex + 1}/{table.getPageCount()}
                </span>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30 transition-colors cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
