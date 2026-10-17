# 🪔 Garba Gully — Virtual Garba & Dandiya Night

> **Dance together in real time from your browser.** Choose festive avatars, sync with YouTube music playlists, and celebrate Navratri with friends anywhere in the world! **Serverless WebRTC P2P — 100% Free on Vercel & Netlify with zero backend servers required.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Frontend](https://img.shields.io/badge/Frontend-React%20%7C%20Vite%20%7C%20Phaser%203-blue)](https://vitejs.dev/)
[![Multiplayer](https://img.shields.io/badge/Multiplayer-WebRTC%20P2P%20%7C%20Zero%20Backend-success)](https://trystero.dev/)
[![Deploy on Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com/new)
[![Deploy on Netlify](https://img.shields.io/badge/Deploy-Netlify-teal?logo=netlify)](https://netlify.com/)

---

## ✨ Features

- 💃 **Authentic Gujarati Choreography:**
  - **Garba (Tran Tali):** 6-beat traditional cyclical rhythm with authentic footwork, graceful baithak dips, torso rotations, chest/waist/overhead claps, and 360° pirouette spins.
  - **Dandiya Raas:** 4-beat high-energy rhythm featuring visible dual dandiya sticks, crisp center clacks, diagonal partner strikes, and dynamic spins with celebratory bursts.
- ⚡ **Zero-Server Multiplayer (Serverless WebRTC):**
  - Uses browser-to-browser **WebRTC DataChannels** with decentralized Nostr signaling.
  - No external backend servers, no Render or Railway accounts, no cold starts, and zero hosting fees.
  - Ultra-low latency synchronization for dancer positions and choreography animations.
- 🎵 **Shared YouTube Playlists:**
  - Host pastes any public YouTube playlist or video ID.
  - State-synchronized playback across all room dancers using the YouTube IFrame API.
  - Live DJ badge indicating the room host and playlist controls.
- 🎨 **Festive Avatars & Customization:**
  - Traditional Gujarati attire: Chaniya Choli, Kediyu, Kurta, and Dupatta in vibrant Navratri palettes (Marigold, Rani Pink, Royal Blue, Peepal Green, Sunset Orange).
  - Customizable skin tones, accessories, and nicknames.
- 🔗 **Guest-First & Zero Download:**
  - No signup required. Create a room, copy the invite link (`https://your-app.vercel.app?room=garba-XXXX`), and friends join instantly in their desktop or mobile browser.

---

## 🏗️ Architecture

```
garba-gully/
├── client/                     # Frontend Application (React + Vite + Phaser 3)
│   ├── src/
│   │   ├── game/               # Phaser 3 Isometric Garba Scene & Choreography Engine
│   │   │   ├── GarbaScene.ts          # 2.5D Arena, rangoli patterns, lighting, avatars
│   │   │   └── garbaChoreography.ts   # Kinematics engine for Garba & Dandiya Raas
│   │   ├── services/
│   │   │   └── p2pGarbaRoom.ts        # Serverless WebRTC room engine (Trystero)
│   │   ├── components/         # UI Modals, Lobby, Dance Preview, Network Settings
│   │   ├── hooks/              # Room state management hook (P2P + Colyseus)
│   │   └── colyseus.ts         # Optional Colyseus client & network mode resolver
│   ├── vercel.json             # Vercel SPA build & rewrite configuration
│   ├── netlify.toml            # Netlify SPA build & redirect configuration
│   └── public/                 # Static assets, SVG icons, _redirects
│
├── server/                     # Optional Dedicated Server (Colyseus + Node.js)
│   ├── src/                    # Authoritative multiplayer rooms for custom VPS
│   └── Dockerfile
│
├── vercel.json                 # Root Vercel configuration
├── netlify.toml                # Root Netlify configuration
├── DEPLOYMENT.md               # Vercel & Netlify step-by-step deployment guide
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

### 2. Start the Frontend Client
```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. Because Garba Gully uses serverless WebRTC, you can open multiple browser tabs and dance together immediately without starting any backend server!

---

## 🌐 Deploying on Vercel (Recommended)

1. Connect your GitHub repository [chipinvision/garba-gully](https://github.com/chipinvision/garba-gully) at [vercel.com/new](https://vercel.com/new).
2. Vercel automatically detects the [`vercel.json`](./vercel.json) settings:
   - **Framework:** Vite
   - **Build Command:** `npm run build --workspace=client`
   - **Output Directory:** `client/dist`
3. Click **Deploy**.
4. Your virtual Garba room is live worldwide!

*See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for full instructions.*

---

## 📜 License

MIT © [Garba Gully Contributors](https://github.com/chipinvision/garba-gully)
