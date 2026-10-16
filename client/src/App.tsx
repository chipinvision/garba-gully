import { useState, useEffect, useCallback, useRef } from 'react';
import { LandingPage }  from './components/LandingPage';
import { LobbyPage }    from './components/LobbyPage';
import { GameScreen }   from './components/GameScreen';
import { useGarbaRoom } from './hooks/useGarbaRoom';
import { setServerUrl } from './colyseus';
import type { AppScreen } from './types';
import './App.css';

// Parse invite parameters from URL
function getInviteParamsFromUrl(): { token?: string; roomId?: string; server?: string } {
  const params = new URLSearchParams(window.location.search);
  return {
    token: params.get('invite') || undefined,
    roomId: params.get('room') || undefined,
    server: params.get('server') || undefined,
  };
}

type LobbyMode = 'create' | 'join';

function App() {
  const [screen, setScreen]             = useState<AppScreen>('landing');
  const [lobbyMode, setLobbyMode]       = useState<LobbyMode>('create');
  const [inviteToken, setInviteToken]   = useState<string | undefined>(() => getInviteParamsFromUrl().token);
  const [directRoomId, setDirectRoomId] = useState<string | undefined>(() => getInviteParamsFromUrl().roomId);
  const [toast, setToast]               = useState<{ msg: string; type: 'info' | 'error' | 'success' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const room = useGarbaRoom();

  const showToast = useCallback((msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // Auto-redirect if URL has invite token or roomId
  useEffect(() => {
    const { token, roomId, server } = getInviteParamsFromUrl();
    if (server) {
      setServerUrl(server);
    }
    if (token || roomId) {
      if (token) setInviteToken(token);
      if (roomId) setDirectRoomId(roomId);
      setLobbyMode('join');
      setScreen('lobby');
    }
  }, []);

  // Watch connection errors while in-game
  useEffect(() => {
    if (screen === 'game' && room.connectionStatus === 'error') {
      showToast(room.errorMessage || 'Connection error', 'error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.connectionStatus, room.errorMessage]);

  // ── Navigation handlers ──────────────────────────────────────────────────

  const goToCreate = () => {
    setLobbyMode('create');
    setInviteToken(undefined);
    setScreen('lobby');
  };

  const goToJoin = (token: string) => {
    setLobbyMode('join');
    setInviteToken(token);
    setScreen('lobby');
  };

  const goBack = () => {
    setScreen('landing');
  };

  const handleEnterRoom = useCallback(async (
    nickname: string,
    avatarId: number,
    outfitId: number,
    playlistId?: string,
  ) => {
    try {
      if (lobbyMode === 'create') {
        await room.createRoom(nickname, avatarId, outfitId, playlistId);
      } else {
        if (!inviteToken && !directRoomId) throw new Error('Missing invite token or room ID');
        await room.joinRoom(inviteToken || directRoomId || '', nickname, avatarId, outfitId, directRoomId);
      }
      // Update URL with invite token for easy sharing
      if (room.inviteToken) {
        const url = new URL(window.location.href);
        url.searchParams.set('invite', room.inviteToken);
        if (room.roomId) url.searchParams.set('room', room.roomId);
        window.history.replaceState({}, '', url.toString());
      }
      setScreen('game');
    } catch (_e) {
      // Error is shown via room.errorMessage
    }
  }, [lobbyMode, inviteToken, directRoomId, room]);

  // After room is connected, update invite token and URL
  useEffect(() => {
    if (room.inviteToken && screen === 'game') {
      const url = new URL(window.location.href);
      url.searchParams.set('invite', room.inviteToken);
      if (room.roomId) url.searchParams.set('room', room.roomId);
      window.history.replaceState({}, '', url.toString());
    }
  }, [room.inviteToken, room.roomId, screen]);

  const handleLeave = useCallback(() => {
    room.leaveRoom();
    // Clear invite token from URL
    window.history.replaceState({}, '', window.location.pathname);
    setInviteToken(undefined);
    setDirectRoomId(undefined);
    setScreen('landing');
  }, [room]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="app" id="app-root">
      {screen === 'landing' && (
        <LandingPage
          inviteToken={inviteToken}
          onCreateRoom={goToCreate}
          onJoinRoom={goToJoin}
        />
      )}

      {screen === 'lobby' && (
        <LobbyPage
          mode={lobbyMode}
          inviteToken={inviteToken}
          isConnecting={room.connectionStatus === 'connecting'}
          errorMessage={room.errorMessage}
          onBack={goBack}
          onEnter={handleEnterRoom}
        />
      )}

      {screen === 'game' && (
        <GameScreen
          sessionId={room.sessionId}
          players={room.players}
          inviteToken={room.inviteToken}
          roomId={room.roomId}
          isHost={room.isHost}
          connectionStatus={room.connectionStatus}
          playlistId={room.playlistId}
          currentTrackIndex={room.currentTrackIndex}
          playbackState={room.playbackState}
          playbackPositionSeconds={room.playbackPositionSeconds}
          lastPlaybackCommandAt={room.lastPlaybackCommandAt}
          latestMusicCommand={room.latestMusicCommand}
          onMove={room.sendMove}
          onDance={room.sendDance}
          onLeave={handleLeave}
          onMusicPlay={room.sendMusicPlay}
          onMusicPause={room.sendMusicPause}
          onMusicNext={room.sendMusicNext}
          onMusicSync={room.sendMusicSync}
        />
      )}

      {/* Toast notifications */}
      {toast && (
        <div className="toast-container" role="status" aria-live="polite">
          <div className={`toast toast-${toast.type}`}>
            <span>{toast.type === 'error' ? '⚠️' : toast.type === 'success' ? '✓' : 'ℹ️'}</span>
            <span>{toast.msg}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
