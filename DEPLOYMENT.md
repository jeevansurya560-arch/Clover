# Clover 🍀 — Full Cloudflare & Supabase Deployment Guide

This guide provides end-to-end instructions for deploying **Clover** to **Cloudflare Workers** with **Supabase PostgreSQL** as the database, native **Cloudflare Durable Objects** for real-time WebSockets, **Cloudflare Cron Triggers** for scheduled jobs, and an automated **GitHub Actions Keep-Alive** workflow to prevent Supabase Free tier inactivity pausing.

---

## Architecture Overview

| Layer | Local Development | Cloudflare Production |
| :--- | :--- | :--- |
| **Frontend** | Next.js 15 App Router (`localhost:3000`) | Cloudflare Workers Static Assets (`apps/web/out`) |
| **API** | Fastify REST API (`localhost:4000`) | Cloudflare Worker Fetch Router |
| **Database** | Docker PostgreSQL 16 (`localhost:5432`) | Supabase PostgreSQL 16 (Connection Pooler :6543) |
| **Real-Time** | Socket.IO + Transactional Outbox | Cloudflare Durable Objects (`HouseholdRealtimeDO`) + WebSockets |
| **Background Jobs** | BullMQ + Redis (`apps/worker`) | Cloudflare Cron Triggers (`0 * * * *`, `0 4 * * *`) |
| **Backups & Keep-Alive** | Local scripts (`npm run db:backup`) | GitHub Actions Daily Scheduled Workflow (`.github/workflows/supabase-keepalive.yml`) |

---

## Step 1: Supabase Project Setup

