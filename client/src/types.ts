// Shared types for client-server communication

export interface PlayerData {
  sessionId: string;
  nickname: string;
  avatarId: number;
  outfitId: number;
  x: number;
  y: number;
  isDancing: boolean;
  danceStyle: 'garba' | 'dandiya';
  facing: 'up' | 'down' | 'left' | 'right';
  isHost: boolean;
}

export interface RoomState {
  players: Map<string, PlayerData>;
  musicStartedAt: number;
  inviteToken: string;
  hostSessionId: string;
  roomName: string;
  playlistId: string;
  currentTrackIndex: number;
  playbackState: 'playing' | 'paused';
  playbackPositionSeconds: number;
  lastPlaybackCommandAt: number;
}

export type AppScreen =
  | 'landing'
  | 'lobby'   // avatar/nickname selection before join
  | 'game'    // inside the room
  | 'error';

export interface JoinOptions {
  nickname: string;
  avatarId: number;
  outfitId: number;
  inviteToken?: string;
  playlistId?: string;
}

// Avatar definitions
export interface AvatarDef {
  id: number;
  name: string;
  emoji: string;
  colorHue: number; // hue for the avatar tint
}

export interface OutfitDef {
  id: number;
  name: string;
  emoji: string;
  colors: [string, string]; // primary, accent
}

export const AVATARS: AvatarDef[] = [
  { id: 0, name: 'Radha',  emoji: '👩', colorHue: 330 },
  { id: 1, name: 'Arjun',  emoji: '👨', colorHue: 200 },
  { id: 2, name: 'Meera',  emoji: '💃', colorHue: 280 },
  { id: 3, name: 'Rohan',  emoji: '🕺', colorHue: 160 },
  { id: 4, name: 'Priya',  emoji: '🧕', colorHue: 40  },
  { id: 5, name: 'Dev',    emoji: '👲', colorHue: 10  },
];

export const OUTFITS: OutfitDef[] = [
  { id: 0, name: 'Chaniya Choli',  emoji: '🔴', colors: ['#e53e3e', '#fbbf24'] },
  { id: 1, name: 'Kediyu',         emoji: '🟡', colors: ['#d69e2e', '#ed8936'] },
  { id: 2, name: 'Ghagra Set',     emoji: '🟣', colors: ['#805ad5', '#ed64a6'] },
  { id: 3, name: 'Navratri Blue',  emoji: '🔵', colors: ['#3182ce', '#2dd4bf'] },
  { id: 4, name: 'Royal Green',    emoji: '🟢', colors: ['#276749', '#f6e05e'] },
  { id: 5, name: 'Sunset Pink',    emoji: '🩷', colors: ['#ed64a6', '#f97316'] },
];

// Ground bounds (must match server)
export const GROUND_BOUNDS = {
  minX: 60, maxX: 740,
  minY: 80, maxY: 520,
};

export const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'ws://localhost:2567';
export const SERVER_HTTP = SERVER_URL.replace(/^ws/, 'http');
export const MAX_ROOM_PLAYERS = 8;
