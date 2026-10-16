# 🪔 Garba Gully — Virtual Garba & Dandiya Night

> **Dance together in real time from your browser.** Choose festive avatars, sync with YouTube music playlists, and celebrate Navratri with friends anywhere in the world!

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Frontend](https://img.shields.io/badge/Frontend-React%20%7C%20Vite%20%7C%20Phaser%203-blue)](https://vitejs.dev/)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%7C%20Colyseus%20WebSocket-orange)](https://colyseus.io/)
[![Deployment](https://img.shields.io/badge/Deploy-Netlify%20%2B%20Render-teal)](https://netlify.com/)

---

## ✨ Features

- 💃 **Authentic Gujarati Choreography:**
  - **Garba (Tran Tali):** 6-beat traditional cyclical rhythm with authentic footwork, graceful baithak dips, torso rotations, chest/waist/overhead claps, and 360° pirouette spins.
  - **Dandiya Raas:** 4-beat high-energy rhythm featuring visible dual dandiya sticks, crisp center clacks, diagonal partner strikes, and dynamic spins with celebratory bursts.
- 🎵 **Shared YouTube Playlists:**
  - Host pastes any public YouTube playlist or video ID.
  - State-synchronized playback across all room dancers using the YouTube IFrame API.
  - Live DJ badge indicating the room host and playlist controls.
- 🌐 **Seamless Multiplayer (Colyseus):**
  - Authoritative room state with 20 FPS schema synchronization.
  - Low-latency WebSocket movement and dance style broadcasts.
  - In-app **Server Switcher (⚙️)** allowing custom server connections, localtunnel bypass, and live latency diagnostics.
- 🎨 **Festive Avatars & Customization:**
  - Traditional Gujarati attire: Chaniya Choli, Kediyu, Kurta, and Dupatta in vibrant Navratri palettes (Marigold, Rani Pink, Royal Blue, Peepal Green, Sunset Orange).
  - Customizable skin tones, accessories, and nicknames.
- 🔗 **Guest-First & Zero Download:**
  - No signup required. Create a room, copy the invite link, and friends join instantly in their desktop browser.

---

## 🏗️ Architecture

```
garba-gully/
├── client/                     # Frontend Application (React + Vite + Phaser 3)
│   ├── src/
│   │   ├── game/               # Phaser 3 Isometric Garba Scene & Choreography Engine
│   │   │   ├── GarbaScene.ts          # 2.5D Arena, rangoli patterns, lighting, avatars
│   │   │   └── garbaChoreography.ts   # Kinematics engine for Garba & Dandiya Raas
│   │   ├── components/         # UI Modals, Lobby, Dance Preview, Server Settings
│   │   ├── hooks/              # Colyseus room state hooks & sync
│   │   └── colyseus.ts         # WebSocket client with dynamic URL resolver
│   ├── netlify.toml            # Netlify SPA build & redirect configuration
│   └── public/                 # Static assets, SVG icons, _redirects
│
├── server/                     # Backend Multiplayer Server (Colyseus + Node.js)
│   ├── src/
│   │   ├── rooms/
│   │   │   ├── GarbaRoom.ts    # Authoritative multiplayer room logic & message handlers
│   │   │   └── schema/         # Colyseus State schemas (Player, RoomState, Music)
│   │   └── index.ts            # Express + Colyseus WebSocket server
│   ├── Dockerfile              # Docker container definition
│   └── package.json
│
├── netlify.toml                # Root Netlify configuration
├── render.yaml                 # 1-Click Render.com Blueprint specification
├── DEPLOYMENT.md               # Step-by-step production hosting guide
└── package.json                # Monorepo scripts
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 18+ and npm installed

### 1. Clone the repository
```bash
git clone https://github.com/chipinvision/garba-gully.git
cd garba-gully
```

### 2. Start the Colyseus Server
```bash
cd server
npm install
npm start
# Server listens on ws://localhost:2567
```

### 3. Start the Frontend Client
In a new terminal:
```bash
cd client
npm install
npm run dev
# Frontend runs on http://localhost:5173
```

Open `http://localhost:5173` in your browser to enter the Garba Gully lobby!

---

## 🌐 Production Deployment

### 1. Frontend on Netlify
The frontend is optimized for static hosting with global CDN caching:
1. Connect this GitHub repository to [Netlify](https://app.netlify.com).
2. Netlify will automatically detect [`netlify.toml`](./netlify.toml):
   - **Base directory:** `client`
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
3. In Netlify Site Settings → **Environment variables**, set:
   ```
   VITE_SERVER_URL=wss://your-server-backend.onrender.com
   ```
4. Deploy!

### 2. Backend on Render.com (Free Web Service)
The Colyseus WebSocket server requires a persistent Node.js environment:
1. Connect this repository to [Render.com](https://render.com).
2. Choose **New Web Service** pointing to the `server/` directory (or use the provided [`render.yaml`](./render.yaml) blueprint).
   - **Environment:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
3. Copy your live Render URL (e.g. `garba-gully-server.onrender.com`) and provide it to Netlify as `VITE_SERVER_URL=wss://garba-gully-server.onrender.com`.

*See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for full instructions, troubleshooting, and zero-deployment localtunnel instructions.*

---

## 📜 License

MIT © [Garba Gully Contributors](https://github.com/chipinvision/garba-gully)
