# 🪔 Garba Gully — Netlify Deployment Guide (Zero Backend Required)

Garba Gully is fully configured to run **100% on Netlify** without needing Render, Railway, or any external backend servers!

---

## ⚡ How It Works (Netlify-Native Serverless WebRTC)

- **Frontend & Assets:** Hosted entirely on Netlify's high-speed global CDN.
- **Multiplayer State Sync:** Powered by browser-to-browser WebRTC data channels with decentralized signaling via public Nostr relays (Trystero).
- **Audio & Dance:** Synchronized YouTube playlists and authentic 6-beat Garba & 4-beat Dandiya choreography stream directly between dancers.
- **Zero Cost & Zero Maintenance:** No external container hosts, no sleeping servers, no cold starts, and no "Load failed" errors.

---

## 🚀 Deploying to Netlify (2 Methods)

### Method 1: Git-Connected Automated Deployment (Recommended)

1. Push your repository to **GitHub** (`chipinvision/garba-gully`).
2. Go to [Netlify Dashboard](https://app.netlify.com) and click **"Add new site"** → **"Import an existing project"**.
3. Select `chipinvision/garba-gully`.
4. Netlify will automatically detect the root [`netlify.toml`](./netlify.toml) settings:
   - **Base directory:** `client`
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. **No environment variables are required!** Leave them blank.
6. Click **"Deploy site"**.
7. Once live, open your Netlify URL (e.g. `https://garba-gully.netlify.app`), create a room, and share the invite link (`?room=garba-XXXX`) with friends!

---

### Method 2: Instant Manual Drag & Drop (Pre-Built)

1. Run the production build locally:
   ```bash
   npm run build
   ```
2. Navigate to [app.netlify.com/drop](https://app.netlify.com/drop).
3. Drag and drop the `client/dist` folder directly into the Netlify drop zone.
4. Your site will be live instantly with global CDN caching and SPA redirect routing pre-configured.

---

## 🔗 How Invite Links Work

1. When you click **"Create Room"**, a unique room code is generated (e.g. `garba-7k2m`).
2. Click **"Copy Invite Link"** inside the game to copy:
   ```
   https://your-site.netlify.app?room=garba-7k2m
   ```
3. When friends open the link on mobile or desktop:
   - Netlify serves the game.
   - The room code `garba-7k2m` is automatically filled in.
   - Friends pick their nickname and avatar, click **"Join the Dance"**, and connect directly peer-to-peer!

---

## 🛠️ Optional: Dedicated Colyseus Server (For Local / Custom VPS)

If you ever wish to run a dedicated Node.js WebSocket backend instead of Serverless P2P:
1. Start the server locally (`cd server && npm start`).
2. In the game lobby or HUD, click **⚙️ Network** and switch to **Dedicated WebSocket Server**.
3. Enter your server URL (e.g. `ws://localhost:2567`).
