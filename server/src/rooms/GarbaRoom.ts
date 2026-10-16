import { Room, Client, CloseCode } from "colyseus";
import { GarbaRoomState, PlayerState } from "./schema/GarbaRoomState.js";
import { tokenToRoomId } from "../tokenRegistry.js";

// Dance ground bounds (server-side validation, in canvas px space 800×600)
const GROUND_MIN_X = 60;
const GROUND_MAX_X = 740;
const GROUND_MIN_Y = 80;
const GROUND_MAX_Y = 520;
const MAX_MOVE_DELTA = 6; // max px per message
const MAX_CLIENTS    = 8;

// Inactivity cleanup
const EMPTY_ROOM_TTL_MS = 30_000;

type MoveMessage  = { dx: number; dy: number };
type DanceMessage = { isDancing: boolean; danceStyle?: string };
type MusicPlayMessage = { trackIndex?: number; positionSeconds?: number };
type MusicPauseMessage = { positionSeconds?: number };
type MusicNextMessage = { trackIndex?: number };
type MusicSyncMessage = { trackIndex?: number; positionSeconds?: number; playbackState?: string };

export interface GarbaJoinOptions {
  nickname: string;
  avatarId: number;
  outfitId: number;
  inviteToken?: string;
  playlistId?: string;
}

export class GarbaRoom extends Room<{ state: GarbaRoomState }> {
  maxClients = MAX_CLIENTS;
  state = new GarbaRoomState();

  private emptyRoomTimer: ReturnType<typeof setTimeout> | null = null;
  private inviteToken = "";

  messages = {
    move: (client: Client, msg: MoveMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      // Sanitize & clamp movement
      const dx = Math.max(-MAX_MOVE_DELTA, Math.min(MAX_MOVE_DELTA, Number(msg.dx) || 0));
      const dy = Math.max(-MAX_MOVE_DELTA, Math.min(MAX_MOVE_DELTA, Number(msg.dy) || 0));

      player.x = Math.max(GROUND_MIN_X, Math.min(GROUND_MAX_X, player.x + dx));
      player.y = Math.max(GROUND_MIN_Y, Math.min(GROUND_MAX_Y, player.y + dy));

      // Update facing
      if (Math.abs(dx) > Math.abs(dy)) {
        player.facing = dx > 0 ? "right" : "left";
      } else if (dy !== 0) {
        player.facing = dy > 0 ? "down" : "up";
      }
    },

    dance: (client: Client, msg: DanceMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.isDancing = Boolean(msg.isDancing);
        if (msg.danceStyle === "garba" || msg.danceStyle === "dandiya") {
          player.danceStyle = msg.danceStyle;
        }
      }
    },

    ping: (client: Client, _msg: unknown) => {
      client.send("pong", { t: Date.now() });
    },

    "music:play": (client: Client, msg: MusicPlayMessage) => {
      // Validate command originates from the room host
      if (client.sessionId !== this.state.hostSessionId) {
        console.warn(`[GarbaRoom] Unauthorized music:play from non-host ${client.sessionId}`);
        return;
      }

      this.state.playbackState = "playing";
      if (typeof msg?.trackIndex === "number" && msg.trackIndex >= 0) {
        this.state.currentTrackIndex = Math.floor(msg.trackIndex);
      }
      if (typeof msg?.positionSeconds === "number" && msg.positionSeconds >= 0) {
        this.state.playbackPositionSeconds = Math.max(0, msg.positionSeconds);
      }
      this.state.lastPlaybackCommandAt = Date.now();

      this.broadcast("music:play", {
        trackIndex: this.state.currentTrackIndex,
        positionSeconds: this.state.playbackPositionSeconds,
        lastPlaybackCommandAt: this.state.lastPlaybackCommandAt,
      });
    },

    "music:pause": (client: Client, msg: MusicPauseMessage) => {
      if (client.sessionId !== this.state.hostSessionId) {
        console.warn(`[GarbaRoom] Unauthorized music:pause from non-host ${client.sessionId}`);
        return;
      }

      this.state.playbackState = "paused";
      if (typeof msg?.positionSeconds === "number" && msg.positionSeconds >= 0) {
        this.state.playbackPositionSeconds = Math.max(0, msg.positionSeconds);
      }
      this.state.lastPlaybackCommandAt = Date.now();

      this.broadcast("music:pause", {
        positionSeconds: this.state.playbackPositionSeconds,
      });
    },

    "music:next": (client: Client, msg: MusicNextMessage) => {
      if (client.sessionId !== this.state.hostSessionId) {
        console.warn(`[GarbaRoom] Unauthorized music:next from non-host ${client.sessionId}`);
        return;
      }

      const nextIdx = typeof msg?.trackIndex === "number" && msg.trackIndex >= 0
        ? Math.floor(msg.trackIndex)
        : this.state.currentTrackIndex + 1;

      this.state.currentTrackIndex = nextIdx;
      this.state.playbackPositionSeconds = 0;
      this.state.playbackState = "playing";
      this.state.lastPlaybackCommandAt = Date.now();

      this.broadcast("music:next", {
        trackIndex: nextIdx,
        lastPlaybackCommandAt: this.state.lastPlaybackCommandAt,
      });
    },

