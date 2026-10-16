import React, { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import { GarbaScene } from '../game/GarbaScene';
import { YouTubeMusicPanel } from './YouTubeMusicPanel';
import { DancePreviewModal } from './DancePreviewModal';
import { ServerSettingsModal } from './ServerSettingsModal';
import { getServerUrl } from '../colyseus';
import type { DanceStyle } from '../game/garbaChoreography';
import type { PlayerData } from '../types';
import type { MusicCommand } from '../hooks/useGarbaRoom';
import './GameScreen.css';

interface GameScreenProps {
  sessionId: string;
  players: Map<string, PlayerData>;
  inviteToken: string;
  roomId?: string;
  isHost: boolean;
  connectionStatus: string;
  playlistId: string;
  currentTrackIndex: number;
  playbackState: 'playing' | 'paused';
  playbackPositionSeconds: number;
  lastPlaybackCommandAt: number;
  latestMusicCommand: MusicCommand | null;
  onMove: (dx: number, dy: number) => void;
  onDance: (isDancing: boolean, danceStyle?: 'garba' | 'dandiya') => void;
  onLeave: () => void;
  onMusicPlay: (trackIndex?: number, positionSeconds?: number) => void;
  onMusicPause: (positionSeconds?: number) => void;
  onMusicNext: (trackIndex?: number) => void;
  onMusicSync: (trackIndex: number, positionSeconds: number, state: 'playing' | 'paused') => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  sessionId,
  players,
  inviteToken,
  roomId,
  isHost,
  connectionStatus,
  playlistId,
  currentTrackIndex,
  playbackState,
  playbackPositionSeconds,
  lastPlaybackCommandAt,
  latestMusicCommand,
  onMove,
  onDance,
  onLeave,
  onMusicPlay,
  onMusicPause,
  onMusicNext,
  onMusicSync,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef      = useRef<Phaser.Game | null>(null);
  const sceneRef     = useRef<GarbaScene | null>(null);

  const [isDancing, setIsDancing]             = useState(false);
  const [danceStyle, setDanceStyle]           = useState<DanceStyle>('garba');
  const [showDancePreview, setShowDancePreview] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [copied, setCopied]                   = useState(false);
  const [showPlayers, setShowPlayers]         = useState(false);
  const [hostLeftMsg, setHostLeftMsg]         = useState('');

  // Player list
  const playerList = Array.from(players.values());

  // ── Init Phaser ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const scene = new GarbaScene();
    sceneRef.current = scene;

    scene.onMove = (dx, dy) => onMove(dx, dy);
    scene.onDanceToggle = (dancing, style) => {
      setIsDancing(dancing);
      if (style) setDanceStyle(style);
      onDance(dancing, style || danceStyle);
    };

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: containerRef.current.clientWidth || 800,
      height: containerRef.current.clientHeight || 600,
      backgroundColor: '#0d0814',
      scene: [scene],
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      render: {
        antialias: true,
        pixelArt: false,
      },
      disableContextMenu: true,
      banner: false,
    });

    gameRef.current = game;

    return () => {
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync session id ──────────────────────────────────────────────────────
  useEffect(() => {
    sceneRef.current?.setMySessionId(sessionId);
  }, [sessionId]);

  // ── Sync players to scene ────────────────────────────────────────────────
  useEffect(() => {
    sceneRef.current?.syncPlayers(players);
  }, [players]);

  // ── Handle dance toggle from UI button ───────────────────────────────────
  const handleDanceToggle = useCallback(() => {
    const next = !isDancing;
    setIsDancing(next);
    sceneRef.current?.setDancing(next, danceStyle);
    onDance(next, danceStyle);
  }, [isDancing, danceStyle, onDance]);

  // ── Handle style selection ───────────────────────────────────────────────
  const handleStyleSelect = useCallback((style: DanceStyle) => {
    setDanceStyle(style);
    sceneRef.current?.setDanceStyle(style);
    if (isDancing) {
      onDance(true, style);
    }
  }, [isDancing, onDance]);

  // ── Copy invite link ─────────────────────────────────────────────────────
  const copyInviteLink = useCallback(async () => {
    const serverUrl = getServerUrl();
    const isCustomServer = serverUrl && !serverUrl.includes('localhost') && !serverUrl.includes('127.0.0.1');
    const serverParam = isCustomServer ? `&server=${encodeURIComponent(serverUrl)}` : '';
    const roomParam = roomId ? `&room=${encodeURIComponent(roomId)}` : '';
    const link = `${window.location.origin}?invite=${encodeURIComponent(inviteToken)}${roomParam}${serverParam}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // Fallback: select a text input
      const el = document.createElement('input');
      el.value = link;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    }
  }, [inviteToken, roomId]);

  // ── Handle host-left message ─────────────────────────────────────────────
  useEffect(() => {
    if (connectionStatus === 'error') {
      setHostLeftMsg('The host has left. The room is closing…');
      const t = setTimeout(onLeave, 4000);
      return () => clearTimeout(t);
    }
  }, [connectionStatus, onLeave]);

  return (
    <div className="game-screen">
      {/* ── Phaser canvas container ── */}
      <div className="game-screen__canvas" ref={containerRef} />

      {/* ── Top HUD ── */}
      <div className="game-hud game-hud--top">
        <div className="game-hud__left">
          <div className="game-room-name">
            <span>🪔</span>
            <span>Garba Gully</span>
            {isHost && <span className="badge badge-gold">Host</span>}
          </div>
          <div className="game-player-count">
            <span className={`game-status-dot game-status-dot--${connectionStatus === 'connected' ? 'green' : 'red'}`} />
            {playerList.length} / 8 dancers
          </div>
        </div>

        <div className="game-hud__right">
          {/* Invite button */}
          <button
            id="btn-copy-invite"
            className={`btn btn-sm ${copied ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={copyInviteLink}
          >
            {copied ? '✓ Copied!' : '🔗 Invite'}
          </button>

          {/* Players list toggle */}
          <button
            id="btn-show-players"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowPlayers(!showPlayers)}
            aria-label="Show dancers"
          >
            👥 {playerList.length}
          </button>

          {/* Server Settings */}
          <button
            id="btn-game-server-settings"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowServerSettings(true)}
            title="Multiplayer Server Settings"
            aria-label="Server Settings"
          >
            ⚙️
          </button>

          {/* Leave */}
          <button
            id="btn-leave-room"
            className="btn btn-danger btn-sm"
            onClick={onLeave}
          >
            🚪 Leave
          </button>
        </div>
      </div>

      {/* ── Players list panel ── */}
      {showPlayers && (
        <div className="game-players-panel scale-in" role="dialog" aria-label="Dancers in room">
          <div className="game-players-panel__header">
            <span>Dancers ({playerList.length})</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowPlayers(false)}>✕</button>
          </div>
          <div className="game-players-panel__list">
            {playerList.map((p) => (
              <div key={p.sessionId} className={`game-player-row ${p.sessionId === sessionId ? 'game-player-row--me' : ''}`}>
                <span className="game-player-row__emoji">
                  {p.isHost ? '👑' : p.isDancing ? '💃' : '🧍'}
                </span>
                <span className="game-player-row__name">
                  {p.nickname}
                  {p.sessionId === sessionId && <span style={{ opacity: 0.5 }}> (you)</span>}
                </span>
                {p.isDancing && <span className="badge badge-gold" style={{ fontSize: 10, padding: '2px 6px' }}>Dancing</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── YouTube Music Panel ── */}
      {playlistId && (
        <YouTubeMusicPanel
          playlistId={playlistId}
          isHost={isHost}
          playbackState={playbackState}
          currentTrackIndex={currentTrackIndex}
          playbackPositionSeconds={playbackPositionSeconds}
          lastPlaybackCommandAt={lastPlaybackCommandAt}
          latestMusicCommand={latestMusicCommand}
          onMusicPlay={onMusicPlay}
          onMusicPause={onMusicPause}
          onMusicNext={onMusicNext}
          onMusicSync={onMusicSync}
        />
      )}

      {/* ── Bottom controls ── */}
      <div className="game-hud game-hud--bottom">
        {/* Controls hint */}
        <div className="game-controls-hint">
          <span>Move: <kbd>WASD</kbd> / <kbd>↑↓←→</kbd></span>
          <span>Dance: <kbd>Space</kbd> | Garba: <kbd>G</kbd> | Dandiya: <kbd>V</kbd></span>
        </div>

        {/* Action buttons */}
        <div className="game-actions">
          {/* Style Selector */}
          <div className="game-style-selector" role="group" aria-label="Dance Style">
            <button
              id="btn-style-garba"
              className={`game-style-btn ${danceStyle === 'garba' ? 'game-style-btn--active' : ''}`}
              onClick={() => handleStyleSelect('garba')}
              title="Gujarati Garba (3-Clap / Tran Tali)"
            >
              💃 Garba
            </button>
            <button
              id="btn-style-dandiya"
              className={`game-style-btn ${danceStyle === 'dandiya' ? 'game-style-btn--active' : ''}`}
              onClick={() => handleStyleSelect('dandiya')}
              title="Dandiya Raas (Stick Dance)"
            >
              🥢 Dandiya
            </button>
          </div>

          {/* Dance button */}
          <button
            id="btn-dance"
            className={`btn btn-lg game-dance-btn ${isDancing ? 'game-dance-btn--active' : ''}`}
            onClick={handleDanceToggle}
            aria-pressed={isDancing}
          >
            {isDancing ? '🛑 Stop Dancing' : `💃 Dance ${danceStyle === 'garba' ? 'Garba' : 'Dandiya'}!`}
          </button>

          {/* Preview Dances button */}
          <button
            id="btn-open-preview"
            className="btn btn-ghost btn-sm game-preview-btn"
            onClick={() => setShowDancePreview(true)}
            title="Preview choreography and cultural step breakdown"
          >
            ✨ Preview
          </button>
        </div>
      </div>

      {/* ── Interactive Dance Preview Modal ── */}
      {showDancePreview && (
        <DancePreviewModal
          initialStyle={danceStyle}
          currentAvatarId={players.get(sessionId)?.avatarId ?? 0}
          currentOutfitId={players.get(sessionId)?.outfitId ?? 0}
          onClose={() => setShowDancePreview(false)}
          onSelectStyle={(s) => {
            handleStyleSelect(s);
            if (!isDancing) {
              setIsDancing(true);
              sceneRef.current?.setDancing(true, s);
              onDance(true, s);
            }
          }}
        />
      )}

      {/* ── Server Settings Modal ── */}
      {showServerSettings && (
        <ServerSettingsModal
          onClose={() => setShowServerSettings(false)}
        />
      )}

      {/* ── Invite code overlay (for host) ── */}
      {isHost && inviteToken && !copied && (
        <div className="game-invite-hint fade-in">
          <span>🔗 Share your invite link:</span>
          <code>{inviteToken}</code>
          <button className="btn btn-primary btn-sm" onClick={copyInviteLink}>Copy Link</button>
        </div>
      )}

      {/* ── Connection status overlay ── */}
      {connectionStatus === 'reconnecting' && (
        <div className="game-overlay game-overlay--warning">
          <div className="game-overlay__content">
            <div className="lobby__spinner" style={{ borderColor: 'rgba(245,200,66,0.3)', borderTopColor: '#f5c842' }} />
            <p>Reconnecting…</p>
          </div>
        </div>
      )}

      {/* ── Host left overlay ── */}
      {hostLeftMsg && (
        <div className="game-overlay game-overlay--error fade-in">
          <div className="game-overlay__content">
            <span style={{ fontSize: 36 }}>🚪</span>
            <p>{hostLeftMsg}</p>
            <button className="btn btn-primary" onClick={onLeave}>Return to Home</button>
          </div>
        </div>
      )}
    </div>
  );
};
