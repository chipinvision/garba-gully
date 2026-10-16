/**
 * useGarbaRoom — React hook that manages room connections.
 * Supports:
 * 1. Serverless WebRTC P2P Mode (Trystero): 100% Netlify-native, zero external servers or Render needed!
 * 2. Dedicated Colyseus Server Mode: For custom WebSocket servers.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Room } from '@colyseus/sdk';
import { colyseusClient, resolveToken, schemaPlayersToMap, isP2PMode } from '../colyseus';
import { P2PGarbaRoom } from '../services/p2pGarbaRoom';
import type { PlayerData } from '../types';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface MusicCommand {
  type: 'play' | 'pause' | 'next' | 'sync' | 'init';
  trackIndex?: number;
  positionSeconds?: number;
  lastPlaybackCommandAt?: number;
  playlistId?: string;
  playbackState?: 'playing' | 'paused';
}

export interface RoomHookResult {
  room: any | null;
  roomId: string;
  sessionId: string;
  players: Map<string, PlayerData>;
  inviteToken: string;
  musicStartedAt: number;
  connectionStatus: ConnectionStatus;
  isHost: boolean;
  errorMessage: string;
  isP2P: boolean;
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
  // Music controls (host-authorized)
  sendMusicPlay:  (trackIndex?: number, positionSeconds?: number) => void;
  sendMusicPause: (positionSeconds?: number) => void;
  sendMusicNext:  (trackIndex?: number) => void;
  sendMusicSync:  (trackIndex: number, positionSeconds: number, playbackState: 'playing' | 'paused') => void;
}

function generateP2PRoomId(): string {
  const chars = '23456789abcdefghjkmnpqrstuvwxyz'; // readable base32 without ambiguous 0/1/o/l
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `garba-${code}`;
}

export function useGarbaRoom(): RoomHookResult {
  const [colyseusRoom, setColyseusRoom] = useState<Room | null>(null);
  const [p2pRoomInstance, setP2pRoomInstance] = useState<P2PGarbaRoom | null>(null);
  const [activeMode, setActiveMode] = useState<'p2p' | 'colyseus'>('p2p');

  const [roomId, setRoomId] = useState('');
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

  const colyseusRoomRef = useRef<Room | null>(null);
  const p2pRoomRef = useRef<P2PGarbaRoom | null>(null);

  // ── Colyseus Binder ────────────────────────────────────────────────────────
  const bindColyseusRoom = useCallback((r: Room, sid: string) => {
    colyseusRoomRef.current = r;
    setColyseusRoom(r);
    setSessionId(sid);
    setRoomId(r.roomId);
    setActiveMode('colyseus');
    setConnectionStatus('connected');
    setErrorMessage('');

    const syncState = () => {
      const ps = schemaPlayersToMap(r.state?.players);
      setPlayers(new Map(ps));
      setInviteToken(r.state?.inviteToken ?? r.roomId);
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

    r.onStateChange(() => syncState());

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

    r.onLeave((_code) => {
      setConnectionStatus('disconnected');
      setColyseusRoom(null);
      colyseusRoomRef.current = null;
    });

    r.onError((code, msg) => {
      console.error('[Colyseus] room error', code, msg);
      setErrorMessage(msg || `Connection error (${code})`);
      setConnectionStatus('error');
    });
  }, []);

  // ── Create Room Action ─────────────────────────────────────────────────────
  const createRoom = useCallback(async (
    nickname: string,
    avatarId: number,
    outfitId: number,
    playlistIdParam?: string
  ) => {
    setConnectionStatus('connecting');
    setErrorMessage('');

    const useP2P = isP2PMode();

    if (useP2P) {
      try {
        const generatedId = generateP2PRoomId();
        setActiveMode('p2p');
        setRoomId(generatedId);
        setInviteToken(generatedId);
        setPlaylistId((playlistIdParam || '').trim());

        const p2p = new P2PGarbaRoom(generatedId, {
          onPlayersChange: (newPlayers) => setPlayers(new Map(newPlayers)),
          onMusicCommand: (cmd) => {
            if (typeof cmd.trackIndex === 'number') setCurrentTrackIndex(cmd.trackIndex);
            if (typeof cmd.positionSeconds === 'number') setPlaybackPositionSeconds(cmd.positionSeconds);
            if (cmd.playbackState) setPlaybackState(cmd.playbackState);
            if (typeof cmd.lastPlaybackCommandAt === 'number') setLastPlaybackCommandAt(cmd.lastPlaybackCommandAt);
            if (cmd.playlistId) setPlaylistId(cmd.playlistId);
            setLatestMusicCommand(cmd);
          },
          onConnectionStatus: (st, err) => {
            setConnectionStatus(st);
            if (err) setErrorMessage(err);
          },
          onHostChange: (hostStatus, _hostId) => {
            setIsHost(hostStatus);
            if (hostStatus) setErrorMessage('');
          },
        });

        p2pRoomRef.current = p2p;
        setP2pRoomInstance(p2p);
        setSessionId(p2p.sessionId);
        setIsHost(true);

        await p2p.initAsHost(nickname, avatarId, outfitId, playlistIdParam);
        setConnectionStatus('connected');
      } catch (err: any) {
        setConnectionStatus('error');
        setErrorMessage(err?.message || 'Failed to initialize serverless P2P room.');
        throw err;
      }
      return;
    }

    // Colyseus mode
    try {
      const r = await colyseusClient.create('garba_room', {
        nickname,
        avatarId,
        outfitId,
        playlistId: (playlistIdParam || '').trim(),
      });
      bindColyseusRoom(r, r.sessionId);
    } catch (e: any) {
      setConnectionStatus('error');
      setErrorMessage(e?.message || 'Failed to create room');
      throw e;
    }
  }, [bindColyseusRoom]);

  // ── Join Room Action ───────────────────────────────────────────────────────
  const joinRoom = useCallback(async (
    token: string,
    nickname: string,
    avatarId: number,
    outfitId: number,
    directRoomId?: string
  ) => {
    setConnectionStatus('connecting');
    setErrorMessage('');

    const targetCode = (directRoomId || token || '').trim();
    const isP2PCode = targetCode.startsWith('garba-') || isP2PMode();

    if (isP2PCode) {
      try {
        setActiveMode('p2p');
        setRoomId(targetCode);
        setInviteToken(targetCode);

        const p2p = new P2PGarbaRoom(targetCode, {
          onPlayersChange: (newPlayers) => setPlayers(new Map(newPlayers)),
          onMusicCommand: (cmd) => {
            if (typeof cmd.trackIndex === 'number') setCurrentTrackIndex(cmd.trackIndex);
            if (typeof cmd.positionSeconds === 'number') setPlaybackPositionSeconds(cmd.positionSeconds);
            if (cmd.playbackState) setPlaybackState(cmd.playbackState);
            if (typeof cmd.lastPlaybackCommandAt === 'number') setLastPlaybackCommandAt(cmd.lastPlaybackCommandAt);
            if (cmd.playlistId) setPlaylistId(cmd.playlistId);
            setLatestMusicCommand(cmd);
          },
          onConnectionStatus: (st, err) => {
            setConnectionStatus(st);
            if (err) setErrorMessage(err);
          },
          onHostChange: (hostStatus) => {
            setIsHost(hostStatus);
          },
        });

        p2pRoomRef.current = p2p;
        setP2pRoomInstance(p2p);
        setSessionId(p2p.sessionId);
        setIsHost(false);

        await p2p.initAsGuest(nickname, avatarId, outfitId);
      } catch (err: any) {
        setConnectionStatus('error');
        setErrorMessage(err?.message || 'Failed to connect to P2P room.');
        throw err;
      }
      return;
    }

    // Colyseus mode
    try {
      let resolvedRoomId = directRoomId;
      if (!resolvedRoomId) {
        resolvedRoomId = await resolveToken(token);
      }
      const r = await colyseusClient.joinById(resolvedRoomId, {
        nickname,
        avatarId,
        outfitId,
        inviteToken: token,
      });
      bindColyseusRoom(r, r.sessionId);
    } catch (e: any) {
      setConnectionStatus('error');
      const msg = e?.message || 'Failed to join room';
      setErrorMessage(msg.includes('not found') ? 'Room not found or has ended.' : msg);
      throw e;
    }
  }, [bindColyseusRoom]);

  // ── Leave Room Action ──────────────────────────────────────────────────────
  const leaveRoom = useCallback(() => {
    if (p2pRoomRef.current) {
      p2pRoomRef.current.leave();
      p2pRoomRef.current = null;
    }
    if (colyseusRoomRef.current) {
      colyseusRoomRef.current.leave();
      colyseusRoomRef.current = null;
    }

    setP2pRoomInstance(null);
    setColyseusRoom(null);
    setSessionId('');
    setRoomId('');
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

  // ── User Movement & Dance ──────────────────────────────────────────────────
  const sendMove = useCallback((dx: number, dy: number) => {
    if (activeMode === 'p2p' && p2pRoomRef.current) {
      p2pRoomRef.current.sendMove(dx, dy);
    } else if (colyseusRoomRef.current) {
      colyseusRoomRef.current.send('move', { dx, dy });
    }
  }, [activeMode]);

  const sendDance = useCallback((isDancingParam: boolean, danceStyleParam?: 'garba' | 'dandiya') => {
    if (activeMode === 'p2p' && p2pRoomRef.current) {
      p2pRoomRef.current.sendDance(isDancingParam, danceStyleParam);
    } else if (colyseusRoomRef.current) {
      colyseusRoomRef.current.send('dance', { isDancing: isDancingParam, danceStyle: danceStyleParam });
    }
  }, [activeMode]);

  // ── Music Control Actions ──────────────────────────────────────────────────
  const sendMusicPlay = useCallback((trackIndex?: number, positionSeconds?: number) => {
    if (activeMode === 'p2p' && p2pRoomRef.current) {
      p2pRoomRef.current.sendMusicPlay(trackIndex, positionSeconds);
    } else if (colyseusRoomRef.current) {
      colyseusRoomRef.current.send('music:play', { trackIndex, positionSeconds });
    }
  }, [activeMode]);

  const sendMusicPause = useCallback((positionSeconds?: number) => {
    if (activeMode === 'p2p' && p2pRoomRef.current) {
      p2pRoomRef.current.sendMusicPause(positionSeconds);
    } else if (colyseusRoomRef.current) {
      colyseusRoomRef.current.send('music:pause', { positionSeconds });
    }
  }, [activeMode]);

  const sendMusicNext = useCallback((trackIndex?: number) => {
    if (activeMode === 'p2p' && p2pRoomRef.current) {
      p2pRoomRef.current.sendMusicNext(trackIndex);
    } else if (colyseusRoomRef.current) {
      colyseusRoomRef.current.send('music:next', { trackIndex });
    }
  }, [activeMode]);

  const sendMusicSync = useCallback((trackIndex: number, positionSeconds: number, state: 'playing' | 'paused') => {
    if (activeMode === 'p2p' && p2pRoomRef.current) {
      p2pRoomRef.current.sendMusicSync(trackIndex, positionSeconds, state);
    } else if (colyseusRoomRef.current) {
      colyseusRoomRef.current.send('music:sync', { trackIndex, positionSeconds, playbackState: state });
    }
  }, [activeMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (p2pRoomRef.current) p2pRoomRef.current.leave();
      if (colyseusRoomRef.current) colyseusRoomRef.current.leave();
    };
  }, []);

  return {
    room: activeMode === 'p2p' ? p2pRoomInstance : colyseusRoom,
    roomId: roomId || p2pRoomInstance?.roomId || colyseusRoom?.roomId || '',
    sessionId,
    players,
    inviteToken: inviteToken || roomId,
    musicStartedAt,
    connectionStatus,
    isHost,
    errorMessage,
    isP2P: activeMode === 'p2p',
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
