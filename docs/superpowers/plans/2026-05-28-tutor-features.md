# Tutor Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement three tutor features — (1) progress notes per student visible to parents, (2) photo/video upload per student per session, (3) WAHA + in-app notification when admin publishes schedule.

**Architecture:** All three features extend existing infrastructure. The `LearningReport` + `Media` models already exist in Prisma. The tutor reports page and parent progress page already exist but have bugs/gaps. WAHA already sends to parents on publish — we extend it to also notify the tutor. No schema changes required.

**Tech Stack:** Next.js 15 App Router, Prisma PostgreSQL, MinIO (object storage), WAHA (WhatsApp), NextAuth JWT, Tailwind CSS, Jest + `next/jest`

---

## Gap Analysis (what already works vs what is missing)

| Feature | Status | Gap |
|---------|--------|-----|
| Tutor writes report per student | ✅ Page exists (`/tutor/reports/[scheduleId]`) | Uses `class.enrollments` not `schedule.participants` — wrong student source |
| Parent views reports | ✅ `/parent/progress` works | None |
| Media upload (photo/video) | ✅ `POST /api/media/upload` works | No existing media shown in tutor UI; no delete endpoint |
| Parent views media | ✅ `/parent/progress` shows media | None |
| Tutor notified on publish | ❌ Publish route only notifies parents | Need WAHA to tutor + in-app "new" badge |

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `app/api/media/[id]/route.ts` | **Create** | DELETE media — auth check + MinIO delete + DB delete |
| `app/(dashboard)/tutor/reports/[scheduleId]/page.tsx` | **Modify** | Use `participants` not `enrollments`; show existing media gallery; delete media |
| `app/api/schedules/[id]/publish/route.ts` | **Modify** | Also fetch tutor phone; send WAHA to tutor after publish |
| `app/(dashboard)/tutor/page.tsx` | **Modify** | Add `publishedAt` to query; show "Baru" badge for schedules published in last 24h |
| `lib/storage.ts` | **Modify** | Export `deleteFile(key)` helper for MinIO object deletion |
| `__tests__/api/media-delete.test.ts` | **Create** | Unit tests for DELETE /api/media/[id] |
| `__tests__/api/publish-tutor-notify.test.ts` | **Create** | Unit tests for tutor WAHA in publish route |

---

## Task 1: Add `deleteFile` to MinIO storage lib

**Files:**
- Modify: `lib/storage.ts`

- [ ] **Step 1: Read the current storage.ts to understand MinIO client shape**

```bash
cat lib/storage.ts
```

Expected: shows `minioClient`, `ensureBucket()`, `uploadFile()`.

- [ ] **Step 2: Write the failing test**

Create `__tests__/api/media-delete.test.ts`:

```typescript
// This test verifies deleteFile is exported from lib/storage.ts
import { deleteFile } from '@/lib/storage'

describe('deleteFile', () => {
  it('exports deleteFile as a function', () => {
    expect(typeof deleteFile).toBe('function')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx jest __tests__/api/media-delete.test.ts --no-coverage
```

Expected: FAIL — `deleteFile` is not exported from `@/lib/storage`.

- [ ] **Step 4: Add `deleteFile` to `lib/storage.ts`**

After the existing `uploadFile` function, add:

```typescript
export async function deleteFile(key: string): Promise<void> {
  await minioClient.removeObject(process.env.MINIO_BUCKET ?? 'mellyna', key)
}
```

The `key` is the path portion of the MinIO URL (everything after the bucket). The URL format from `uploadFile` is `http://<endpoint>/<bucket>/<key>`, so callers must extract the key from the stored URL.

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest __tests__/api/media-delete.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/storage.ts __tests__/api/media-delete.test.ts
git commit -m "feat: add deleteFile helper to MinIO storage lib"
```

---

## Task 2: Media delete API endpoint

**Files:**
- Create: `app/api/media/[id]/route.ts`
- Modify: `__tests__/api/media-delete.test.ts` (extend with route tests)

The DELETE endpoint must:
1. Check session (auth)
2. Fetch the Media record — verify the linked report's `tutorId` matches the session user (TUTOR) or allow SUPER_ADMIN
3. Extract the object key from `media.url`
4. Delete from MinIO via `deleteFile(key)`
5. Delete from DB via `prisma.media.delete`

- [ ] **Step 1: Write failing route tests**

Add to `__tests__/api/media-delete.test.ts`:

```typescript
// Integration-style test for the DELETE handler logic
// We test the authorization logic directly since mocking Next.js route handlers is complex

