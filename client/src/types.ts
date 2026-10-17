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
  { id: 0, name: 'Gulabi Bandhani', emoji: '🌺', colors: ['#a9273c', '#f0c66e'] },
  { id: 1, name: 'Midnight Mirror', emoji: '🖤', colors: ['#17151c', '#a83f36'] },
  { id: 2, name: 'Royal Violet',    emoji: '🪻', colors: ['#583b83', '#e4a1bd'] },
  { id: 3, name: 'Monsoon Teal',    emoji: '🪷', colors: ['#176a70', '#e7bd61'] },
  { id: 4, name: 'Kesar Saffron',   emoji: '🌼', colors: ['#b84e22', '#f2cb67'] },
  { id: 5, name: 'Emerald Zari',    emoji: '💚', colors: ['#25634a', '#e7c46b'] },
];

// Ground bounds (must match server)
export const GROUND_BOUNDS = {
  minX: 60, maxX: 740,
  minY: 80, maxY: 520,
};

export const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'ws://localhost:2567';
export const SERVER_HTTP = SERVER_URL.replace(/^ws/, 'http');
export const MAX_ROOM_PLAYERS = 8;
