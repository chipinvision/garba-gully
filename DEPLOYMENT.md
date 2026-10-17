# 🪔 Garba Gully — Deployment Guide (Vercel & Netlify)

Garba Gully is 100% serverless and frontend-only, powered by **WebRTC P2P (Trystero)**. It requires **no backend server, no database, no Render, and zero hosting costs**.

---

## ⚡ Option 1: Deploy on Vercel (Recommended — 30 Seconds)

Vercel is the fastest and most reliable platform for Vite + React applications.

### 1-Click Git Deployment on Vercel:

1. Go to **[vercel.com/new](https://vercel.com/new)**.
2. Sign in with GitHub and select your repository: **`chipinvision/garba-gully`**.
3. **Project Configuration**:
   - Vercel automatically detects the [`vercel.json`](./vercel.json) configuration:
     - **Framework Preset:** Vite
     - **Root Directory:** `./` (or `client`)
     - **Build Command:** `npm run build --workspace=client`
     - **Output Directory:** `client/dist` (or `dist` if root directory is set to `client`)
   - **Environment Variables:** None needed! Leave completely blank.
4. Click **Deploy**.
5. Your site is live! (e.g. `https://garba-gully.vercel.app`).

*SPA redirects (`rewrites`), client caching, and P2P WebRTC data channels are all pre-configured in [`vercel.json`](./vercel.json).*

---

## ⚡ Option 2: Deploy on Netlify

If you prefer Netlify:

1. Go to **[app.netlify.com](https://app.netlify.com)** and click **"Add new site"** → **"Import an existing project"**.
2. Select **`chipinvision/garba-gully`**.
3. Netlify will detect [`netlify.toml`](./netlify.toml) with:
   - **Base directory:** `client`
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Click **Deploy site**.

---

## 🔗 How Virtual Garba Rooms & Invite Links Work

1. Open your live deployment (e.g. `https://your-app.vercel.app`).
2. Click **"Create Room"**, select your avatar, and enter an optional YouTube playlist link.
3. A unique room code is generated (e.g. `garba-7k2m`).
4. Click **"Copy Invite Link"** inside the game arena:
   ```
   https://your-app.vercel.app?room=garba-7k2m
   ```
5. Share the link with friends:
   - When friends open the link on any browser (phone, tablet, or laptop), they join the same room.
   - Movements, authentic 6-beat Garba & 4-beat Dandiya choreography, and YouTube music stream **directly peer-to-peer via WebRTC**.
   - No backend servers, no cold starts, and zero latency overhead.

---

## 🛠️ Optional: Dedicated Colyseus Server (For Local / Custom VPS)

If you ever wish to run a dedicated Node.js WebSocket backend:
1. Start the server locally (`cd server && npm install && npm start`).
2. In the game lobby or HUD, click **⚙️ Network** and switch to **Dedicated WebSocket Server**.
3. Enter your server URL (e.g. `ws://localhost:2567`).
