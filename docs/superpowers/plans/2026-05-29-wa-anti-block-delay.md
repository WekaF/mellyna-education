# WA Anti-Block Delay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add random 3–7s delays between WhatsApp messages in all broadcast loops (cron + schedule publish) and in the n8n workflow, to mimic human behavior and avoid WhatsApp spam detection.

**Architecture:** Add a `sleep()` utility to `lib/waha.ts`, call it after each `sendWhatsApp()` in every loop. Update the n8n workflow JSON to add a Wait node (5s) between Split Recipients and Send WA. Fix wrong session name in n8n workflow ("default" → "mellyna").

**Tech Stack:** Next.js 14 App Router, TypeScript, WAHA (WhatsApp HTTP API), n8n workflow automation

---

## Anti-Block Strategy (Read Before Implementing)

WhatsApp bans numbers that look like bots. Delays alone are not enough — here's the full picture:

| Risk Factor | Status | Fix in This Plan |
|---|---|---|
| No delay between messages | ❌ Critical | ✅ Add random 3–7s delay |
| Fixed/identical delay (looks robotic) | ❌ | ✅ Randomized jitter |
| Wrong session name in n8n | ❌ Bug | ✅ Fix "default" → "mellyna" |
| n8n sends all recipients instantly | ❌ | ✅ Add Wait node |
| Messages vary per recipient | ✅ Already done | — |

**Additional recommendations (not in this plan — manual actions):**
- **Warm the number first**: Before bulk sends, manually send 20–30 messages over 3–5 days
- **Stay under 100 msgs/day** on a fresh number; under 300/day on established numbers
- **Don't send 3am–6am** (schedule crons for 7am–8pm WIB only)
- **Use WAHA `startTyping`** before send for extra realism (optional enhancement, not in this plan)
- **Avoid 100% identical message** to multiple contacts — already done (name/student varies) ✅

---

## File Structure

| File | Change |
|---|---|
| `lib/waha.ts` | Add `sleep()` and `randomDelay()` exports |
| `app/api/cron/billing-reminders/route.ts` | Add delay after each `sendWhatsApp()` in both loops |
| `app/api/schedules/[id]/publish/route.ts` | Add delay in broadcast loop |
| `app/api/cron/timetable-generate/route.ts` | Add delay in broadcast loop |
| `docs/n8n-schedule-workflow.json` | Add Wait node (5s) + fix session "default" → "mellyna" |

---

## Task 1: Add `sleep()` Utility to `lib/waha.ts`

**Files:**
- Modify: `lib/waha.ts`

- [ ] **Step 1: Read current file**

```bash
cat lib/waha.ts
```

File is 32 lines. Confirm it matches the version in this plan.

- [ ] **Step 2: Add sleep helpers at the top of the file**

Add these two functions **before** the existing `sendWhatsApp` function. Full new file content:

```typescript
const WAHA_BASE = process.env.WAHA_BASE_URL ?? 'http://localhost:3001'
const WAHA_KEY = process.env.WAHA_API_KEY ?? ''
const WAHA_SESSION = process.env.WAHA_SESSION ?? 'mellyna'

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Returns random ms between min and max (inclusive)
export function randomDelay(minMs = 3000, maxMs = 7000): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
}

export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  const chatId = `${phone.replace(/\D/g, '').replace(/^0/, '62')}@c.us`
  try {
    const res = await fetch(`${WAHA_BASE}/api/sendText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': WAHA_KEY },
      body: JSON.stringify({ session: WAHA_SESSION, chatId, text: message }),
    })
    return res.ok
  } catch (e) {
    console.error('[Mellyna] WAHA send failed:', e)
    return false
  }
}

export async function getSessionStatus(): Promise<string> {
  try {
    const res = await fetch(`${WAHA_BASE}/api/sessions/${WAHA_SESSION}`, {
      headers: { 'X-Api-Key': WAHA_KEY },
    })
    if (!res.ok) return 'UNKNOWN'
    const data = await res.json()
    return data.status ?? 'UNKNOWN'
  } catch {
    return 'OFFLINE'
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
rtk tsc --noEmit
```

Expected: no errors related to `lib/waha.ts`.

- [ ] **Step 4: Commit**

```bash
rtk git add lib/waha.ts && rtk git commit -m "feat(waha): add sleep() and randomDelay() utilities"
```

---

## Task 2: Add Delay in `billing-reminders` Cron

**Files:**
- Modify: `app/api/cron/billing-reminders/route.ts`

- [ ] **Step 1: Update the import line at top of file**

Current import line (line 3):
```typescript
import { sendWhatsApp } from '@/lib/waha'
```

Replace with:
```typescript
import { sendWhatsApp, sleep, randomDelay } from '@/lib/waha'
```

- [ ] **Step 2: Add delay in the 7-day reminder loop (lines ~55–84)**

Find this block (the end of the 7-day loop body):
```typescript
      console.log(`[Billing Cron] Sending 7-day reminder to parent ${parent.name} (${parent.phone}) for Invoice ${inv.id}`)
      const success = await sendWhatsApp(parent.phone, message)
      if (success) dueReminderCount++
    }
```

Replace with:
```typescript
      console.log(`[Billing Cron] Sending 7-day reminder to parent ${parent.name} (${parent.phone}) for Invoice ${inv.id}`)
      const success = await sendWhatsApp(parent.phone, message)
      if (success) dueReminderCount++
      await sleep(randomDelay(3000, 7000))
    }
