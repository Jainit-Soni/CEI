# Deployment Guide: Connecting Backend to Vercel Frontend

Since your frontend is already on Vercel, we need to deploy the **Backend** and **Redis** database, then connect them.

## Summary of Architecture
1.  **Frontend** (Vercel) -> Calls Backend API
2.  **Backend** (Render) -> Processing & Data
3.  **Database** (Upstash Redis) -> Fast Caching & Data Store

---

## Step 1: Set up Redis (The Database)
We need a cloud Redis instance. **Upstash** is free and easiest.

1.  Go to [Upstash Console](https://console.upstash.com/).
2.  Log in (Github/Google).
3.  Click **"Create Database"**.
    - **Name**: `cmat-backend-db`
    - **Region**: Select one close to you (e.g., `ap-south-1` for India or `us-east-1`).
    - **TLS (SSL)**: Enabled.
4.  Once created, scroll to **"REST API"** or **"Connect"** section.
5.  Find the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (or the standard **Node.js** connection string).
    - **Copy the Connection String** (look for `rediss://...`).
    - You will need this for the backend.

---

## Step 2: Deploy Backend (Render)
Render is a great place to host Node.js apps for free/cheap.

1.  Push your latest code to **GitHub**.
2.  Go to [Render Dashboard](https://dashboard.render.com/).
3.  Click **New +** -> **Web Service**.
4.  Connect your GitHub repository.
5.  **Configure Service**:
    - **Name**: `cmat-backend`
    - **Root Directory**: `backend` (Important! Set this since your repo has `backend/` folder).
    - **Environment**: `Node`
    - **Build Command**: `npm install`
    - **Start Command**: `node server.js`
    - **Plan**: Free (or Starter for better speed).
6.  **Environment Variables** (Click "Advanced" or "Environment"):
    Add these keys:
    - `REDIS_URL`: `rediss://:[password]@[endpoint]:[port]` (Paste the Upstash connection string here).
    - `ALLOWED_ORIGINS`: `https://your-vercel-frontend-url.vercel.app` (The URL of your deployed frontend).
    - `NODE_ENV`: `production`
7.  Click **Create Web Service**.
8.  Wait for deploy. Render will give you a URL like `https://cmat-backend.onrender.com`. **Copy this.**

---

## Step 3: Connect Frontend (Vercel)
Now tell the frontend where the backend lives.

1.  Go to your project on **Vercel**.
2.  Click **Settings** -> **Environment Variables**.
3.  Add/Edit the variable:
    - **Key**: `NEXT_PUBLIC_API_URL`
    - **Value**: `https://cmat-backend.onrender.com` (The Render URL from Step 2).
4.  **Redeploy** the Frontend:
    - Go to **Deployments** tab.
    - Click the three dots on the latest deployment -> **Redeploy**.
    - This ensures the new Envirnoment Variable is baked into the app.

---

## checklist
- [ ] Redis is running (Upstash).
- [ ] Backend is running (Render) and logs say "Connected to Redis".
- [ ] Frontend (Vercel) has `NEXT_PUBLIC_API_URL` set.
- [ ] Visit Frontend and try to search/view colleges.

**Done!** 🎉
