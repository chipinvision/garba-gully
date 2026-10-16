import { Client } from '@colyseus/sdk';
import type { PlayerData } from './types';

const STORAGE_KEY_SERVER_URL = 'garba_custom_server_url';

/**
 * Returns the currently active WebSocket/HTTP server endpoint.
 * Priority:
 * 1. URL search parameter (?server=wss://...)
 * 2. LocalStorage override
 * 3. Vite build-time env (import.meta.env.VITE_SERVER_URL)
 * 4. Default: ws://localhost:2567
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

  // If on localhost in browser, default to localhost:2567
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
  // Reset cached client
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

  // Construct HTTP endpoint:
  // If serverUrl starts with wss:// or ws://, convert to https:// or http://
  let httpBase = serverUrl.replace(/^ws(s?):/, (_match, secure) => secure ? 'https:' : 'http:');
  if (!httpBase.startsWith('http')) {
    httpBase = (isHttpsPage ? 'https://' : 'http://') + httpBase;
  }

  // Security check: Browsers block mixed content (http inside https page)
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

    // Check for standard browser network failure (Safari's "Load failed" or Chrome's "Failed to fetch")
    if (rawMsg === 'Load failed' || rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError') || err.name === 'TypeError') {
      const isRemoteSite = typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname);
      const isPointingToLocalhost = serverUrl.includes('localhost') || serverUrl.includes('127.0.0.1');

      if (isRemoteSite && isPointingToLocalhost) {
        throw new Error(
          `Cannot connect to multiplayer server at "${serverUrl}". ` +
          `Your site is deployed on Netlify, but the backend server is still pointing to localhost. ` +
          `The backend server must be hosted on a public service (e.g. Render, Railway) with VITE_SERVER_URL configured, or enter a public server URL in Server Settings.`
        );
      }

      throw new Error(
        `Multiplayer server unreachable at ${httpBase}. ` +
        `Please ensure your backend Colyseus server is running and accessible.`
      );
    }

    throw err;
  }
}