    "music:sync": (client: Client, msg: MusicSyncMessage) => {
      if (client.sessionId !== this.state.hostSessionId) return;

      if (typeof msg?.trackIndex === "number" && msg.trackIndex >= 0) {
        this.state.currentTrackIndex = Math.floor(msg.trackIndex);
      }
      if (typeof msg?.positionSeconds === "number" && msg.positionSeconds >= 0) {
        this.state.playbackPositionSeconds = Math.max(0, msg.positionSeconds);
      }
      if (msg?.playbackState === "playing" || msg?.playbackState === "paused") {
        this.state.playbackState = msg.playbackState;
      }
      this.state.lastPlaybackCommandAt = Date.now();
    },
  };

  onCreate(options: GarbaJoinOptions & { roomName?: string }) {
    this.state = new GarbaRoomState();
    this.state.musicStartedAt = Date.now();
    this.state.roomName = options.roomName || "Garba Gully";
    this.state.playlistId = (options.playlistId || "").trim();
    this.state.currentTrackIndex = 0;
    this.state.playbackState = "paused";
    this.state.playbackPositionSeconds = 0;
    this.state.lastPlaybackCommandAt = Date.now();

    // Generate invite token
    this.inviteToken = this.generateToken();
    this.state.inviteToken = this.inviteToken;

    // Register token → roomId mapping
    tokenToRoomId.set(this.inviteToken, this.roomId);

    console.log(
      `[GarbaRoom] onCreate roomId=${this.roomId} token=${this.inviteToken}`
    );

    this.scheduleEmptyRoomCleanup();
  }

  async onAuth(_client: Client, options: GarbaJoinOptions): Promise<boolean> {
    const nick = (options.nickname ?? "").trim();
    if (!nick || nick.length < 1) throw new Error("A nickname is required.");
    if (nick.length > 24)         throw new Error("Nickname too long (max 24 chars).");
    return true;
  }

  onJoin(client: Client, options: GarbaJoinOptions) {
    const player     = new PlayerState();
    player.sessionId = client.sessionId;
    player.nickname  = (options.nickname || "Guest").trim().slice(0, 24);
    player.avatarId  = Math.max(0, Math.min(5, Number(options.avatarId ?? 0)));
    player.outfitId  = Math.max(0, Math.min(5, Number(options.outfitId ?? 0)));
    // Random spawn on the floor
    player.x         = 350 + (Math.random() * 200 - 100);
    player.y         = 280 + (Math.random() * 120 - 60);
    player.facing    = "down";
    player.isDancing = false;
    player.danceStyle = "garba";

    // First joiner is host
    if (this.state.players.size === 0) {
      player.isHost            = true;
      this.state.hostSessionId = client.sessionId;
    }

    this.state.players.set(client.sessionId, player);

    // Cancel empty-room timer
    if (this.emptyRoomTimer) {
      clearTimeout(this.emptyRoomTimer);
      this.emptyRoomTimer = null;
    }

    // Tell the joining client the music sync offset and playlist state
    client.send("musicSync", {
      startedAt:  this.state.musicStartedAt,
      serverNow:  Date.now(),
    });
    client.send("music:init", {
      playlistId: this.state.playlistId,
      currentTrackIndex: this.state.currentTrackIndex,
      playbackState: this.state.playbackState,
      playbackPositionSeconds: this.state.playbackPositionSeconds,
      lastPlaybackCommandAt: this.state.lastPlaybackCommandAt,
      serverNow: Date.now(),
    });

    console.log(
      `[GarbaRoom] ${player.nickname} joined (${this.clients.length}/${MAX_CLIENTS})`
    );
  }

  onLeave(client: Client, _code: CloseCode) {
    const player   = this.state.players.get(client.sessionId);
    const nickname = player?.nickname ?? client.sessionId;
    const wasHost  = player?.isHost   ?? false;

    this.state.players.delete(client.sessionId);
    console.log(
      `[GarbaRoom] ${nickname} left. Remaining: ${this.state.players.size}`
    );

    if (wasHost && this.state.players.size > 0) {
      this.broadcast("hostLeft", {
        message: "The host has left. The room is closing.",
      });
      setTimeout(() => this.disconnect(), 3000);
      return;
    }

    if (this.state.players.size === 0) {
      this.scheduleEmptyRoomCleanup();
    }
  }

  onDispose() {
    if (this.emptyRoomTimer) clearTimeout(this.emptyRoomTimer);
    // Clean up token mapping
    if (this.inviteToken) tokenToRoomId.delete(this.inviteToken);
    console.log(`[GarbaRoom] Disposed room ${this.roomId}`);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private generateToken(): string {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    let t = "";
    for (let i = 0; i < 12; i++) t += chars[Math.floor(Math.random() * chars.length)];
    return t;
  }

  private scheduleEmptyRoomCleanup() {
    if (this.emptyRoomTimer) clearTimeout(this.emptyRoomTimer);
    this.emptyRoomTimer = setTimeout(() => {
      if (this.state.players.size === 0) {
        console.log(`[GarbaRoom] Disposing empty room ${this.roomId}`);
        this.disconnect();
      }
    }, EMPTY_ROOM_TTL_MS);
  }
}
