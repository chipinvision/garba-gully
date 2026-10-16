/**
 * p2pGarbaRoom.ts
 *
 * Serverless WebRTC Peer-to-Peer Garba Room Engine powered by Trystero.
 * Enables 100% serverless multiplayer on Netlify with zero external backend!
 *
 * Features:
 * - Direct peer-to-peer WebRTC data channels with ultra-low latency.
 * - Decentralized signaling across public Nostr relays.
 * - Host authority for YouTube music playback and room snapshots.
 * - Automatic host migration if the original room creator disconnects.
 * - Instant invite links: https://<site>?room=garba-XXXX
 */

import { joinRoom as trysteroJoinRoom, selfId } from 'trystero';
import type { PlayerData } from '../types';
import { GROUND_BOUNDS } from '../types';
import type { MusicCommand } from '../hooks/useGarbaRoom';

export interface P2PRoomCallbacks {
  onPlayersChange: (players: Map<string, PlayerData>) => void;
  onMusicCommand: (cmd: MusicCommand) => void;
  onConnectionStatus: (status: 'connecting' | 'connected' | 'disconnected' | 'error', errorMsg?: string) => void;
  onHostChange: (isHost: boolean, hostSessionId: string) => void;
}

export interface P2PPlayerPayload {
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

export interface P2PSnapshotPayload {
  players: P2PPlayerPayload[];
  playlistId: string;
  currentTrackIndex: number;
  playbackState: 'playing' | 'paused';
  playbackPositionSeconds: number;
  lastPlaybackCommandAt: number;
  hostSessionId: string;
  musicStartedAt: number;
}

export class P2PGarbaRoom {
  public roomId: string;
  public sessionId: string;
  public isHost: boolean = false;
  public hostSessionId: string = '';

  private trysteroRoom: any = null;
  private players: Map<string, PlayerData> = new Map();
  private callbacks: P2PRoomCallbacks;

  // Music state
  public playlistId: string = '';
  public currentTrackIndex: number = 0;
  public playbackState: 'playing' | 'paused' = 'paused';
  public playbackPositionSeconds: number = 0;
  public lastPlaybackCommandAt: number = 0;
  public musicStartedAt: number = 0;

  // Trystero actions
  private actionSnapshot: any = null;
  private actionJoin: any = null;
  private actionMove: any = null;
  private actionDance: any = null;
  private actionMusic: any = null;
  private actionLeave: any = null;

  private connectedPeers: Set<string> = new Set();
  private isDestroyed: boolean = false;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(roomId: string, callbacks: P2PRoomCallbacks) {
    this.roomId = roomId;
    this.sessionId = selfId;
    this.callbacks = callbacks;
  }

  /**
   * Initialize P2P room as the Host (Room Creator).
   */
  public async initAsHost(
    nickname: string,
    avatarId: number,
    outfitId: number,
    playlistId?: string
  ): Promise<void> {
    this.isHost = true;
    this.hostSessionId = this.sessionId;
    this.playlistId = (playlistId || '').trim();

    // Create local host player
    const hostPlayer: PlayerData = {
      sessionId: this.sessionId,
      nickname,
      avatarId,
      outfitId,
      x: 400,
      y: 300,
      isDancing: false,
      danceStyle: 'garba',
      facing: 'down',
      isHost: true,
    };

    this.players.set(this.sessionId, hostPlayer);
    this.callbacks.onPlayersChange(new Map(this.players));
    this.callbacks.onHostChange(true, this.sessionId);

    this.setupTrystero();
    this.callbacks.onConnectionStatus('connected');
  }

  /**
   * Initialize P2P room as a Guest joining an existing room.
   */
  public async initAsGuest(
    nickname: string,
    avatarId: number,
    outfitId: number
  ): Promise<void> {
    this.isHost = false;
    this.callbacks.onConnectionStatus('connecting');

    // Create local guest player (tentative position)
    const guestPlayer: PlayerData = {
      sessionId: this.sessionId,
      nickname,
      avatarId,
      outfitId,
      x: 350 + Math.floor(Math.random() * 100),
      y: 270 + Math.floor(Math.random() * 60),
      isDancing: false,
      danceStyle: 'garba',
      facing: 'down',
      isHost: false,
    };

    this.players.set(this.sessionId, guestPlayer);
    this.callbacks.onPlayersChange(new Map(this.players));

    this.setupTrystero();

    // Announce presence after a tiny delay for WebRTC readiness
    setTimeout(() => {
      this.broadcastJoin(guestPlayer);
    }, 400);

    // Timeout safety: if no peers respond in 12s, we remain connected or become host if alone
    setTimeout(() => {
      if (!this.isDestroyed && this.connectedPeers.size === 0 && !this.isHost) {
        // You are the first peer in this room, promote to host gracefully
        this.isHost = true;
        this.hostSessionId = this.sessionId;
        const me = this.players.get(this.sessionId);
        if (me) {
          me.isHost = true;
          this.callbacks.onPlayersChange(new Map(this.players));
        }
        this.callbacks.onHostChange(true, this.sessionId);
      }
      this.callbacks.onConnectionStatus('connected');
    }, 12000);
  }

