# Deployment Guide: Vercel for Everything ⚡

Since we are skipping Render, we will deploy **BOTH** Frontend and Backend to Vercel as separate projects from the same repository.

## Step 1: Fix Git & Push (Crucial)
I have fixed the issue with the secret `.env` file being rejected. You just need to push the cleaner version:

```bash
# Force push the fixed commit
git push -u origin main --force
```

---

## Step 2: Deploy Backend (Project 1)
1.  Go to [Vercel Dashboard](https://vercel.com/dashboard).
2.  Click **"Add New..."** -> **Project**.
3.  Import your repository (`cmat-problem-monorepo`).
4.  **Configure Project**:
    - **Project Name**: `cmat-backend`
    - **Framework Preset**: `Other` (Important!)
    - **Root Directory**: Click "Edit" and select `backend`.
5.  **Environment Variables**:
    - `REDIS_URL`: Paste your Upstash connection string (`rediss://...`).
    - `ALLOWED_ORIGINS`: `*` (or your frontend URL later).
6.  Click **Deploy**.
7.  **Copy the Domain**: Vercel will give you a URL like `https://cmat-backend.vercel.app`.

---

## Step 3: Deploy Frontend (Project 2)
1.  Go to Vercel Dashboard again.
2.  Click **"Add New..."** -> **Project**.
3.  Import the **SAME** repository again.
4.  **Configure Project**:
    - **Project Name**: `cmat-frontend`
    - **Framework Preset**: `Next.js` (Should auto-detect).
    - **Root Directory**: Click "Edit" and select `frontend`.
5.  **Environment Variables**:
    - `NEXT_PUBLIC_API_URL`: Paste the Backend URL from Step 2 (e.g., `https://cmat-backend.vercel.app/api`).
      *Note: Add `/api` at the end if your backend routes are prefixed with /api, otherwise just the base URL.*
6.  Click **Deploy**.

---

## Troubleshooting "404 Not Found"
If you see a 404, it's usually because the **Root Directory** wasn't set correctly.
- For Frontend: Root Directory must be `frontend`.
- For Backend: Root Directory must be `backend`.

If you deployed the "Root" (`.`) by mistake, Vercel doesn't know what to do. The steps above fix this by splitting them.
