import { Client } from '@colyseus/sdk';
import type { PlayerData } from './types';

const STORAGE_KEY_SERVER_URL = 'garba_custom_server_url';
const STORAGE_KEY_NETWORK_MODE = 'garba_network_mode'; // 'p2p' | 'colyseus'

/**
 * Returns true if Netlify-only P2P WebRTC mode is active.
 * Defaults to true on remote deployments (Netlify) unless a custom server is explicitly configured.
 */
export function isP2PMode(): boolean {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'p2p') return true;
    if (params.get('mode') === 'server') return false;

    // If room param starts with 'garba-', it's a P2P room
    const room = params.get('room') || params.get('invite');
    if (room && room.startsWith('garba-')) return true;

    try {
      const storedMode = localStorage.getItem(STORAGE_KEY_NETWORK_MODE);
      if (storedMode === 'p2p') return true;
      if (storedMode === 'colyseus') return false;
    } catch {}
  }

  // If a custom server URL is set and NOT localhost, use colyseus
  if (hasCustomServer()) {
    return false;
  }

  // Default to serverless P2P on deployed static sites (like Netlify)
  if (typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return true;
  }

  // Default to P2P even locally so no backend is strictly required
  return true;
}

export function setNetworkMode(mode: 'p2p' | 'colyseus'): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_NETWORK_MODE, mode);
    } catch {}
  }
}

/**
 * Check if an explicit, public custom backend server URL is configured.
 */
export function hasCustomServer(): boolean {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const paramServer = params.get('server');
    if (paramServer && !paramServer.includes('localhost') && !paramServer.includes('127.0.0.1')) {
      return true;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY_SERVER_URL);
      if (stored && !stored.includes('localhost') && !stored.includes('127.0.0.1') && stored !== 'p2p') {
        return true;
      }
    } catch {}
  }

  const envUrl = import.meta.env.VITE_SERVER_URL;
  return Boolean(envUrl && envUrl.trim().length > 0 && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1'));
}

/**
 * Returns the currently active WebSocket/HTTP server endpoint.
 */
export function getServerUrl(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const paramServer = params.get('server');
    if (paramServer) {
      const clean = paramServer.trim().replace(/\/+$/, '');
      try {
        localStorage.setItem(STORAGE_KEY_SERVER_URL, clean);
      } catch {}
      return clean;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY_SERVER_URL);
      if (stored) return stored.trim().replace(/\/+$/, '');
    } catch {}
  }

  const envUrl = import.meta.env.VITE_SERVER_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'ws://localhost:2567';
  }

  return 'ws://localhost:2567';
}

/**
 * Persist a custom server URL into LocalStorage.
 */
export function setServerUrl(url: string): void {
  const clean = url.trim().replace(/\/+$/, '');
  if (typeof window !== 'undefined') {
    try {
      if (clean) {
        localStorage.setItem(STORAGE_KEY_SERVER_URL, clean);
      } else {
        localStorage.removeItem(STORAGE_KEY_SERVER_URL);
      }
    } catch {}
  }
  cachedClient = null;
}

let cachedClient: Client | null = null;
let cachedUrl: string | null = null;

export function getColyseusClient(): Client {
  const url = getServerUrl();
  if (!cachedClient || cachedUrl !== url) {
    cachedClient = new Client(url);
    cachedUrl = url;
  }
  return cachedClient;
}

// Backwards-compatible export proxy
export const colyseusClient = new Proxy({} as Client, {
  get(_target, prop) {
    const client = getColyseusClient();
    const val = (client as any)[prop];
    if (typeof val === 'function') {
      return val.bind(client);
    }
    return val;
  },
});

// Helper to convert Colyseus schema map → plain JS Map
export function schemaPlayersToMap(schemaPlayers: any): Map<string, PlayerData> {
  const result = new Map<string, PlayerData>();
  if (!schemaPlayers) return result;

  schemaPlayers.forEach((player: any, sessionId: string) => {
    result.set(sessionId, {
      sessionId,
      nickname:  player.nickname   ?? '',
      avatarId:  player.avatarId   ?? 0,
      outfitId:  player.outfitId   ?? 0,
      x:         player.x          ?? 400,
      y:         player.y          ?? 300,
      isDancing: player.isDancing  ?? false,
      danceStyle: player.danceStyle ?? 'garba',
      facing:    player.facing     ?? 'down',
      isHost:    player.isHost     ?? false,
    });
  });

  return result;
}

/**
 * Resolve an invite token to a live Colyseus roomId with helpful error diagnostics.
 */
export async function resolveToken(token: string): Promise<string> {
  const serverUrl = getServerUrl();
  const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';

  let httpBase = serverUrl.replace(/^ws(s?):/, (_match, secure) => secure ? 'https:' : 'http:');
  if (!httpBase.startsWith('http')) {
    httpBase = (isHttpsPage ? 'https://' : 'http://') + httpBase;
  }

  if (isHttpsPage && httpBase.startsWith('http://') && !httpBase.includes('localhost') && !httpBase.includes('127.0.0.1')) {
    httpBase = httpBase.replace(/^http:/, 'https:');
  }

  try {
    const res = await fetch(`${httpBase}/api/rooms/resolve?token=${encodeURIComponent(token)}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as any).error || `Room not found (${res.status})`);
    }
    const data = await res.json() as { roomId: string; token: string };
    return data.roomId;
  } catch (err: any) {
    const rawMsg = err?.message || '';

    if (rawMsg === 'Load failed' || rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError') || err.name === 'TypeError') {
      const isRemoteSite = typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname);
      const isPointingToLocalhost = serverUrl.includes('localhost') || serverUrl.includes('127.0.0.1');

      if (isRemoteSite && isPointingToLocalhost) {
        throw new Error(
          `Cannot connect to multiplayer server at "${serverUrl}". ` +
          `Your site is deployed on Netlify, but no dedicated server was detected. ` +
          `Please switch to Serverless P2P mode in Server Settings to run without a server.`
        );
      }

      throw new Error(
        `Multiplayer server unreachable at ${httpBase}. ` +
        `Please ensure your backend Colyseus server is running or switch to Serverless P2P mode.`
      );
    }

    throw err;
  }
}
