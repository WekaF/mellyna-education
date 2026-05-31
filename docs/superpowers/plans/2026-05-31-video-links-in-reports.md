# Video Links in Tutor Reports — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show uploaded videos properly in tutor report form, admin dashboard, and parent views — with a playable video player and explicit link.

**Architecture:** UI-only changes to 4 existing components. No new API routes, no schema changes. The upload/storage system already works. The `Media` model already has `type: PHOTO | VIDEO` and `url`. The fix is purely display: replace emoji placeholders with `<video>` elements and ensure explicit URL links are visible.

**Tech Stack:** Next.js 14, React, Tailwind CSS

---

## Root Cause Summary

| View | Current | Problem |
|------|---------|---------|
| Admin reports (`ReportsClient.tsx`) | Emoji `🎥` in dark box, wrapped in `<a>` | No video player; just emoji icon |
| Parent progress (`parent/progress/page.tsx`) | `<video controls>` inside `<a>` | Controls conflict with anchor click; 96px too small |
| Parent history (`parent/history/page.tsx`) | `<video>` without `controls` inside `<a>` | Shows thumbnail only; can't play inline |
| Tutor form (`tutor/reports/[scheduleId]/page.tsx`) | Emoji `🎥` in box, wrapped in `<a>` | No video player; just emoji icon |

---

## File Structure

All changes are in-place edits. No new files needed.

- **Modify:** `app/(dashboard)/admin/reports/ReportsClient.tsx` — Replace emoji with video thumbnail + explicit link
- **Modify:** `app/(dashboard)/parent/progress/page.tsx` — Fix `<a>` + `<video controls>` conflict, add explicit link button
- **Modify:** `app/(dashboard)/parent/history/page.tsx` — Add `controls`, fix `<a>` conflict, add explicit link button
- **Modify:** `app/(dashboard)/tutor/reports/[scheduleId]/page.tsx` — Replace emoji with video thumbnail + explicit link

---

## Task 1: Fix Video Display in Admin Reports Page

**Files:**
- Modify: `app/(dashboard)/admin/reports/ReportsClient.tsx:95-117`

### Current code (lines 100-114):
```tsx
<div className="flex flex-wrap gap-3">
  {report.media.map((m) => (
    <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer">
      {m.type === 'PHOTO' ? (
        <div className="h-24 w-24 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
          <img src={m.url} alt={m.filename} className="h-full w-full object-cover hover:opacity-80 transition-opacity" />
        </div>
      ) : (
        <div className="h-24 w-24 rounded-xl border border-slate-200 bg-slate-800 flex flex-col items-center justify-center gap-1 hover:opacity-80 transition-opacity">
          <span className="text-2xl">🎥</span>
          <span className="text-[9px] text-slate-300 font-medium">Video</span>
        </div>
      )}
    </a>
  ))}
</div>
```

- [ ] **Step 1: Replace emoji with video thumbnail + link in admin view**

Replace the `<div className="flex flex-wrap gap-3">` block (wrapping the `report.media.map`) with:

```tsx
<div className="flex flex-wrap gap-3">
  {report.media.map((m) => (
    <div key={m.id} className="flex flex-col gap-1">
      {m.type === 'PHOTO' ? (
        <a href={m.url} target="_blank" rel="noopener noreferrer">
          <div className="h-24 w-24 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
            <img src={m.url} alt={m.filename} className="h-full w-full object-cover hover:opacity-80 transition-opacity" />
          </div>
        </a>
      ) : (
        <div className="space-y-1">
          <video
            src={m.url}
            preload="metadata"
            className="h-24 w-40 rounded-xl border border-slate-200 bg-slate-100 object-cover"
            title={m.filename}
          />
          <a
            href={m.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
          >
            🔗 Lihat Video
          </a>
        </div>
      )}
    </div>
  ))}
</div>
```

- [ ] **Step 2: Verify admin view renders video correctly**

