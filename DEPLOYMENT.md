# Garba Gully — Netlify Deployment Guide

This repository is fully configured for deployment on **Netlify**.

---

## 🚀 Deploying to Netlify (2 Methods)

### Method 1: Git-Connected Automated Deployment (Recommended)

1. Push your repository to **GitHub**, **GitLab**, or **Bitbucket**.
2. Go to [Netlify Dashboard](https://app.netlify.com) and click **"Add new site"** → **"Import an existing project"**.
3. Select your repository.
4. Netlify will automatically detect the root [`netlify.toml`](file:///Users/apple/Downloads/garba-gully/netlify.toml) with these settings:
   - **Base directory:** `client`
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. **Environment Variables:**
   - Under **Site configuration** → **Environment variables**, add:
     - `VITE_SERVER_URL`: The WebSocket URL of your deployed Colyseus server (e.g. `wss://garba-gully-server.onrender.com`).
     - *(Defaults to `ws://localhost:2567` if omitted)*.
6. Click **"Deploy site"**.

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

## 🪔 Configuration Files Added

- **[`netlify.toml`](file:///Users/apple/Downloads/garba-gully/netlify.toml)** (Root): Configures build pipeline, node runtime, SPA redirects, security headers, and asset caching.
- **[`client/netlify.toml`](file:///Users/apple/Downloads/garba-gully/client/netlify.toml)**: Fallback configuration if Netlify is set with `client` as the root directory.
- **[`client/public/_redirects`](file:///Users/apple/Downloads/garba-gully/client/public/_redirects)**: Redirects all routes `/* -> /index.html 200` to support invite links and client-side routing.
- **[`package.json`](file:///Users/apple/Downloads/garba-gully/package.json)** (Root): Monorepo workspace configuration with root `npm run build` command.
- **[`client/.env.example`](file:///Users/apple/Downloads/garba-gully/client/.env.example)**: Reference for production backend server URL.

---

## 🌐 Backend Server Hosting (Colyseus WebSocket Server)

Because Colyseus multiplayer rooms maintain persistent, low-latency WebSocket connections and state synchronization across dancers, the server component (`server/`) should be hosted on a persistent container service:
- **Render.com**: Web Service (Node.js, build: `npm install && npm run build`, start: `npm start`).
- **Railway.app** or **Fly.io**: Direct Node deployment.
- **Colyseus Cloud**: Managed Colyseus hosting.

Once deployed, set `VITE_SERVER_URL=wss://your-backend-url` in your Netlify site settings.
