# MKFRM — Deployment Guide

## Local Development

```bash
npm run dev        # start dev server at http://localhost:3000
npm run build      # production build (run before deploying to catch errors)
npm run lint       # lint check
```

---

## Deploying to Vercel (Free Tier)

Your code is already on GitHub at `mikeenergy7-hub/mkfrm`.  
The app uses **Vercel KV** (Redis) for storage in production — free tier, no card required.

### Step 1 — Import project on Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Sign in with GitHub
3. Click **Add New → Project** and import `mikeenergy7-hub/mkfrm`
4. Framework will be auto-detected as **Next.js** — leave all defaults
5. **Do not deploy yet** — add environment variables first (Step 3)

---

### Step 2 — Create a KV (Redis) store

1. In your Vercel project dashboard → **Storage** tab
2. Click **Create Database** → choose **KV**
3. Name it `mkfrm-kv`, select the free tier, click **Create**
4. On the next screen click **Connect to Project** and link it to `mkfrm`
5. Vercel automatically injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` — you do not add these manually

---

### Step 3 — Add environment variables

In your Vercel project → **Settings → Environment Variables**, add these:

| Variable | Value |
|---|---|
| `NEXTAUTH_SECRET` | `pQQb+ziB7f8pYqYKrs4py6f7vu1i6ccVJq6A+riDWe8=` |
| `NEXTAUTH_URL` | `https://mkfrm.vercel.app` ← use your actual Vercel URL after first deploy |
| `PLATTS_EMAIL` | your S&P Global / Platts Connect email |
| `PLATTS_PASSWORD` | your S&P Global / Platts Connect password |

> **Note on NEXTAUTH_URL**: On the very first deploy Vercel assigns your URL (e.g. `mkfrm-abc123.vercel.app`).
> After you see it, update this variable to match exactly, then redeploy.
> If you add a custom domain later, update it again.

---

### Step 4 — Deploy

Click **Deploy** in the Vercel dashboard.  
Vercel runs `npm run build` automatically. Build takes ~15-20 seconds.

---

### Step 5 — Seed initial data (optional)

Your `/data/*.json` files are gitignored and will not be on Vercel.  
The app starts empty — just log in and start adding tasks/projects.  
Data is persisted in KV from the first write onward.

---

## Architecture at a glance

```
Browser
  └── Next.js (Vercel serverless)
        ├── /api/auth        → next-auth JWT (no database needed)
        ├── /api/tasks       → reads/writes KV key "tasks"
        ├── /api/projects    → reads/writes KV key "projects"
        ├── /api/positions   → reads/writes KV key "positions"
        └── /api/platts-*    → proxies S&P Global Platts API

Storage
  Local dev  → /data/*.json files (gitignored)
  Production → Vercel KV (Redis) — auto-switches when KV env vars are present
```

## Users

Hardcoded in `src/lib/auth-options.ts`. To add/remove users, edit that file and redeploy.

| Username | Password |
|---|---|
| mehrad | mkfrm2024 |
| trader1 | trade2024 |
| trader2 | trade2024 |
| analyst | analyst2024 |
| joe | joe2024 |
| gestler | gestler2024 |