  private setupTrystero() {
    try {
      this.trysteroRoom = trysteroJoinRoom({ appId: 'garba-gully-webrtc' }, this.roomId);

      // Register actions
      this.actionSnapshot = this.trysteroRoom.makeAction('snapshot');
      this.actionJoin     = this.trysteroRoom.makeAction('join');
      this.actionMove     = this.trysteroRoom.makeAction('move');
      this.actionDance    = this.trysteroRoom.makeAction('dance');
      this.actionMusic    = this.trysteroRoom.makeAction('music');
      this.actionLeave    = this.trysteroRoom.makeAction('leave');

      // ── Handle incoming Snapshot ─────────────────────────────────────────
      this.actionSnapshot.onMessage = (snapshot: P2PSnapshotPayload) => {
        if (!snapshot || !Array.isArray(snapshot.players)) return;

        this.hostSessionId = snapshot.hostSessionId;
        this.isHost = (this.hostSessionId === this.sessionId);
        this.playlistId = snapshot.playlistId || '';
        this.currentTrackIndex = snapshot.currentTrackIndex ?? 0;
        this.playbackState = snapshot.playbackState || 'paused';
        this.playbackPositionSeconds = snapshot.playbackPositionSeconds ?? 0;
        this.lastPlaybackCommandAt = snapshot.lastPlaybackCommandAt ?? 0;
        this.musicStartedAt = snapshot.musicStartedAt ?? 0;

        // Merge players, preserving local player's latest state
        const localMe = this.players.get(this.sessionId);
        this.players.clear();

        snapshot.players.forEach(p => {
          this.players.set(p.sessionId, { ...p });
        });

        if (localMe) {
          this.players.set(this.sessionId, localMe);
        }

        this.callbacks.onPlayersChange(new Map(this.players));
        this.callbacks.onHostChange(this.isHost, this.hostSessionId);
        this.callbacks.onConnectionStatus('connected');

        if (this.playlistId) {
          this.callbacks.onMusicCommand({
            type: 'init',
            playlistId: this.playlistId,
            trackIndex: this.currentTrackIndex,
            playbackState: this.playbackState,
            positionSeconds: this.playbackPositionSeconds,
            lastPlaybackCommandAt: this.lastPlaybackCommandAt,
          });
        }
      };

      // ── Handle incoming Join ─────────────────────────────────────────────
      this.actionJoin.onMessage = (playerPayload: P2PPlayerPayload, ctx: any) => {
        if (!playerPayload || !playerPayload.sessionId) return;

        this.players.set(playerPayload.sessionId, {
          sessionId: playerPayload.sessionId,
          nickname: playerPayload.nickname || 'Dancer',
          avatarId: playerPayload.avatarId ?? 0,
          outfitId: playerPayload.outfitId ?? 0,
          x: playerPayload.x ?? 400,
          y: playerPayload.y ?? 300,
          isDancing: playerPayload.isDancing ?? false,
          danceStyle: playerPayload.danceStyle ?? 'garba',
          facing: playerPayload.facing ?? 'down',
          isHost: playerPayload.sessionId === this.hostSessionId,
        });

        this.callbacks.onPlayersChange(new Map(this.players));

        // If I am the host, send back the authoritative room snapshot to this new peer
        if (this.isHost && ctx?.peerId) {
          this.sendSnapshotToPeer(ctx.peerId);
        }
      };

      // ── Handle incoming Move ─────────────────────────────────────────────
      this.actionMove.onMessage = (data: { sessionId: string; x: number; y: number; facing: 'up' | 'down' | 'left' | 'right' }) => {
        if (!data || !data.sessionId || data.sessionId === this.sessionId) return;
        const p = this.players.get(data.sessionId);
        if (p) {
          p.x = data.x;
          p.y = data.y;
          p.facing = data.facing;
          this.callbacks.onPlayersChange(new Map(this.players));
        }
      };

      // ── Handle incoming Dance ────────────────────────────────────────────
      this.actionDance.onMessage = (data: { sessionId: string; isDancing: boolean; danceStyle: 'garba' | 'dandiya' }) => {
        if (!data || !data.sessionId || data.sessionId === this.sessionId) return;
        const p = this.players.get(data.sessionId);
        if (p) {
          p.isDancing = data.isDancing;
          if (data.danceStyle) p.danceStyle = data.danceStyle;
          this.callbacks.onPlayersChange(new Map(this.players));
        }
      };

      // ── Handle incoming Music ────────────────────────────────────────────
      this.actionMusic.onMessage = (cmd: MusicCommand) => {
        if (!cmd) return;
        if (typeof cmd.trackIndex === 'number') this.currentTrackIndex = cmd.trackIndex;
        if (typeof cmd.positionSeconds === 'number') this.playbackPositionSeconds = cmd.positionSeconds;
        if (cmd.playbackState) this.playbackState = cmd.playbackState;
        if (typeof cmd.lastPlaybackCommandAt === 'number') this.lastPlaybackCommandAt = cmd.lastPlaybackCommandAt;
        if (cmd.playlistId) this.playlistId = cmd.playlistId;

        this.callbacks.onMusicCommand(cmd);
      };

      // ── Peer lifecycle ───────────────────────────────────────────────────
      this.trysteroRoom.onPeerJoin = (peerId: string) => {
        this.connectedPeers.add(peerId);
        this.callbacks.onConnectionStatus('connected');

        // Announce our presence to the new peer
        const me = this.players.get(this.sessionId);
        if (me) {
          this.actionJoin.send(me, { target: peerId });
        }

        // If I am the Host, send the full room state to the newly joined peer
        if (this.isHost) {
          this.sendSnapshotToPeer(peerId);
        }
      };

      this.trysteroRoom.onPeerLeave = (peerId: string) => {
        this.connectedPeers.delete(peerId);
        this.removePeer(peerId);
      };

      // Periodic heartbeat for host to sync music and state
      this.heartbeatInterval = setInterval(() => {
        if (this.isHost && this.connectedPeers.size > 0 && this.playlistId) {
          this.actionMusic.send({
            type: 'sync',
            trackIndex: this.currentTrackIndex,
            positionSeconds: this.playbackPositionSeconds,
            playbackState: this.playbackState,
            lastPlaybackCommandAt: this.lastPlaybackCommandAt,
          });
        }
      }, 5000);

    } catch (err: any) {
      console.error('[P2P] Failed to initialize Trystero room', err);
      this.callbacks.onConnectionStatus('error', err?.message || 'WebRTC initialization failed');
    }
  }