```

- [ ] **Step 3: Add delay in the overdue reminder loop (lines ~104–134)**

Find this block (the end of the overdue loop body):
```typescript
      console.log(`[Billing Cron] Sending overdue reminder to parent ${parent.name} (${parent.phone}) for Invoice ${inv.id}`)
      const success = await sendWhatsApp(parent.phone, message)
      if (success) overdueReminderCount++
    }
```

Replace with:
```typescript
      console.log(`[Billing Cron] Sending overdue reminder to parent ${parent.name} (${parent.phone}) for Invoice ${inv.id}`)
      const success = await sendWhatsApp(parent.phone, message)
      if (success) overdueReminderCount++
      await sleep(randomDelay(3000, 7000))
    }
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
rtk tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
rtk git add app/api/cron/billing-reminders/route.ts && rtk git commit -m "feat(cron): add random 3-7s delay between billing reminder WA messages"
```

---

## Task 3: Add Delay in Schedule Publish Broadcast

**Files:**
- Modify: `app/api/schedules/[id]/publish/route.ts`

- [ ] **Step 1: Update the import line**

Find:
```typescript
import { sendWhatsApp } from '@/lib/waha'
```

Replace with:
```typescript
import { sendWhatsApp, sleep, randomDelay } from '@/lib/waha'
```

- [ ] **Step 2: Add delay in the participants loop**

Find the loop in the async block (around line 62–88). The loop sends to participants then to the tutor. Find the end of participant send:
```typescript
      await sendWhatsApp(parent.phone, message)
    }
```

The loop that iterates over participants. Find:
```typescript
    for (const p of scheduleWithDetails.participants) {
      const parent = p.student.parent
      if (!parent.phone) continue
```

And find the `await sendWhatsApp(parent.phone, message)` call inside this loop. Add sleep after it:

```typescript
      await sendWhatsApp(parent.phone, message)
      await sleep(randomDelay(3000, 7000))
    }
```

- [ ] **Step 3: Read the full publish route to find the exact location**

```bash
cat "app/api/schedules/[id]/publish/route.ts"
```

Confirm the loop structure matches — add `await sleep(randomDelay(3000, 7000))` after each `sendWhatsApp` call inside loops (participants loop AND before tutor send if there is a tutor send after the loop).

- [ ] **Step 4: Verify TypeScript compiles**

```bash
rtk tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
rtk git add "app/api/schedules/[id]/publish/route.ts" && rtk git commit -m "feat(schedules): add random 3-7s delay between publish broadcast WA messages"
```

---

## Task 4: Add Delay in Timetable Generate Broadcast

**Files:**
- Modify: `app/api/cron/timetable-generate/route.ts`

- [ ] **Step 1: Update the import line**

Find:
```typescript
import { sendWhatsApp } from '@/lib/waha'
```

Replace with:
```typescript
import { sendWhatsApp, sleep, randomDelay } from '@/lib/waha'
```

- [ ] **Step 2: Add delay after each message in the async broadcast block**

In the `Promise.resolve().then(async () => { ... })` block (around line 147), find the participants loop:
```typescript
          await sendWhatsApp(parent.phone, message)
        }
```

Add sleep after the send:
```typescript
          await sendWhatsApp(parent.phone, message)
          await sleep(randomDelay(3000, 7000))
        }
```

Also find the tutor message send (around line 183):
```typescript
          await sendWhatsApp(c.tutor.phone, tutorMessage)
        }
```

Add sleep before closing brace of the `if (c.tutor.phone)` block:
```typescript
          await sendWhatsApp(c.tutor.phone, tutorMessage)
          await sleep(randomDelay(3000, 7000))
        }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