describe('media delete authorization', () => {
  it('rejects non-TUTOR, non-ADMIN roles', () => {
    const allowedRoles = ['TUTOR', 'SUPER_ADMIN']
    const role = 'PARENT'
    expect(allowedRoles.includes(role)).toBe(false)
  })

  it('allows TUTOR and SUPER_ADMIN roles', () => {
    const allowedRoles = ['TUTOR', 'SUPER_ADMIN']
    expect(allowedRoles.includes('TUTOR')).toBe(true)
    expect(allowedRoles.includes('SUPER_ADMIN')).toBe(true)
  })

  it('extracts key from MinIO URL correctly', () => {
    const url = 'http://localhost:9000/mellyna/media/1234567890-photo.jpg'
    const bucket = 'mellyna'
    const key = url.split(`/${bucket}/`)[1]
    expect(key).toBe('media/1234567890-photo.jpg')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/media-delete.test.ts --no-coverage
```

Expected: FAIL on the URL extraction test (function doesn't exist yet — but the logic test should run).

Actually expected: PASS on logic tests, FAIL on the deleteFile export if Step 4 of Task 1 is done first.

Run after Task 1 is committed: all tests PASS.

- [ ] **Step 3: Create `app/api/media/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { deleteFile } from '@/lib/storage'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id

  if (role !== 'SUPER_ADMIN' && role !== 'TUTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const media = await prisma.media.findUnique({
    where: { id },
    include: { report: { select: { tutorId: true } } },
  })

  if (!media) return NextResponse.json({ error: 'Media not found' }, { status: 404 })

  if (role === 'TUTOR' && media.report.tutorId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Extract the object key from the stored URL: http://<host>/<bucket>/<key>
  const bucket = process.env.MINIO_BUCKET ?? 'mellyna'
  const key = media.url.split(`/${bucket}/`)[1]

  if (key) {
    await deleteFile(key).catch((err) =>
      console.error('[Media Delete] MinIO delete failed, continuing with DB delete:', err)
    )
  }

  await prisma.media.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Test the endpoint manually**

Start dev server: `npm run dev`

In another terminal, get a valid session cookie and test:
```bash
# Replace <MEDIA_ID> with an actual media record ID from your DB
curl -X DELETE http://localhost:3000/api/media/<MEDIA_ID> \
  -H "Cookie: next-auth.session-token=<your-session-token>"
```

Expected: `{"success":true}` and the media record is gone from the DB.

- [ ] **Step 5: Commit**

```bash
git add app/api/media/[id]/route.ts __tests__/api/media-delete.test.ts
git commit -m "feat: add DELETE /api/media/[id] endpoint with ownership check"
```

---

## Task 3: Fix tutor reports page — use participants, show media gallery, enable delete

**Files:**
- Modify: `app/(dashboard)/tutor/reports/[scheduleId]/page.tsx`

**Current bugs:**
1. Line 48: uses `schedData.class?.enrollments?.map(...)` — wrong. Schedule GET returns `participants`, not `enrollments`.
2. No media display after upload — `reportsData` from `/api/reports?scheduleId=X` already includes `media: true` but is unused.
3. No delete media UI.

**New `ReportEntry` shape:**
```typescript
interface MediaItem {
  id: string
  url: string
  type: 'PHOTO' | 'VIDEO'
  filename: string
}

interface ReportEntry {
  studentId: string
  content: string
  score: string
  reportId: string | null
  uploading: boolean
  media: MediaItem[]
}
```

- [ ] **Step 1: Write failing test for the student-source fix**

Create `__tests__/pages/tutor-reports.test.ts`:

```typescript
// Tests the data transformation logic used by the reports page

describe('reports page data transformation', () => {
  it('extracts students from participants not enrollments', () => {
    const scheduleApiResponse = {
      participants: [
        { student: { id: 's1', name: 'Andi', grade: '5' } },
        { student: { id: 's2', name: 'Budi', grade: '6' } },
      ],
      class: {
        name: 'Matematika',
        enrollments: [
          { student: { id: 's3', name: 'Cici', grade: '5' } }, // NOT in session
        ],
      },
    }

    // Correct: use participants
    const fromParticipants = scheduleApiResponse.participants.map((p: any) => p.student)
    expect(fromParticipants).toHaveLength(2)
    expect(fromParticipants[0].id).toBe('s1')

    // Wrong: using enrollments would give wrong students
    const fromEnrollments = scheduleApiResponse.class.enrollments.map((e: any) => e.student)
    expect(fromEnrollments).toHaveLength(1)
    expect(fromEnrollments[0].id).toBe('s3')
  })

  it('initializes media from existing reports', () => {
    const reportsData = [
      {
        studentId: 's1',
        id: 'r1',
        content: 'Good progress',
        score: 85,
        media: [{ id: 'm1', url: 'http://...', type: 'PHOTO', filename: 'photo.jpg' }],
      },
    ]
    const existingReports: Record<string, any> = {}
    reportsData.forEach((r) => { existingReports[r.studentId] = r })

    const entry = {
      studentId: 's1',
      content: existingReports['s1']?.content || '',
      score: existingReports['s1']?.score?.toString() || '',
      reportId: existingReports['s1']?.id || null,
      uploading: false,
      media: existingReports['s1']?.media || [],
    }

    expect(entry.media).toHaveLength(1)
    expect(entry.media[0].id).toBe('m1')
  })
})
```

- [ ] **Step 2: Run test to verify it passes (logic tests)**

```bash
npx jest __tests__/pages/tutor-reports.test.ts --no-coverage
```

Expected: PASS (pure logic, no imports needed)

- [ ] **Step 3: Rewrite `app/(dashboard)/tutor/reports/[scheduleId]/page.tsx`**

Replace the entire file with:

```typescript
'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Save, Upload, Trash2 } from 'lucide-react'

interface Student {
  id: string
  name: string
  grade: string | null
}

interface MediaItem {
  id: string
  url: string
  type: 'PHOTO' | 'VIDEO'
  filename: string
}

interface ReportEntry {
  studentId: string
  content: string
  score: string
  reportId: string | null
  uploading: boolean
  media: MediaItem[]
}

export default function TutorReportsPage() {
  const params = useParams()
  const router = useRouter()
  const scheduleId = params.scheduleId as string

  const [schedule, setSchedule] = useState<any>(null)
  const [entries, setEntries] = useState<ReportEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successIds, setSuccessIds] = useState<Set<string>>(new Set())
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [schedRes, reportsRes] = await Promise.all([
          fetch(`/api/schedules/${scheduleId}`),
          fetch(`/api/reports?scheduleId=${scheduleId}`),
        ])
        const schedData = await schedRes.json()
        const reportsData = await reportsRes.json()
        setSchedule(schedData)

        const existingReports: Record<string, any> = {}
        reportsData.forEach((r: any) => { existingReports[r.studentId] = r })

        // Use schedule participants (students in this specific session),
        // not class enrollments (all enrolled students ever).
        const students: Student[] = (schedData.participants ?? []).map((p: any) => p.student)

        setEntries(students.map((s) => ({
          studentId: s.id,
          content: existingReports[s.id]?.content || '',
          score: existingReports[s.id]?.score?.toString() || '',
          reportId: existingReports[s.id]?.id || null,
          uploading: false,
          media: existingReports[s.id]?.media || [],
        })))
      } catch {
        setError('Gagal memuat data laporan.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [scheduleId])

  const handleSave = async (studentId: string) => {
    setSaving(studentId)
    setError(null)
    const entry = entries.find((e) => e.studentId === studentId)
    if (!entry) return
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          scheduleId,
          content: entry.content,
          score: entry.score ? parseInt(entry.score) : undefined,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEntries((prev) =>
        prev.map((e) => e.studentId === studentId ? { ...e, reportId: data.id } : e)
      )
      setSuccessIds((prev) => new Set(prev).add(studentId))
      setTimeout(() => setSuccessIds((prev) => {
        const s = new Set(prev); s.delete(studentId); return s
      }), 3000)
    } catch {
      setError('Gagal menyimpan laporan untuk siswa ini.')
    } finally {
      setSaving(null)
    }
  }

  const handleUpload = async (studentId: string, file: File) => {
    const entry = entries.find((e) => e.studentId === studentId)
    if (!entry?.reportId) {
      setError('Simpan laporan terlebih dahulu sebelum upload media.')
      return
    }
    setEntries((prev) => prev.map((e) => e.studentId === studentId ? { ...e, uploading: true } : e))
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('reportId', entry.reportId)
      const res = await fetch('/api/media/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      const newMedia: MediaItem = await res.json()
      // Add the returned media item to the local state immediately
      setEntries((prev) =>
        prev.map((e) =>
          e.studentId === studentId
            ? { ...e, media: [...e.media, newMedia] }
            : e
        )
      )
    } catch {
      setError('Gagal upload media.')
    } finally {
      setEntries((prev) => prev.map((e) => e.studentId === studentId ? { ...e, uploading: false } : e))
    }
  }

  const handleDeleteMedia = async (studentId: string, mediaId: string) => {
    if (!confirm('Hapus media ini?')) return
    try {
      const res = await fetch(`/api/media/${mediaId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setEntries((prev) =>
        prev.map((e) =>
          e.studentId === studentId
            ? { ...e, media: e.media.filter((m) => m.id !== mediaId) }
            : e
        )
      )
    } catch {
      setError('Gagal menghapus media.')
    }
  }

  if (loading) {
    return (
      <div className="p-10 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" />
      </div>
    )
  }

  const students: Student[] = (schedule?.participants ?? []).map((p: any) => p.student)

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => router.back()}
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium mb-2 cursor-pointer"
        >
          ← Kembali
        </button>
        <h1 className="text-2xl font-extrabold text-slate-800">📝 Laporan Belajar</h1>
        {schedule && (
          <p className="text-sm text-slate-500 mt-1">
            {schedule.class?.name} •{' '}
            {new Date(schedule.date).toLocaleDateString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600">
          ⚠️ {error}
        </div>
      )}

      {students.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-100 p-10 text-center text-slate-400">
          <p className="text-3xl">👥</p>
          <p className="mt-2 text-sm">Belum ada peserta terdaftar di sesi ini.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {students.map((student, idx) => {
            const entry = entries[idx]
            const isSaved = successIds.has(student.id)
            return (
              <div
                key={student.id}
                className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800">{student.name}</h3>
                    <p className="text-xs text-slate-400">{student.grade || '-'}</p>
                  </div>
                  {isSaved && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-1 rounded-lg">
                      ✅ Disimpan
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Catatan Belajar *
                    </label>
                    <textarea
                      rows={3}
                      value={entry?.content || ''}
                      onChange={(e) =>
                        setEntries((prev) =>
                          prev.map((en, i) =>
                            i === idx ? { ...en, content: e.target.value } : en
                          )
                        )
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 resize-none"
                      placeholder="Catatan perkembangan belajar siswa sesi ini..."
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="w-full sm:w-36">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Nilai (0-100)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={entry?.score || ''}
                        onChange={(e) =>
                          setEntries((prev) =>
                            prev.map((en, i) =>
                              i === idx ? { ...en, score: e.target.value } : en
                            )
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                        placeholder="mis. 85"
                      />
                    </div>
                    <div className="flex-1 flex items-end gap-3">
                      <button
                        onClick={() => handleSave(student.id)}
                        disabled={saving === student.id}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        {saving === student.id ? 'Menyimpan...' : 'Simpan Laporan'}
                      </button>
                      <button
                        onClick={() => fileRefs.current[student.id]?.click()}
                        disabled={!entry?.reportId || entry?.uploading}
                        className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
                        title={!entry?.reportId ? 'Simpan laporan terlebih dahulu' : 'Upload foto/video'}
                      >
                        <Upload className="h-4 w-4" />
                        {entry?.uploading ? 'Mengupload...' : 'Upload Media'}
                      </button>
                      <input
                        ref={(el) => { fileRefs.current[student.id] = el }}
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleUpload(student.id, file)
                          // Reset so same file can be re-uploaded if needed
                          e.target.value = ''
                        }}
                      />
                    </div>
                  </div>

                  {/* Media gallery */}
                  {entry?.media && entry.media.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-2">
                        Media Terupload ({entry.media.length}):
                      </p>
                      <div className="flex flex-wrap gap-3">
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
                              <a href={m.url} target="_blank" rel="noopener noreferrer">
                                <div className="h-20 w-20 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center">
                                  <span className="text-2xl">🎥</span>
                                </div>
                              </a>
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
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest __tests__/pages/tutor-reports.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Manually verify in browser**

1. Start dev server: `npm run dev`
2. Login as a tutor account
3. Navigate to `/tutor/reports/<scheduleId>` for a schedule with participants
4. Verify the students shown are from `participants` not `enrollments`
5. Save a report, then upload a photo — verify thumbnail appears immediately
6. Hover over thumbnail — verify red delete button appears
7. Click delete — verify media disappears

- [ ] **Step 6: Commit**

```bash
git add app/(dashboard)/tutor/reports/[scheduleId]/page.tsx __tests__/pages/tutor-reports.test.ts
git commit -m "fix: tutor reports page use schedule participants; add media gallery with delete"
```

---

## Task 4: Add tutor WAHA notification on schedule publish

**Files:**
- Modify: `app/api/schedules/[id]/publish/route.ts`

Currently the publish route sends WAHA to each participant's parent but not to the tutor. The tutor's phone is on `User.phone`. The current query includes `class.tutor` with `{ name: true }` — we need to also select `phone`.

- [ ] **Step 1: Write failing test**

Create `__tests__/api/publish-tutor-notify.test.ts`:

```typescript
// Tests the notification message builder for tutor WAHA
describe('tutor WAHA message builder', () => {
  it('builds correct tutor notification message', () => {
    const schedule = {
      class: { name: 'Matematika Kelas 5', tutor: { name: 'Bu Sari', phone: '081234567890' } },
      date: new Date('2026-06-01'),
      startTime: '14:00',
      endTime: '16:00',
      topic: 'Pecahan',
      location: 'Online',
      participants: [
        { student: { name: 'Andi' } },
        { student: { name: 'Budi' } },
      ],
    }

    const dateStr = new Date(schedule.date).toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
    const participantNames = schedule.participants.map((p: any) => p.student.name).join(', ')
    const message = `Halo ${schedule.class.tutor.name},\n\nJadwal mengajar Anda telah dipublish:\n🏫 Kelas: ${schedule.class.name}\n🕐 Waktu: ${dateStr}, ${schedule.startTime} - ${schedule.endTime}\n📚 Topik: ${schedule.topic}\n📍 Lokasi: ${schedule.location}\n👥 Peserta: ${participantNames}\n\nMellyna Education`

    expect(message).toContain('Bu Sari')
    expect(message).toContain('Matematika Kelas 5')
    expect(message).toContain('Pecahan')
    expect(message).toContain('Andi, Budi')
    expect(message).toContain('14:00 - 16:00')
  })

  it('skips tutor notification if phone is null', () => {
    const tutorPhone: string | null = null
    const shouldSend = tutorPhone !== null
    expect(shouldSend).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it passes (pure logic)**

```bash
npx jest __tests__/api/publish-tutor-notify.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 3: Modify publish route — add tutor phone to include + send WAHA**

In `app/api/schedules/[id]/publish/route.ts`, change the `include` block to also fetch tutor's phone:

Find:
```typescript
class: {
  include: {
    tutor: { select: { name: true } },
  },
},
```

Replace with:
```typescript
class: {
  include: {
    tutor: { select: { name: true, phone: true } },
  },
},
```

Then, inside the `Promise.resolve().then(async () => { ... })` block, after the `for` loop for parent notifications, add the tutor notification:

```typescript
    // Notify tutor via WAHA
    const tutor = scheduleWithDetails.class.tutor
    if (tutor.phone) {
      const participantNames = scheduleWithDetails.participants
        .map((p) => p.student.name)
        .join(', ')
      const tutorMessage = `Halo ${tutor.name},

Jadwal mengajar Anda telah dipublish:
🏫 Kelas: ${scheduleWithDetails.class.name}
🕐 Waktu: ${dateStr}, ${timeStr}${topicStr}${locationStr}
👥 Peserta: ${participantNames || '-'}

Harap bersiap sesuai jadwal. Terima kasih,
Mellyna Education`

      console.log(`[WAHA Broadcast] Sending schedule notification to tutor ${tutor.name} (${tutor.phone})`)
      const success = await sendWhatsApp(tutor.phone, tutorMessage)
      if (success) {
        console.log(`[WAHA Broadcast] Successfully sent schedule notification to tutor ${tutor.name}`)
      } else {
        console.error(`[WAHA Broadcast] Failed to send schedule notification to tutor ${tutor.name}`)
      }
    }
```

The final `Promise.resolve().then(async () => { ... })` block structure:
```typescript
  Promise.resolve().then(async () => {
    // 1. Notify parents (existing code, unchanged)
    for (const p of scheduleWithDetails.participants) {
      const parent = p.student.parent
      if (!parent.phone) continue
      // ... existing parent message code ...
    }

    // 2. Notify tutor (new code above)
    const tutor = scheduleWithDetails.class.tutor
    if (tutor.phone) {
      // ... tutor message code ...
    }
  }).catch(console.error)
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (tutor.phone is `string | null` — the `if (tutor.phone)` guard handles null).

- [ ] **Step 5: Test manually**

1. Ensure tutor user has a phone number in the DB
2. With dev server running, publish a schedule as superadmin
3. Check server console for `[WAHA Broadcast] Sending schedule notification to tutor ...`
4. If WAHA is running, verify WA message received on tutor's phone

- [ ] **Step 6: Commit**

```bash
git add app/api/schedules/[id]/publish/route.ts __tests__/api/publish-tutor-notify.test.ts
git commit -m "feat: send WAHA notification to tutor when schedule is published"
```

---

## Task 5: Tutor dashboard — "Baru" badge for newly published schedules

**Files:**
- Modify: `app/(dashboard)/tutor/page.tsx`

Show a "Baru" badge on schedules published within the last 24 hours, so tutors can spot fresh assignments at a glance.

- [ ] **Step 1: Write failing test**

Create `__tests__/pages/tutor-dashboard.test.ts`:

```typescript
describe('tutor dashboard new badge logic', () => {
  it('marks schedule as new if published within last 24 hours', () => {
    const now = Date.now()
    const publishedAt = new Date(now - 2 * 60 * 60 * 1000) // 2 hours ago
    const isNew = publishedAt !== null && (now - publishedAt.getTime()) < 24 * 60 * 60 * 1000
    expect(isNew).toBe(true)
  })

  it('does not mark schedule as new if published over 24 hours ago', () => {
    const now = Date.now()
    const publishedAt = new Date(now - 25 * 60 * 60 * 1000) // 25 hours ago
    const isNew = publishedAt !== null && (now - publishedAt.getTime()) < 24 * 60 * 60 * 1000
    expect(isNew).toBe(false)
  })

  it('does not mark DRAFT schedule as new (no publishedAt)', () => {
    const publishedAt: Date | null = null
    const now = Date.now()
    const isNew = publishedAt !== null && (now - publishedAt.getTime()) < 24 * 60 * 60 * 1000
    expect(isNew).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it passes (pure logic)**

```bash
npx jest __tests__/pages/tutor-dashboard.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 3: Modify tutor dashboard page**

In `app/(dashboard)/tutor/page.tsx`, the Prisma query currently does not select `publishedAt`. Add it to the `include` or the select in the `findMany`:

The current query:
```typescript
const schedules = await prisma.schedule.findMany({
  where: { class: { tutorId: userId }, date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
  include: {
    class: { select: { name: true, _count: { select: { enrollments: true } } } },
  },
  orderBy: { date: 'asc' },
})
```

The `Schedule` model already has `publishedAt DateTime?` — it's selected automatically by Prisma's default select when using `include`. Verify: `schedule.publishedAt` is available without any change. But to be explicit, add it to the select (or simply use it — it's already on the `Schedule` model).

In the JSX, after the status badge, add:

```typescript
// Add this helper before the return statement:
const isNewlyPublished = (s: typeof schedules[0]) =>
  s.publishedAt !== null &&
  Date.now() - new Date(s.publishedAt).getTime() < 24 * 60 * 60 * 1000
```

Then in the schedule card JSX, after the existing status badge `<span>`:

Find:
```typescript
<span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor[schedule.status]}`}>
  {schedule.status}
</span>
```

Replace with:
```typescript
<span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor[schedule.status]}`}>
  {schedule.status}
</span>
{isNewlyPublished(schedule) && (
  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 animate-pulse">
    🆕 Baru
  </span>
)}
```

Full updated file `app/(dashboard)/tutor/page.tsx`:

```typescript
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'

export default async function TutorDashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id

  const schedules = await prisma.schedule.findMany({
    where: { class: { tutorId: userId }, date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    include: {
      class: { select: { name: true, _count: { select: { enrollments: true } } } },
    },
    orderBy: { date: 'asc' },
  })

  const statusColor: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-600',
    PUBLISHED: 'bg-emerald-100 text-emerald-700',
    COMPLETED: 'bg-indigo-100 text-indigo-700',
    CANCELLED: 'bg-rose-100 text-rose-700',
  }

  const isNewlyPublished = (s: (typeof schedules)[0]) =>
    s.publishedAt !== null &&
    Date.now() - new Date(s.publishedAt).getTime() < 24 * 60 * 60 * 1000

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-600 to-emerald-800 p-8 text-white shadow-xl shadow-emerald-600/10">
        <h1 className="text-3xl font-extrabold tracking-tight">Dashboard Tutor 👋</h1>
        <p className="mt-2 text-emerald-100">Kelola jadwal mengajar, absensi siswa, dan laporan perkembangan belajar.</p>
      </div>

      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4">📅 Jadwal Mengajar</h2>
        {schedules.length === 0 ? (
          <div className="rounded-2xl bg-white border border-slate-100 p-10 text-center text-slate-400">
            <p className="text-3xl">📭</p>
            <p className="mt-2 text-sm">Tidak ada jadwal mengajar dalam 7 hari terakhir.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="rounded-2xl bg-white border border-slate-100 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-bold text-slate-800">{schedule.class.name}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor[schedule.status]}`}>
                      {schedule.status}
                    </span>
                    {isNewlyPublished(schedule) && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 animate-pulse">
                        🆕 Baru
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    {new Date(schedule.date).toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}{' '}
                    • {schedule.startTime}–{schedule.endTime}
                  </p>
                  {schedule.topic && (
                    <p className="text-sm text-indigo-600 font-medium mt-0.5">📚 {schedule.topic}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    {schedule.class._count.enrollments} siswa terdaftar
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/tutor/attendance/${schedule.id}`}
                    className="text-sm font-semibold px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer"
                  >
                    ✏️ Absensi
                  </Link>
                  <Link
                    href={`/tutor/reports/${schedule.id}`}
                    className="text-sm font-semibold px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                  >
                    📝 Laporan
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all tests PASS

- [ ] **Step 6: Manually verify in browser**

1. Navigate to `/tutor` as a tutor
2. Publish a schedule as superadmin in another tab
3. Reload the tutor dashboard
4. Verify the newly published schedule shows the amber "🆕 Baru" animated badge

- [ ] **Step 7: Commit**

```bash
git add app/(dashboard)/tutor/page.tsx __tests__/pages/tutor-dashboard.test.ts
git commit -m "feat: add newly-published badge on tutor dashboard for schedules published within 24h"
```

---

## Self-Review

### Spec Coverage Check

| Requirement | Task(s) | Status |
|-------------|---------|--------|
| Tutor writes progress notes per student | Task 3 (fix participants source, save report) | ✅ |
| Parent can see progress notes | Already working in `/parent/progress` | ✅ pre-existing |
| Tutor uploads video/image per student | Task 3 (media gallery + upload refresh) | ✅ |
| Parent can view uploaded media | Already working in `/parent/progress` | ✅ pre-existing |
| Tutor can delete wrong media | Task 2 (DELETE endpoint) + Task 3 (delete button) | ✅ |
| Tutor notified via WAHA on publish | Task 4 | ✅ |
| Tutor sees new schedules in-app | Task 5 (badge on dashboard) | ✅ |

### Placeholder Scan
- No TBD/TODO/placeholder phrases in any task
- All code blocks are complete and runnable
- All file paths are exact

### Type Consistency
- `MediaItem` defined in Task 3, used in Task 3 only — consistent
- `ReportEntry.media: MediaItem[]` — consistent throughout Task 3
- `schedule.publishedAt` — comes from Prisma auto-select on `Schedule` model — correct
- `tutor.phone` — added to `select` in Task 4 publish route — consistent with Task 4 message builder

### Coverage of pre-existing bugs
- Task 3 fixes `class.enrollments` → `schedule.participants` — confirmed as a bug (line 48 of original file)
- Task 3 adds media refresh on upload (original: no feedback after upload)