  private sendSnapshotToPeer(targetPeerId: string) {
    if (!this.actionSnapshot) return;
    const snapshot: P2PSnapshotPayload = {
      players: Array.from(this.players.values()),
      playlistId: this.playlistId,
      currentTrackIndex: this.currentTrackIndex,
      playbackState: this.playbackState,
      playbackPositionSeconds: this.playbackPositionSeconds,
      lastPlaybackCommandAt: this.lastPlaybackCommandAt,
      hostSessionId: this.hostSessionId || this.sessionId,
      musicStartedAt: this.musicStartedAt,
    };
    this.actionSnapshot.send(snapshot, { target: targetPeerId });
  }

  private broadcastJoin(player: PlayerData) {
    if (!this.actionJoin) return;
    this.actionJoin.send(player);
  }

  private removePeer(peerId: string) {
    // Check if any player's sessionId matches or starts with peerId
    let removedPlayerId: string | null = null;
    for (const [sid] of this.players.entries()) {
      if (sid === peerId || sid.includes(peerId) || peerId.includes(sid)) {
        removedPlayerId = sid;
        break;
      }
    }

    if (removedPlayerId && removedPlayerId !== this.sessionId) {
      this.players.delete(removedPlayerId);
      this.callbacks.onPlayersChange(new Map(this.players));
    }

    // Host migration if host left
    if (removedPlayerId === this.hostSessionId || (!this.players.has(this.hostSessionId) && !this.isHost)) {
      const remainingIds = Array.from(this.players.keys()).sort();
      if (remainingIds.length > 0) {
        const nextHostId = remainingIds[0];
        this.hostSessionId = nextHostId;
        this.isHost = (nextHostId === this.sessionId);

        const newHostPlayer = this.players.get(nextHostId);
        if (newHostPlayer) {
          newHostPlayer.isHost = true;
          this.callbacks.onPlayersChange(new Map(this.players));
        }

        this.callbacks.onHostChange(this.isHost, this.hostSessionId);
      }
    }
  }

  // ── Public User Actions ────────────────────────────────────────────────────

