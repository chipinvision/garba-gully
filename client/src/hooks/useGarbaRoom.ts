/**
 * useGarbaRoom — React hook that manages the Colyseus room connection
 * and exposes room state, YouTube playlist state, and actions to UI components.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Room } from '@colyseus/sdk';
import { colyseusClient, resolveToken, schemaPlayersToMap } from '../colyseus';
import type { PlayerData } from '../types';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface MusicCommand {
  type: 'play' | 'pause' | 'next' | 'init';
  trackIndex?: number;
  positionSeconds?: number;
  lastPlaybackCommandAt?: number;
  playlistId?: string;
  playbackState?: 'playing' | 'paused';
}

export interface RoomHookResult {
  room: Room | null;
  roomId: string;
  sessionId: string;
  players: Map<string, PlayerData>;
  inviteToken: string;
  musicStartedAt: number;
  connectionStatus: ConnectionStatus;
  isHost: boolean;
  errorMessage: string;
  // YouTube Playlist state
  playlistId: string;
  currentTrackIndex: number;
  playbackState: 'playing' | 'paused';
  playbackPositionSeconds: number;
  lastPlaybackCommandAt: number;
  latestMusicCommand: MusicCommand | null;
  // Actions
  createRoom: (nickname: string, avatarId: number, outfitId: number, playlistId?: string) => Promise<void>;
  joinRoom:   (token: string, nickname: string, avatarId: number, outfitId: number, directRoomId?: string) => Promise<void>;
  leaveRoom:  () => void;
  sendMove:   (dx: number, dy: number) => void;
  sendDance:  (isDancing: boolean, danceStyle?: 'garba' | 'dandiya') => void;
  // Music controls (host-authorized on server)
  sendMusicPlay:  (trackIndex?: number, positionSeconds?: number) => void;
  sendMusicPause: (positionSeconds?: number) => void;
  sendMusicNext:  (trackIndex?: number) => void;
  sendMusicSync:  (trackIndex: number, positionSeconds: number, playbackState: 'playing' | 'paused') => void;
}

export function useGarbaRoom(): RoomHookResult {
  const [room, setRoom] = useState<Room | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [players, setPlayers] = useState<Map<string, PlayerData>>(new Map());
  const [inviteToken, setInviteToken] = useState('');
  const [musicStartedAt, setMusicStartedAt] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState('');
  const [isHost, setIsHost] = useState(false);

  // YouTube Playlist state
  const [playlistId, setPlaylistId] = useState('');
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [playbackState, setPlaybackState] = useState<'playing' | 'paused'>('paused');
  const [playbackPositionSeconds, setPlaybackPositionSeconds] = useState(0);
  const [lastPlaybackCommandAt, setLastPlaybackCommandAt] = useState(0);
  const [latestMusicCommand, setLatestMusicCommand] = useState<MusicCommand | null>(null);

  // Keep a ref to avoid stale closures in callbacks
  const roomRef = useRef<Room | null>(null);

  const bindRoom = useCallback((r: Room, sid: string) => {
    roomRef.current = r;
    setRoom(r);
    setSessionId(sid);
    setConnectionStatus('connected');
    setErrorMessage('');

    // Initial state sync
    const syncState = () => {
      const ps = schemaPlayersToMap(r.state?.players);
      setPlayers(new Map(ps));
      setInviteToken(r.state?.inviteToken ?? '');
      setMusicStartedAt(r.state?.musicStartedAt ?? 0);
      setPlaylistId(r.state?.playlistId ?? '');
      setCurrentTrackIndex(r.state?.currentTrackIndex ?? 0);
      setPlaybackState(r.state?.playbackState === 'playing' ? 'playing' : 'paused');
      setPlaybackPositionSeconds(r.state?.playbackPositionSeconds ?? 0);
      setLastPlaybackCommandAt(r.state?.lastPlaybackCommandAt ?? 0);
      const me = ps.get(sid);
      setIsHost(me?.isHost ?? false);
    };
    syncState();

    // Listen for state changes
    r.onStateChange(() => syncState());

    // Server messages
    r.onMessage('musicSync', (data: { startedAt: number }) => {
      setMusicStartedAt(data.startedAt);
    });

    r.onMessage('music:init', (data: any) => {
      if (data.playlistId) setPlaylistId(data.playlistId);
      if (typeof data.currentTrackIndex === 'number') setCurrentTrackIndex(data.currentTrackIndex);
      if (data.playbackState) setPlaybackState(data.playbackState);
      if (typeof data.playbackPositionSeconds === 'number') setPlaybackPositionSeconds(data.playbackPositionSeconds);
      if (typeof data.lastPlaybackCommandAt === 'number') setLastPlaybackCommandAt(data.lastPlaybackCommandAt);
      setLatestMusicCommand({ type: 'init', ...data });
    });

    r.onMessage('music:play', (data: any) => {
      setPlaybackState('playing');
      if (typeof data.trackIndex === 'number') setCurrentTrackIndex(data.trackIndex);
      if (typeof data.positionSeconds === 'number') setPlaybackPositionSeconds(data.positionSeconds);
      if (typeof data.lastPlaybackCommandAt === 'number') setLastPlaybackCommandAt(data.lastPlaybackCommandAt);
      setLatestMusicCommand({ type: 'play', ...data });
    });

    r.onMessage('music:pause', (data: any) => {
      setPlaybackState('paused');
      if (typeof data.positionSeconds === 'number') setPlaybackPositionSeconds(data.positionSeconds);
      setLatestMusicCommand({ type: 'pause', ...data });
    });

    r.onMessage('music:next', (data: any) => {
      setPlaybackState('playing');
      if (typeof data.trackIndex === 'number') setCurrentTrackIndex(data.trackIndex);
      setPlaybackPositionSeconds(0);
      if (typeof data.lastPlaybackCommandAt === 'number') setLastPlaybackCommandAt(data.lastPlaybackCommandAt);
      setLatestMusicCommand({ type: 'next', ...data });
    });

    r.onMessage('hostLeft', (data: { message: string }) => {
      setErrorMessage(data.message || 'The host has left. The room is closing.');
      setConnectionStatus('error');
    });

    r.onMessage('pong', (_data: any) => {
      // Latency measurement
    });

    // Connection events
    r.onLeave((_code) => {
      setConnectionStatus('disconnected');
      setRoom(null);
      roomRef.current = null;
    });

    r.onError((code, msg) => {
      console.error('[room] error', code, msg);
      setErrorMessage(msg || `Connection error (${code})`);
      setConnectionStatus('error');
    });
  }, []);

  const createRoom = useCallback(async (
    nickname: string,
    avatarId: number,
    outfitId: number,
    playlistId?: string
  ) => {
    setConnectionStatus('connecting');
    setErrorMessage('');
    try {
      const r = await colyseusClient.create('garba_room', {
        nickname,
        avatarId,
        outfitId,
        playlistId: (playlistId || '').trim(),
      });
      bindRoom(r, r.sessionId);
    } catch (e: any) {
      setConnectionStatus('error');
      setErrorMessage(e?.message || 'Failed to create room');
      throw e;
    }
  }, [bindRoom]);

  const joinRoom = useCallback(async (token: string, nickname: string, avatarId: number, outfitId: number, directRoomId?: string) => {
    setConnectionStatus('connecting');
    setErrorMessage('');
    try {
      // If direct roomId is known from the invite link, use it directly without HTTP fetch
      let roomId = directRoomId;
      if (!roomId) {
        roomId = await resolveToken(token);
      }
      const r = await colyseusClient.joinById(roomId, { nickname, avatarId, outfitId, inviteToken: token });
      bindRoom(r, r.sessionId);
    } catch (e: any) {
      setConnectionStatus('error');
      const msg = e?.message || 'Failed to join room';
      setErrorMessage(msg.includes('not found') ? 'Room not found or has ended.' : msg);
      throw e;
    }
  }, [bindRoom]);

  const leaveRoom = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.leave();
      roomRef.current = null;
    }
    setRoom(null);
    setSessionId('');
    setPlayers(new Map());
    setInviteToken('');
    setPlaylistId('');
    setCurrentTrackIndex(0);
    setPlaybackState('paused');
    setPlaybackPositionSeconds(0);
    setLastPlaybackCommandAt(0);
    setLatestMusicCommand(null);
    setConnectionStatus('disconnected');
    setIsHost(false);
  }, []);

  const sendMove = useCallback((dx: number, dy: number) => {
    roomRef.current?.send('move', { dx, dy });
  }, []);

  const sendDance = useCallback((isDancing: boolean, danceStyle?: 'garba' | 'dandiya') => {
    roomRef.current?.send('dance', { isDancing, danceStyle });
  }, []);

  const sendMusicPlay = useCallback((trackIndex?: number, positionSeconds?: number) => {
    roomRef.current?.send('music:play', { trackIndex, positionSeconds });
  }, []);

  const sendMusicPause = useCallback((positionSeconds?: number) => {
    roomRef.current?.send('music:pause', { positionSeconds });
  }, []);

  const sendMusicNext = useCallback((trackIndex?: number) => {
    roomRef.current?.send('music:next', { trackIndex });
  }, []);

  const sendMusicSync = useCallback((trackIndex: number, positionSeconds: number, playbackState: 'playing' | 'paused') => {
    roomRef.current?.send('music:sync', { trackIndex, positionSeconds, playbackState });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.leave();
      }
    };
  }, []);

  return {
    room,
    roomId: roomRef.current?.roomId || room?.roomId || '',
    sessionId,
    players,
    inviteToken,
    musicStartedAt,
    connectionStatus,
    isHost,
    errorMessage,
    playlistId,
    currentTrackIndex,
    playbackState,
    playbackPositionSeconds,
    lastPlaybackCommandAt,
    latestMusicCommand,
    createRoom,
    joinRoom,
    leaveRoom,
    sendMove,
    sendDance,
    sendMusicPlay,
    sendMusicPause,
    sendMusicNext,
    sendMusicSync,
  };
}
