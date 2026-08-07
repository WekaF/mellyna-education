# Pencatatan Pengeluaran (Expense Recording) — Design

**Status:** Approved
**Date:** 2026-08-07

## Problem

`Laporan Keuangan` (Financial Report) currently shows only a gross total ("Total Tagihan") — the sum of `Invoice.amount` across all statuses (PENDING/PAID/OVERDUE/CANCELLED) for the selected period. There is no way to record expenses, so there's no way to see a net figure (income minus outgoings).

## Goal

Give `SUPER_ADMIN` a new menu to manually record expenses, and surface a net total ("Total Bersih") on the existing Financial Report page: `Total Bersih = Total Tagihan (gross, all invoice statuses) - Total Pengeluaran (period)`.

## Decisions

- **Net total basis:** gross invoice total (same basis as today's "Total Tagihan" card, all statuses) minus expenses. Not switched to PAID-only, to stay consistent with the existing card.
- **Categories:** dynamic master table (`ExpenseCategory`), not a fixed enum — superadmin can introduce new categories without a deploy.
- **Category management UX:** no separate CRUD menu. The expense form has a combobox that lets the user pick an existing category or type a new name; a new category is auto-created (upsert by unique `name`) at submit time.
- **Attachments:** none. Text-only fields (date, category, amount, description). No Minio upload in this iteration.
- **Menu placement:** new sidebar item "Pencatatan Pengeluaran" inside the existing "Billing" group, next to "Laporan Keuangan".
- **Access:** SUPER_ADMIN only, for both writing and reading expense data (unlike Milestone, where any authenticated role can read).

## Data Model

```prisma
model ExpenseCategory {
  id        String    @id @default(cuid())
  name      String    @unique
  createdAt DateTime  @default(now())
  expenses  Expense[]
}

model Expense {
  id          String          @id @default(cuid())
  categoryId  String
  category    ExpenseCategory @relation(fields: [categoryId], references: [id])
  amount      Int
  description String
  date        DateTime
  createdById String
  createdBy   User            @relation(fields: [createdById], references: [id])
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
}
```

- `date`: the expense's own date, chosen by the user, used for period filtering — mirrors `Invoice.dueDate` vs `Invoice.createdAt` split.
- `amount`: `Int`, same convention as `Invoice.amount` (whole rupiah, no decimals).
- `createdById`: relation to `User`, for audit trail (more than one superadmin account may exist).
- `User` model needs a back-relation field added (e.g. `expenses Expense[]`) for the `createdBy` relation to compile.

## Pages & Menu

- Sidebar: add `{ name: 'Pencatatan Pengeluaran', href: '/admin/expenses', icon: Wallet }` into the SUPER_ADMIN "Billing" group in `components/dashboard/sidebar.tsx` (next to the existing "Laporan Keuangan" entry).
- New route: `app/(dashboard)/admin/expenses/page.tsx` — server component. Session + `SUPER_ADMIN` guard (redirect to `/admin` otherwise), following the same shape as `app/(dashboard)/admin/milestones/page.tsx`. Fetches initial expense list + category list, passes to client component.
- New client component: `app/(dashboard)/admin/expenses/ExpensesClient.tsx` — follows the Milestone pattern: modal create/edit form, table list, `useConfirm()` for delete confirmation, `useToastNotification()` for errors.
  - Form fields: date (date input), category (combobox — select existing `ExpenseCategory` by id, or type free text to create new), amount (number input, rupiah), description (text).
  - List filter: month/year dropdowns, same convention as `FinancialReportClient.tsx` (`MONTHS`/`YEARS` constants, filters by `Expense.date`).

## API Routes

All routes below require an authenticated session AND `session.user.role === 'SUPER_ADMIN'` (401 if no session, 403 if wrong role) — same inline-guard convention used across the codebase (no shared `requireRole()` helper exists; this feature does not introduce one, to stay consistent).

- `GET /api/expenses?month=&year=` — list expenses for the period (or all, if no filter given), ordered by `date desc`, including `category` relation. Filter logic mirrors the existing `dateFilter` pattern from `app/api/invoices/route.ts`, but applied to the `date` field instead of `createdAt`.
- `POST /api/expenses` — body `{ date: string, categoryId?: string, categoryName?: string, amount: number, description: string }`. Exactly one of `categoryId`/`categoryName` must be present. If `categoryName` is given, `upsert` an `ExpenseCategory` by `name` first, then create the `Expense` pointing at its id.
- `PATCH /api/expenses/[id]` — partial update, same `categoryId`/`categoryName` xor rule applies if category is being changed.
- `DELETE /api/expenses/[id]` — hard delete.
- `GET /api/expense-categories` — list all categories (`id`, `name`), ordered by `name`, for populating the combobox.

### Validation (Zod)

- `amount`: positive integer.
- `description`: non-empty string.
- `date`: valid ISO date string.
- `categoryId` xor `categoryName`: exactly one must be a non-empty string.

## Financial Report Integration

Two files already compute the gross total redundantly (`app/(dashboard)/admin/financial-report/page.tsx` and `app/api/admin/financial-report/summary/route.ts`); this feature adds the same net-total computation to both, keeping the existing duplication pattern rather than refactoring it (out of scope for this feature).

In each file:
1. Add `prisma.expense.aggregate({ where: <same month/year filter, but on `date` field>, _sum: { amount: true } })`.
2. Extend the returned `summary` object with `expenseTotal: number` and `netTotal: number` (`= summary.total.amount - expenseTotal`).

In `FinancialReportClient.tsx`:
- Add a "Total Pengeluaran" stat card and a "Total Bersih" stat card, alongside the existing "Total Tagihan" card.

## Out of Scope

- Expense attachments/receipt uploads.
- Approval workflow for expenses (any SUPER_ADMIN can create/edit/delete freely, no review step).
- Separate category management UI (edit/delete/rename categories) — categories are create-only via quick-add; renaming/removing a category is a future iteration if needed.
- Refactoring the duplicated gross-total logic across the two financial-report files.

## Testing

- API unit tests: create expense with existing `categoryId`; create with new `categoryName` (verify category auto-created); reject negative `amount`; reject empty `description`; reject request with both/neither of `categoryId`/`categoryName`; non-SUPER_ADMIN gets 403 on all mutating routes and on `GET`.
- Integration test: financial-report summary endpoint returns `netTotal = grossTotal - expenseTotal` for a period with both invoices and expenses; expenses outside the selected month/year are excluded from `expenseTotal`.
