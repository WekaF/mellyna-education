# Fix CI/CD Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken CI/CD pipeline so that every push to `main` runs lint/tests and auto-deploys via Docker to the production server.

**Architecture:** GitHub Actions CI runs lint + TypeScript + Jest on push. Deploy job builds Docker image, pushes to GitHub Container Registry (GHCR), then SSH-deploys to Sumopod server pulling `ghcr.io/wekaf/mellyna-education:latest`.

**Tech Stack:** GitHub Actions, Docker, GHCR, Sumopod VPS, Next.js 15, Prisma, PostgreSQL

---

## Current State

Workflows exist but **all runs fail**. Two root causes:

1. **GitHub account billing lock** — jobs fail with `"account locked due to billing issue"`. This is a hard blocker that only the account owner can fix at [github.com/settings/billing](https://github.com/settings/billing). **Fix billing first before any other task matters.**

2. **`docker-compose.prod.yml` image mismatch** — `app` service uses `image: mellyna-app:latest` + `pull_policy: never`. Deploy workflow pushes to `ghcr.io/wekaf/mellyna-education:latest` then runs `docker compose pull app` — which silently no-ops because `pull_policy: never` prevents the pull. Container never updates.

3. **No GitHub `production` environment** — `deploy.yml` declares `environment: production` but the environment doesn't exist in the repo, so deployment secrets can't be stored there.

4. **No secrets configured** — `SUMOPOD_HOST`, `SUMOPOD_USER`, `SUMOPOD_SSH_KEY` are all missing.

---

## File Structure

- Modify: `.github/workflows/deploy.yml` — no changes needed, workflow is correct
- Modify: `docker-compose.prod.yml` — fix app image + pull_policy
- GitHub config (via `gh` CLI) — create environment + set secrets

---

## Task 1: Fix docker-compose.prod.yml Image Reference

**Files:**
- Modify: `docker-compose.prod.yml`

The `app` service must reference the GHCR image that the deploy workflow actually builds and pushes.

- [ ] **Step 1: Open docker-compose.prod.yml and find the app service**

Current content (lines 24-26):
```yaml
  app:
    image: mellyna-app:latest
    pull_policy: never
```

- [ ] **Step 2: Replace with GHCR image reference**

New content:
```yaml
  app:
    image: ghcr.io/wekaf/mellyna-education:latest
    pull_policy: always
```

Edit `docker-compose.prod.yml`, change:
```
    image: mellyna-app:latest
    pull_policy: never
```
To:
```
    image: ghcr.io/wekaf/mellyna-education:latest
    pull_policy: always
```

- [ ] **Step 3: Verify the change**

Run:
```bash
grep -A2 "^  app:" docker-compose.prod.yml
```
Expected output:
```
  app:
    image: ghcr.io/wekaf/mellyna-education:latest
    pull_policy: always
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.prod.yml
git commit -m "fix(deploy): use GHCR image in prod compose, allow pull"
```

---

## Task 2: Create GitHub Production Environment

**Files:** GitHub repo settings (via `gh` CLI)

The `deploy.yml` workflow has `environment: production`. Without this environment existing, the deployment job can't gate on it or read its secrets.

- [ ] **Step 1: Create the production environment**

```bash
gh api --method PUT repos/WekaF/mellyna-education/environments/production \
  --field wait_timer=0
```

Expected: JSON response with `"name": "production"`

- [ ] **Step 2: Verify environment was created**

```bash
gh api repos/WekaF/mellyna-education/environments
```

Expected: `"total_count": 1` with `"name": "production"` in environments array

---

## Task 3: Set Required GitHub Secrets

**Files:** GitHub repo secrets (via `gh` CLI)

> ⚠️ **USER ACTION REQUIRED:** You must provide the actual values for these secrets. The subagent cannot know your server credentials. Fill in the values below before running the commands.

Three secrets are needed for the deploy workflow:

| Secret | Description | Where to find |
|--------|-------------|---------------|
| `SUMOPOD_HOST` | Server IP or hostname | Sumopod dashboard → your VPS IP |
| `SUMOPOD_USER` | SSH username | Usually `root` or your configured user |
| `SUMOPOD_SSH_KEY` | Private SSH key (full contents) | `~/.ssh/id_rsa` or your Sumopod key |

- [ ] **Step 1: Set SUMOPOD_HOST**

```bash
gh secret set SUMOPOD_HOST --body "YOUR_SERVER_IP_HERE"
```

- [ ] **Step 2: Set SUMOPOD_USER**

```bash
gh secret set SUMOPOD_USER --body "YOUR_SSH_USER_HERE"
```

- [ ] **Step 3: Set SUMOPOD_SSH_KEY**

```bash
# On your local machine, get the private key:
# cat ~/.ssh/id_rsa
# Then set it:
gh secret set SUMOPOD_SSH_KEY --body "$(cat ~/.ssh/id_rsa)"
```

Or interactively (safer for multiline key):
```bash
gh secret set SUMOPOD_SSH_KEY
# Then paste the key contents when prompted
```

- [ ] **Step 4: Verify secrets are set**

```bash
gh secret list
```

Expected output shows `SUMOPOD_HOST`, `SUMOPOD_USER`, `SUMOPOD_SSH_KEY` all listed.

---

## Task 4: Verify Server Directory Structure

**Files:** Remote server at `/opt/mellyna-education`

The deploy script does `cd /opt/mellyna-education && docker compose -f docker-compose.prod.yml pull app`. The directory and compose file must exist on the server.

- [ ] **Step 1: Check server has required files**

SSH into the server and verify:
```bash
ssh $SUMOPOD_USER@$SUMOPOD_HOST "ls /opt/mellyna-education/"
```

Expected: `docker-compose.prod.yml`, `.env` (or `.env.production`), `Caddyfile` exist

- [ ] **Step 2: If directory missing, create it and copy files**

```bash
ssh $SUMOPOD_USER@$SUMOPOD_HOST "mkdir -p /opt/mellyna-education"
scp docker-compose.prod.yml Caddyfile $SUMOPOD_USER@$SUMOPOD_HOST:/opt/mellyna-education/
```

- [ ] **Step 3: Verify .env file exists on server with all required vars**

```bash
ssh $SUMOPOD_USER@$SUMOPOD_HOST "cat /opt/mellyna-education/.env"
```

Must contain at minimum:
```
DATABASE_URL=postgresql://...
NEXTAUTH_URL=https://mellyna-education.my.id
NEXTAUTH_SECRET=<32+ char secret>
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_SERVER_KEY=...
MIDTRANS_CLIENT_KEY=...
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=...
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
N8N_WEBHOOK_BASE_URL=...
N8N_WEBHOOK_SECRET=...
WAHA_API_KEY=...
POSTGRES_USER=mellyna
POSTGRES_PASSWORD=...
POSTGRES_DB=mellyna_education
```

---

## Task 5: Verify and Test CI Pipeline

**After billing is fixed and secrets are set:**

- [ ] **Step 1: Trigger a test CI run**

```bash
gh workflow run ci.yml --ref main
```

- [ ] **Step 2: Watch the run**

```bash
gh run watch
```

Expected: All steps pass (checkout → node setup → npm ci → prisma generate → prisma migrate → tsc → lint → test)

- [ ] **Step 3: Trigger deploy run**

```bash
gh workflow run deploy.yml --ref main
```

- [ ] **Step 4: Watch deploy run**

```bash
gh run watch
```

Expected: build-and-push succeeds, deploy SSH step succeeds, app restarts with new image

- [ ] **Step 5: Verify app is running**

```bash
curl -I https://mellyna-education.my.id
```

Expected: `HTTP/2 200`

---

## Blocker Summary

| Blocker | Who fixes | How |
|---------|-----------|-----|
| GitHub billing lock | Account owner (WekaF) | Go to github.com/settings/billing → resolve payment |
| Server SSH credentials | You | Provide values in Task 3 |
| Server .env file | You | Ensure all env vars set on server |

Tasks 1 and 2 can be done now (code changes + env creation). Tasks 3-5 require user action first.