1. **Create a Supabase Project:**
   - Go to [supabase.com](https://supabase.com) and create a new project (e.g. `clover-prod`).
   - Select your preferred cloud region and record your database password.

2. **Retrieve Connection Strings & API Keys:**
   - Go to **Project Settings > Database**:
     - **Connection String (Transaction Pooler - Port 6543):**  
       `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require`
   - Go to **Project Settings > API**:
     - **Project URL:** `https://[PROJECT-REF].supabase.co`
     - **anon / public key:** `eyJhbGci...`
     - **service_role key:** `eyJhbGci...` (keep secret)

3. **Run Database Migrations & RLS:**
   In your local terminal with the Supabase connection string:
   ```bash
   DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require" npm run db:migrate
   ```
   This automatically executes:
   - `supabase/migrations/20261122000000_init_roomsync.sql` (Creates all 17 normalized relational tables and indexes)
   - `supabase/migrations/20261123000000_supabase_rls.sql` (Enables Row-Level Security and multi-tenant household isolation policies)

4. **Seed Initial Household Data (Optional):**
   ```bash
   DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require" npm run db:seed
   ```

---

## Step 2: Cloudflare Account & Wrangler Setup

1. **Prerequisites:**
   - A Cloudflare account at [dash.cloudflare.com](https://dash.cloudflare.com).
   - Ensure you have **Workers** enabled.
   - For Durable Objects, a Workers Paid plan ($5/mo) is standard for stateful WebSocket coordination.

2. **Authenticate Wrangler Locally:**
   ```bash
   npx wrangler login
   ```

3. **Verify `wrangler.jsonc` Configuration:**
   The repository includes a pre-configured `wrangler.jsonc` at the root that binds:
   - Next.js static asset serving (`apps/web/out`)
   - Durable Object `HouseholdRealtimeDO`
   - Cron Triggers (`0 * * * *`, `0 4 * * *`)
   - NodeJS compatibility flag (`nodejs_compat`)

4. **Set Production Secrets on Cloudflare:**
   Run the following commands to store sensitive secrets securely in Cloudflare:
   ```bash
   # Supabase Database Connection String (Transaction Pooler)
   npx wrangler secret put DATABASE_URL --env production

   # Application JWT Signing Secret (Minimum 32 random characters)
   npx wrangler secret put JWT_SECRET --env production

   # Supabase API Credentials
   npx wrangler secret put SUPABASE_URL --env production
   npx wrangler secret put SUPABASE_ANON_KEY --env production
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production
   ```

---

## Step 3: Deploying to Cloudflare

### Manual Deployment from CLI
Build the Next.js frontend and deploy the unified worker:
```bash
npm run deploy:cf
```
This runs:
1. `npm run build --workspace=apps/web` (Generates optimized static HTML/JS/CSS in `apps/web/out`)
2. `npx wrangler deploy --env production` (Uploads assets, creates Durable Object bindings, and deploys the worker)

### Automated GitHub-Connected Deployment
The repository includes `.github/workflows/deploy-cloudflare.yml`.
To activate automatic deployments on `git push origin main`:

1. In GitHub, navigate to **Settings > Secrets and variables > Actions**.
2. Add the following repository secrets:
   - `CLOUDFLARE_API_TOKEN`: Cloudflare API Token with *Workers:Edit* permissions.
   - `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare Account ID (found on the Workers overview page).
   - `DATABASE_URL`: Supabase PostgreSQL Transaction Pooler connection string.
   - `JWT_SECRET`: High-entropy 32+ character JWT secret.
   - `SUPABASE_URL`: Supabase project URL.
   - `SUPABASE_ANON_KEY`: Supabase anon key.
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key.

Every push to `main` will build and deploy to **Production**, and pull requests will deploy to the isolated **Preview** environment.

---

## Step 4: Supabase Free-Plan Keep-Alive Configuration

Supabase Free tier projects may auto-pause after ~3 days of inactivity. Clover includes an automated keep-alive routine that prevents pausing without generating synthetic user data or dummy database rows.

### How It Works
- The workflow `.github/workflows/supabase-keepalive.yml` triggers automatically every 24 hours at 04:00 UTC via GitHub Actions scheduled cron.
- It executes `scripts/supabase-keepalive.js`.
- It issues a non-destructive read query (`GET /rest/v1/households?select=id&limit=1` or direct `SELECT 1`) to verify database responsiveness.
- It retries up to 3 times with exponential backoff on transient network glitches.
- It masks all sensitive credentials in the log output.

### Setting Up Keep-Alive Secrets
In GitHub **Settings > Secrets and variables > Actions**, ensure these secrets are present:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `DATABASE_URL`

### Manual Verification
You can manually test the keep-alive routine anytime:
1. In GitHub, go to the **Actions** tab.
2. Select **Supabase Inactivity Keep-Alive** in the left sidebar.
3. Click **Run workflow > Run workflow**.
4. Check the logs to confirm the check succeeded.

> **Limitations Note:** Scheduled read probes keep the Supabase project active under current Supabase Free tier inactivity policies. However, project pausing heuristics may change over time. Critical production deployments with strict SLAs should consider Supabase Pro for guaranteed zero-pause uptime.

---

## Step 5: Real-Time WebSockets on Cloudflare

- When deployed on Cloudflare Workers, real-time connectivity switches from Socket.IO to native WebSockets powered by **Cloudflare Durable Objects** (`HouseholdRealtimeDO`).
- Each household (`householdId`) has an isolated Durable Object instance at the edge that coordinates active connections and broadcasts financial updates, chore completions, and shopping list changes.
- The client-side adapter in [apps/web/lib/socket.js](file:///c:/Users/user/Desktop/RoomSync/apps/web/lib/socket.js) automatically connects to `wss://<your-worker-domain>/realtime` in production, maintaining full event compatibility (`expense:created`, `settlement:recorded`, etc.) without altering any React UI code.

---

## Step 6: Troubleshooting & Rollback

### 1. Database Connection Timeout on Cloudflare
- **Symptom:** Worker logs show `connection timeout` or `ECONNREFUSED`.
- **Cause:** Using direct connection on port 5432 instead of the Supabase Transaction Pooler on port 6543, or missing `?sslmode=require`.
- **Fix:** Update `DATABASE_URL` in Cloudflare secrets to use the Supabase Transaction Pooler URL on port `6543` with `?sslmode=require`.

### 2. Missing Environment Variables on Boot
- **Symptom:** Worker returns `[FATAL CONFIG ERROR] Production configuration check failed`.
- **Cause:** `NODE_ENV=production` is set, but `DATABASE_URL`, `REDIS_URL`, or `JWT_SECRET` is missing.
- **Fix:** Ensure all secrets are set via `npx wrangler secret put`.

### 3. Rolling Back a Deployment
To rollback to a previous Cloudflare Worker deployment instantly:
```bash
npx wrangler rollback --env production
```
Or navigate to **Cloudflare Dashboard > Workers & Pages > clover > Deployments**, click the previous successful deployment, and select **Rollback**.