rtk tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
rtk git add app/api/cron/timetable-generate/route.ts && rtk git commit -m "feat(cron): add random 3-7s delay between timetable broadcast WA messages"
```

---

## Task 5: Update n8n Workflow — Add Wait Node + Fix Session

**Files:**
- Modify: `docs/n8n-schedule-workflow.json`

This task has two fixes:
1. Add a `Wait` node (5 seconds) between `Split Recipients` and `Send WA via WAHA`
2. Fix wrong session name: `"default"` → `"mellyna"` in the Send WA node

- [ ] **Step 1: Fix session name in Send WA node**

In `docs/n8n-schedule-workflow.json`, find (around line 71):
```json
"jsonBody": "={\n  \"session\": \"default\",\n
```

Replace `"default"` with `"mellyna"`:
```json
"jsonBody": "={\n  \"session\": \"mellyna\",\n
```

- [ ] **Step 2: Add Wait node to the nodes array**

After the `Split Recipients` node entry and before `Send WA via WAHA`, insert a new Wait node into the `"nodes"` array. The full updated `nodes` array should be:

```json
"nodes": [
  {
    "parameters": {
      "httpMethod": "POST",
      "path": "schedule-published",
      "options": {}
    },
    "id": "d0beea66-993d-4c3e-9080-2a819b52a559",
    "name": "Webhook Trigger",
    "type": "n8n-nodes-base.webhook",
    "typeVersion": 1.1,
    "position": [220, 240]
  },
  {
    "parameters": {
      "url": "=http://host.docker.internal:3000/api/internal/schedule-notify/{{ $json.body.scheduleId }}",
      "sendHeaders": true,
      "headerParameters": {
        "parameters": [
          {
            "name": "x-internal-secret",
            "value": "change-this-to-random-secret"
          }
        ]
      },
      "options": {}
    },
    "id": "e96d2746-13a8-48b4-82ee-c7b744d033ef",
    "name": "Fetch Schedule Details",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [440, 240]
  },
  {
    "parameters": {
      "fieldToSplitOut": "recipients",
      "options": {}
    },
    "id": "a98d3637-293d-4c6f-9988-c7a8b9e02312",
    "name": "Split Recipients",
    "type": "n8n-nodes-base.itemLists",
    "typeVersion": 3.1,
    "position": [660, 240]
  },
  {
    "parameters": {
      "amount": 5,
      "unit": "seconds"
    },
    "id": "b2c4e8f1-a3d5-47e9-b6c8-d9f2a1e4b7c3",
    "name": "Wait 5 Seconds",
    "type": "n8n-nodes-base.wait",
    "typeVersion": 1.1,
    "position": [880, 240],
    "webhookId": "c3d5e7f9-b1a3-45c7-d9e1-f3b5a7c9d1e3"
  },
  {
    "parameters": {
      "method": "POST",
      "url": "http://host.docker.internal:3001/api/sendText",
      "sendHeaders": true,
      "headerParameters": {
        "parameters": [
          {
            "name": "X-Api-Key",
            "value": "mellyna-waha-secret"
          }
        ]
      },
      "sendBody": true,
      "specifyBody": "json",
      "jsonBody": "={\n  \"session\": \"mellyna\",\n  \"chatId\": \"{{ $json.parentPhone.replace(/\\D/g, '').replace(/^0/, '62') }}@c.us\",\n  \"text\": \"Halo *{{ $json.parentName }}*,\\n\\nJadwal belajar baru untuk anak Anda *{{ $json.studentName }}* telah diterbitkan!\\n\\n🎓 *Kelas*: {{ $json.className }}\\n📚 *Materi*: {{ $json.topic }}\\n📅 *Tanggal*: {{ $json.date }}\\n⏰ *Waktu*: {{ $json.startTime }} - {{ $json.endTime }}\\n\\nSampai jumpa di kelas! 📚🎓\"\n}",
      "options": {}
    },
    "id": "f8a9a463-c7c1-45cf-81ff-3fa8a9c2b451",
    "name": "Send WA via WAHA",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [1100, 240]
  }
]
```

- [ ] **Step 3: Update the `connections` to route through Wait node**

Replace the entire `"connections"` section with:

```json
"connections": {
  "Webhook Trigger": {
    "main": [[{ "node": "Fetch Schedule Details", "type": "main", "index": 0 }]]
  },
  "Fetch Schedule Details": {
    "main": [[{ "node": "Split Recipients", "type": "main", "index": 0 }]]
  },
  "Split Recipients": {
    "main": [[{ "node": "Wait 5 Seconds", "type": "main", "index": 0 }]]
  },
  "Wait 5 Seconds": {
    "main": [[{ "node": "Send WA via WAHA", "type": "main", "index": 0 }]]
  }
}
```

- [ ] **Step 4: Validate JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('docs/n8n-schedule-workflow.json', 'utf8')); console.log('JSON valid')"
```

Expected: `JSON valid`

- [ ] **Step 5: Import updated workflow into n8n**

After saving the file, open n8n UI → Workflows → import `docs/n8n-schedule-workflow.json` to replace the old workflow. Re-activate the workflow after import.

- [ ] **Step 6: Commit**

```bash
rtk git add docs/n8n-schedule-workflow.json && rtk git commit -m "fix(n8n): add 5s wait between recipients, fix session name default→mellyna"
```

---

## Self-Review

### Spec Coverage

| Requirement | Covered |
|---|---|
| Delay ~3-5 seconds between WA sends | ✅ Task 1-4: random 3-7s |
| n8n workflow delay | ✅ Task 5: Wait node 5s |
| Anti-block recommendations | ✅ Documented in strategy section |
| Fix session bug in n8n | ✅ Task 5 Step 1 |

### Placeholder Scan

No TBDs. All code blocks are complete. All commands are exact.

### Type Consistency

- `sleep(ms: number): Promise<void>` — used as `await sleep(randomDelay())` everywhere ✅
- `randomDelay(minMs?, maxMs?): number` — called with explicit `(3000, 7000)` everywhere ✅
- Import `{ sendWhatsApp, sleep, randomDelay }` added to all 3 route files ✅