Navigate to `/admin/reports` in browser. A report with a video should show:
- A video thumbnail (first frame from metadata) — `96px tall × 160px wide`
- A "🔗 Lihat Video" link below it that opens in a new tab

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/admin/reports/ReportsClient.tsx
git commit -m "fix(admin): show video player instead of emoji in reports page"
```

---

## Task 2: Fix Video Display in Parent Progress Page

**Files:**
- Modify: `app/(dashboard)/parent/progress/page.tsx:75-99`

### Current code (lines 79-99):
```tsx
{report.media.map((m) => (
  <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="block">
    {m.type === 'PHOTO' ? (
      <div className="h-24 w-24 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
        <img src={m.url} alt={m.filename} className="h-full w-full object-cover" />
      </div>
    ) : (
      <div className="h-24 w-24 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
        <video
          src={m.url}
          controls
          preload="metadata"
          className="h-full w-full object-cover cursor-pointer"
          title={m.filename}
        />
      </div>
    )}
  </a>
))}
```

**Problem:** `<video controls>` inside `<a>` conflicts — browser may intercept play/pause clicks as link navigation. Also `96×96px` is too small for video controls to be usable.

- [ ] **Step 1: Fix video display — remove `<a>` wrapper for video, add separate link button**

Replace the `report.media.map` block with:

```tsx
{report.media.map((m) => (
  <div key={m.id} className="flex flex-col gap-1">
    {m.type === 'PHOTO' ? (
      <a href={m.url} target="_blank" rel="noopener noreferrer">
        <div className="h-24 w-24 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
          <img src={m.url} alt={m.filename} className="h-full w-full object-cover" />
        </div>
      </a>
    ) : (
      <div className="space-y-1">
        <video
          src={m.url}
          controls
          preload="metadata"
          className="rounded-xl border border-slate-200 bg-slate-100 w-full max-w-xs"
          title={m.filename}
        />
        <a
          href={m.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
        >
          🔗 Buka link video
        </a>
      </div>
    )}
  </div>
))}
```

- [ ] **Step 2: Verify parent progress view renders video correctly**

Navigate to `/parent/progress` as parent user. A report with a video should show:
- An inline `<video>` player with controls (play/pause/seek/volume)
- Player width fills container up to 320px
- A "🔗 Buka link video" link below it for direct download/share

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/parent/progress/page.tsx
git commit -m "fix(parent): fix video player in progress page — remove conflicting anchor wrapper"
```

---

## Task 3: Fix Video Display in Parent History Page

**Files:**
- Modify: `app/(dashboard)/parent/history/page.tsx:226-249`

### Current code (lines 237-249):
```tsx
) : (
  <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer">
    <div className="h-16 w-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
      <video
        src={m.url}
        preload="metadata"
        className="h-full w-full object-cover cursor-pointer"
        title={m.filename}
      />
    </div>
  </a>
)
```

**Problem:** No `controls` attribute — user can see first frame but cannot play inline. `<a>` wrapper just navigates away.

- [ ] **Step 1: Fix video display — add controls and explicit link button**

Replace the full `report.media.map` block (starting from `<div className="flex flex-wrap gap-2 pt-1">`, lines 226-251) with:

```tsx
<div className="flex flex-wrap gap-2 pt-1">
  {report.media.map((m) =>
    m.type === 'PHOTO' ? (
      <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer">
        <img
          src={m.url}
          alt={m.filename}
          className="h-16 w-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
        />
      </a>
    ) : (
      <div key={m.id} className="flex flex-col gap-1">
        <video
          src={m.url}
          controls
          preload="metadata"
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 w-full max-w-xs"
          title={m.filename}
        />
        <a
          href={m.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
        >
          🔗 Buka link video
        </a>
      </div>
    )
  )}
</div>
```

- [ ] **Step 2: Verify parent history view renders video correctly**

Navigate to `/parent/history` as parent user. A schedule with a video report should show:
- An inline `<video>` player with controls
- A "🔗 Buka link video" link below it

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/parent/history/page.tsx
git commit -m "fix(parent): add video controls and link in history page"
```

---

## Task 4: Fix Video Display in Tutor Report Form

**Files:**
- Modify: `app/(dashboard)/tutor/reports/[scheduleId]/page.tsx:291-327`

### Current code (lines 309-315):
```tsx
) : (
  <a href={m.url} target="_blank" rel="noopener noreferrer">
    <div className="h-20 w-20 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center">
      <span className="text-2xl">🎥</span>
    </div>
  </a>
)}
```

- [ ] **Step 1: Replace emoji with video thumbnail + link in tutor form**

Replace the VIDEO branch in the media map (inside `entry.media.map`) with:

```tsx
) : (
  <div className="space-y-1">
    <video
      src={m.url}
      preload="metadata"
      className="h-20 w-36 rounded-xl border border-slate-200 bg-slate-100 object-cover"
      title={m.filename}
    />
    <a
      href={m.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 text-[10px] text-indigo-600 hover:underline font-medium"
    >
      🔗 Lihat Video
    </a>
  </div>
)}
```

Note: Keep the delete button overlay on the outer `<div className="relative group">` — no change to that wrapper.

Full updated media item render (replace lines 298-325):

```tsx
{entry.media.map((m) => (
  <div key={m.id} className="relative group">
    {m.type === 'PHOTO' ? (
      <a href={m.url} target="_blank" rel="noopener noreferrer">
        <div className="h-20 w-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
          <img
            src={m.url}
            alt={m.filename}
            className="h-full w-full object-cover"
          />
        </div>
      </a>
    ) : (
      <div className="space-y-1">
        <video
          src={m.url}
          preload="metadata"
          className="h-20 w-36 rounded-xl border border-slate-200 bg-slate-100 object-cover"
          title={m.filename}
        />
        <a
          href={m.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-indigo-600 hover:underline font-medium"
        >
          🔗 Lihat Video
        </a>
      </div>
    )}
    <button
      onClick={() => handleDeleteMedia(student.id, m.id)}
      className="absolute -top-2 -right-2 hidden group-hover:flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm cursor-pointer"
      title="Hapus media"
    >
      <Trash2 className="h-3 w-3" />
    </button>
  </div>
))}
```

- [ ] **Step 2: Verify tutor report form renders video correctly**

Navigate to `/tutor/reports/[scheduleId]` as tutor. After uploading a video:
- A video thumbnail (first frame, 80×144px) should appear
- A "🔗 Lihat Video" link should appear below it
- Delete button (×) appears on hover — same as before

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/tutor/reports/[scheduleId]/page.tsx"
git commit -m "fix(tutor): show video thumbnail and link in report form"
```

---

## Self-Review

### Spec coverage check:
- ✅ Laporan tutor menampilkan link video yang sudah diupload → "🔗 Lihat Video" / "🔗 Buka link video" di semua view
- ✅ Superadmin dashboard dapat melihat video → Admin reports: video thumbnail + explicit link
- ✅ Parent dapat melihat video → Progress: inline player dengan controls; History: inline player dengan controls

### Placeholder scan:
- No TBD, TODO, or "add appropriate" phrases present

### Type consistency:
- `m.type === 'PHOTO'` / `m.type === 'VIDEO'` — consistent across all 4 tasks
- `m.url`, `m.filename`, `m.id` — same shape used in all tasks, matches `Media` type in schema

### Edge cases handled:
- If video URL is not yet accessible (MinIO not public): video element shows empty, link still works
- Delete button hover still works — outer `relative group` div preserved in Task 4
- Dark mode: Task 3 preserves `dark:` variants

---

## Notes

**WA Notification timing:** The `notifyParentNewReport` in `app/api/reports/route.ts` fires when the report is first saved — before any media is uploaded. So `mediaVideos: full.media` will always be empty at notification time. This is out of scope for this plan but worth noting: a follow-up notification after video upload would require a webhook in `app/api/media/upload/route.ts`.