  public sendMove(dx: number, dy: number): void {
    const me = this.players.get(this.sessionId);
    if (!me) return;

    // Local movement update with coordinate boundary clamping
    let nx = me.x + dx;
    let ny = me.y + dy;
    nx = Math.max(GROUND_BOUNDS.minX, Math.min(GROUND_BOUNDS.maxX, nx));
    ny = Math.max(GROUND_BOUNDS.minY, Math.min(GROUND_BOUNDS.maxY, ny));

    let facing = me.facing;
    if (Math.abs(dx) > Math.abs(dy)) {
      facing = dx > 0 ? 'right' : 'left';
    } else if (dy !== 0) {
      facing = dy > 0 ? 'down' : 'up';
    }

    me.x = nx;
    me.y = ny;
    me.facing = facing;

    this.callbacks.onPlayersChange(new Map(this.players));

    // Broadcast move to all peers
    if (this.actionMove) {
      this.actionMove.send({
        sessionId: this.sessionId,
        x: nx,
        y: ny,
        facing,
      });
    }
  }

  public sendDance(isDancing: boolean, danceStyle: 'garba' | 'dandiya' = 'garba'): void {
    const me = this.players.get(this.sessionId);
    if (!me) return;

    me.isDancing = isDancing;
    me.danceStyle = danceStyle;

    this.callbacks.onPlayersChange(new Map(this.players));

    // Broadcast dance state to all peers
    if (this.actionDance) {
      this.actionDance.send({
        sessionId: this.sessionId,
        isDancing,
        danceStyle,
      });
    }
  }

  // ── Music Actions ──────────────────────────────────────────────────────────

  public sendMusicPlay(trackIndex?: number, positionSeconds?: number): void {
    this.playbackState = 'playing';
    if (typeof trackIndex === 'number') this.currentTrackIndex = trackIndex;
    if (typeof positionSeconds === 'number') this.playbackPositionSeconds = positionSeconds;
    this.lastPlaybackCommandAt = Date.now();

    const cmd: MusicCommand = {
      type: 'play',
      trackIndex: this.currentTrackIndex,
      positionSeconds: this.playbackPositionSeconds,
      lastPlaybackCommandAt: this.lastPlaybackCommandAt,
      playbackState: 'playing',
    };

    this.callbacks.onMusicCommand(cmd);
    if (this.actionMusic) this.actionMusic.send(cmd);
  }

  public sendMusicPause(positionSeconds?: number): void {
    this.playbackState = 'paused';
    if (typeof positionSeconds === 'number') this.playbackPositionSeconds = positionSeconds;
    this.lastPlaybackCommandAt = Date.now();

    const cmd: MusicCommand = {
      type: 'pause',
      positionSeconds: this.playbackPositionSeconds,
      lastPlaybackCommandAt: this.lastPlaybackCommandAt,
      playbackState: 'paused',
    };

    this.callbacks.onMusicCommand(cmd);
    if (this.actionMusic) this.actionMusic.send(cmd);
  }

  public sendMusicNext(trackIndex?: number): void {
    this.playbackState = 'playing';
    if (typeof trackIndex === 'number') this.currentTrackIndex = trackIndex;
    this.playbackPositionSeconds = 0;
    this.lastPlaybackCommandAt = Date.now();

    const cmd: MusicCommand = {
      type: 'next',
      trackIndex: this.currentTrackIndex,
      positionSeconds: 0,
      lastPlaybackCommandAt: this.lastPlaybackCommandAt,
      playbackState: 'playing',
    };

    this.callbacks.onMusicCommand(cmd);
    if (this.actionMusic) this.actionMusic.send(cmd);
  }

  public sendMusicSync(trackIndex: number, positionSeconds: number, playbackState: 'playing' | 'paused'): void {
    this.currentTrackIndex = trackIndex;
    this.playbackPositionSeconds = positionSeconds;
    this.playbackState = playbackState;
    this.lastPlaybackCommandAt = Date.now();

    if (this.actionMusic && this.isHost) {
      this.actionMusic.send({
        type: 'sync',
        trackIndex,
        positionSeconds,
        playbackState,
        lastPlaybackCommandAt: this.lastPlaybackCommandAt,
      });
    }
  }

  public leave(): void {
    this.isDestroyed = true;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.actionLeave) {
      try {
        this.actionLeave.send({ sessionId: this.sessionId });
      } catch {}
    }

    if (this.trysteroRoom) {
      try {
        this.trysteroRoom.leave();
      } catch {}
      this.trysteroRoom = null;
    }

    this.players.clear();
    this.connectedPeers.clear();
  }
}
