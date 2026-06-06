# Video Compression & Multi-Upload Hints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Server-side compress all uploaded videos before storing to MinIO (H.264 CRF 28, max 720p), and add UI hints guiding tutors to upload ≥2 videos per student (one per program).

**Architecture:** Tutor uploads raw video → upload API writes temp file → ffmpeg compresses (H.264 CRF28, 720p, AAC 96k) → compressed buffer stored to MinIO → Media record saved with compressed size. Frontend adds informational badge showing video count and hint to upload ≥2 videos.

**Tech Stack:** fluent-ffmpeg, ffmpeg-static, Node.js temp files, MinIO (existing), Next.js App Router API

---

### Task 1: Install ffmpeg packages

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install runtime + types**

```bash
npm install fluent-ffmpeg ffmpeg-static
npm install -D @types/fluent-ffmpeg
```

Expected: packages added to package.json, no errors

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install fluent-ffmpeg and ffmpeg-static for video compression"
```

---

### Task 2: Create video compression utility

**Files:**
- Create: `lib/video-compress.ts`

- [ ] **Step 1: Write the utility**

```typescript
// lib/video-compress.ts
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeFile, readFile, unlink } from 'fs/promises'
import { randomUUID } from 'crypto'

if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic)

export async function compressVideo(inputBuffer: Buffer, originalName: string): Promise<{ buffer: Buffer; filename: string }> {
  const id = randomUUID()
  const ext = originalName.split('.').pop() || 'mp4'
  const inputPath = join(tmpdir(), `${id}-in.${ext}`)
  const outputPath = join(tmpdir(), `${id}-out.mp4`)

  await writeFile(inputPath, inputBuffer)

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .audioBitrate('96k')
      .addOption('-crf', '28')
      .addOption('-preset', 'fast')
      .addOption('-vf', 'scale=iw*min(1\\,min(1280/iw\\,720/ih)):ih*min(1\\,min(1280/iw\\,720/ih)),setsar=1')
      .addOption('-movflags', '+faststart')
      .format('mp4')
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run()
  })

  const compressed = await readFile(outputPath)
  const baseName = originalName.replace(/\.[^.]+$/, '')
  const filename = `${baseName}-compressed.mp4`

  await Promise.allSettled([unlink(inputPath), unlink(outputPath)])

  return { buffer: compressed, filename }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/video-compress.ts
git commit -m "feat: add video compression utility (H.264 CRF28, 720p, AAC 96k)"
```

---

### Task 3: Update upload API with compression

**Files:**
- Modify: `app/api/media/upload/route.ts`

- [ ] **Step 1: Update route with compression**

Replace the file with:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { uploadFile } from '@/lib/storage'
import { prisma } from '@/lib/db'
import { compressVideo } from '@/lib/video-compress'

const MAX_RAW_SIZE = 500 * 1024 * 1024 // 500MB raw input allowed (compressed before storing)

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id
  if (role !== 'SUPER_ADMIN' && role !== 'TUTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const reportId = formData.get('reportId') as string | null

    if (!file) return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 400 })
    if (!reportId) return NextResponse.json({ error: 'reportId diperlukan.' }, { status: 400 })

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      return NextResponse.json({ error: 'Hanya file gambar atau video yang diizinkan.' }, { status: 400 })
    }

    if (file.size > MAX_RAW_SIZE) {
      return NextResponse.json({ error: 'Ukuran file melebihi batas 500MB.' }, { status: 400 })
    }

    const report = await prisma.learningReport.findUnique({ where: { id: reportId } })
    if (!report) return NextResponse.json({ error: 'Report tidak ditemukan.' }, { status: 404 })
    if (role === 'TUTOR' && report.tutorId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let buffer = Buffer.from(await file.arrayBuffer())
    let filename = file.name
    const isVideo = file.type.startsWith('video/')

    if (isVideo) {
      const compressed = await compressVideo(buffer, file.name)
      buffer = compressed.buffer
      filename = compressed.filename
    }

    const url = await uploadFile(buffer, filename, isVideo ? 'video/mp4' : file.type)

    const media = await prisma.media.create({
      data: {
        reportId,
        url,
        type: isVideo ? 'VIDEO' : 'PHOTO',
        filename,
        size: buffer.length,
      },
    })

    return NextResponse.json(media, { status: 201 })
  } catch (error) {
    console.error('[Media Upload Error]', error)
    return NextResponse.json({ error: 'Gagal mengupload file.' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/media/upload/route.ts
git commit -m "feat: compress video before storing to MinIO (H.264 CRF28, max 720p)"
```

---

### Task 4: Update tutor reports UI

**Files:**
- Modify: `app/(dashboard)/tutor/reports/[scheduleId]/page.tsx`

Key changes:
- Add video count badge (separate from total media count)
- Add hint text "Upload min. 2 video (1 per program)" below upload button
- Soft warning indicator if < 2 videos uploaded (amber badge, non-blocking)

- [ ] **Step 1: Update media section display**

In the media display section, replace:
```tsx
<p className="text-xs font-semibold text-slate-500 mb-2">
  Media Terupload ({entry.media.length}):
</p>
```

With:
```tsx
<div className="flex items-center gap-2 mb-2">
  <p className="text-xs font-semibold text-slate-500">
    Media Terupload ({entry.media.length}):
  </p>
  {(() => {
    const videoCount = entry.media.filter(m => m.type === 'VIDEO').length
    return videoCount < 2 ? (
      <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-lg">
        📹 {videoCount}/2 video
      </span>
    ) : (
      <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-lg">
        📹 {videoCount} video ✓
      </span>
    )
  })()}
</div>
```

- [ ] **Step 2: Add upload hint below upload button**

After the `<input type="file" .../>` element, add:
```tsx
<p className="text-xs text-slate-400 mt-1">
  Upload min. 2 video laporan (1 per program)
</p>
```

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/tutor/reports/[scheduleId]/page.tsx
git commit -m "feat: add multi-video upload hints and video count badge on tutor report page"
```
