import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { MusicCommand } from '../hooks/useGarbaRoom';
import './YouTubeMusicPanel.css';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YouTubeMusicPanelProps {
  playlistId: string;
  isHost: boolean;
  playbackState: 'playing' | 'paused';
  currentTrackIndex: number;
  playbackPositionSeconds: number;
  lastPlaybackCommandAt: number;
  latestMusicCommand: MusicCommand | null;
  onMusicPlay: (trackIndex?: number, positionSeconds?: number) => void;
  onMusicPause: (positionSeconds?: number) => void;
  onMusicNext: (trackIndex?: number) => void;
  onMusicSync: (trackIndex: number, positionSeconds: number, state: 'playing' | 'paused') => void;
}

export const YouTubeMusicPanel: React.FC<YouTubeMusicPanelProps> = ({
  playlistId,
  isHost,
  playbackState,
  currentTrackIndex,
  playbackPositionSeconds,
  lastPlaybackCommandAt,
  latestMusicCommand,
  onMusicPlay,
  onMusicPause,
  onMusicNext,
  onMusicSync,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const isApplyingRemote = useRef(false);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [apiReady, setApiReady] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [trackTitle, setTrackTitle] = useState('');
  const [trackIndex, setTrackIndex] = useState(currentTrackIndex);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);

  // ── 1. Load YouTube IFrame API ───────────────────────────────────────────
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setApiReady(true);
      return;
    }

    // Add script tag if not already added
    const existingScript = document.getElementById('youtube-iframe-api');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }

    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevReady) prevReady();
      setApiReady(true);
    };
  }, []);

  // ── 2. Initialize Player ──────────────────────────────────────────────────
  useEffect(() => {
    if (!apiReady || !playlistId || !containerRef.current || playerRef.current) return;

    let mounted = true;

    try {
      playerRef.current = new window.YT.Player(containerRef.current, {
        height: '160',
        width: '280',
        playerVars: {
          listType: 'playlist',
          list: playlistId,
          autoplay: 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            if (!mounted) return;
            setPlayerReady(true);
            setErrorMessage('');

            // Set initial volume
            try {
              event.target.setVolume(80);
            } catch {}

            // Initial alignment
            alignToRoomState(true);
          },
          onStateChange: (event: any) => {
            if (!mounted) return;
            handlePlayerStateChange(event.data);
          },
          onError: (event: any) => {
            if (!mounted) return;
            handlePlayerError(event.data);
          },
        },
      });
    } catch (e: any) {
      setErrorMessage('Failed to initialize YouTube player.');
      console.error('[YouTube] Init error:', e);
    }

    return () => {
      mounted = false;
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {}
        playerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady, playlistId]);

  // ── 3. Alignment Helper ──────────────────────────────────────────────────
  const alignToRoomState = useCallback((isInitial = false) => {
    const player = playerRef.current;
    if (!player || typeof player.playVideo !== 'function') return;

    isApplyingRemote.current = true;

    try {
      // Calculate position with elapsed offset if playing
      const elapsed = playbackState === 'playing'
        ? Math.max(0, (Date.now() - lastPlaybackCommandAt) / 1000)
        : 0;
      const targetPos = Math.max(0, playbackPositionSeconds + elapsed);

      // Cue or play the playlist at currentTrackIndex
      if (playbackState === 'playing') {
        const pIndex = player.getPlaylistIndex?.();
        if (pIndex !== currentTrackIndex && typeof player.playVideoAt === 'function') {
          player.playVideoAt(currentTrackIndex);
        } else {
          player.playVideo();
        }

        if (targetPos > 2 && typeof player.seekTo === 'function') {
          player.seekTo(targetPos, true);
        }

        // Check if autoplay was blocked
        setTimeout(() => {
          const state = player.getPlayerState?.();
          if (state !== window.YT.PlayerState.PLAYING && state !== window.YT.PlayerState.BUFFERING) {
            setAutoplayBlocked(true);
          } else {
            setAutoplayBlocked(false);
          }
        }, 800);
      } else {
        if (isInitial && typeof player.cuePlaylist === 'function') {
          player.cuePlaylist({
            listType: 'playlist',
            list: playlistId,
            index: currentTrackIndex,
            startSeconds: playbackPositionSeconds,
          });
        } else if (typeof player.pauseVideo === 'function') {
          player.pauseVideo();
          if (playbackPositionSeconds > 0 && typeof player.seekTo === 'function') {
            player.seekTo(playbackPositionSeconds, true);
          }
        }
      }

      // Update track index state
      setTrackIndex(currentTrackIndex);
      updateTrackInfo();
    } catch (e) {
      console.warn('[YouTube] Alignment warning:', e);
    } finally {
      setTimeout(() => {
        isApplyingRemote.current = false;
      }, 600);
    }
  }, [playbackState, currentTrackIndex, playbackPositionSeconds, lastPlaybackCommandAt, playlistId]);

  // ── 4. React to Incoming Remote Commands ─────────────────────────────────
  useEffect(() => {
    if (!playerReady || !latestMusicCommand || isHost) return;

    const player = playerRef.current;
    if (!player) return;

    isApplyingRemote.current = true;

    try {
      if (latestMusicCommand.type === 'play') {
        const cmdTrack = latestMusicCommand.trackIndex ?? currentTrackIndex;
        const curIndex = player.getPlaylistIndex?.();

        if (curIndex !== cmdTrack && typeof player.playVideoAt === 'function') {
          player.playVideoAt(cmdTrack);
        } else {
          player.playVideo();
        }

        const pos = latestMusicCommand.positionSeconds ?? 0;
        const curTime = player.getCurrentTime?.() || 0;
        if (Math.abs(curTime - pos) > 3.5 && typeof player.seekTo === 'function') {
          player.seekTo(pos, true);
        }

        // Test for autoplay restriction
        setTimeout(() => {
          const st = player.getPlayerState?.();
          if (st !== window.YT.PlayerState.PLAYING && st !== window.YT.PlayerState.BUFFERING) {
            setAutoplayBlocked(true);
          } else {
            setAutoplayBlocked(false);
          }
        }, 600);
      } else if (latestMusicCommand.type === 'pause') {
        player.pauseVideo();
        if (latestMusicCommand.positionSeconds !== undefined && typeof player.seekTo === 'function') {
          player.seekTo(latestMusicCommand.positionSeconds, true);
        }
      } else if (latestMusicCommand.type === 'next') {
        if (typeof latestMusicCommand.trackIndex === 'number' && typeof player.playVideoAt === 'function') {
          player.playVideoAt(latestMusicCommand.trackIndex);
        } else if (typeof player.nextVideo === 'function') {
          player.nextVideo();
        }
      } else if (latestMusicCommand.type === 'init') {
        alignToRoomState(true);
      }

      updateTrackInfo();
    } catch (e) {
      console.warn('[YouTube] Command apply error:', e);
    } finally {
      setTimeout(() => {
        isApplyingRemote.current = false;
      }, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestMusicCommand, playerReady, isHost]);

  // ── 5. Host Periodic Sync Heartbeat ──────────────────────────────────────
  useEffect(() => {
    if (!isHost || !playerReady) {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      return;
    }

    syncIntervalRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player || typeof player.getPlayerState !== 'function') return;

      const st = player.getPlayerState();
      if (st === window.YT.PlayerState.PLAYING) {
        const pos = player.getCurrentTime?.() || 0;
        const idx = player.getPlaylistIndex?.() ?? currentTrackIndex;
        onMusicSync(idx, pos, 'playing');
      }
    }, 4500);

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [isHost, playerReady, currentTrackIndex, onMusicSync]);

  // ── 6. Player Event Handlers ─────────────────────────────────────────────
  const updateTrackInfo = () => {
    const player = playerRef.current;
    if (!player) return;
    try {
      const data = player.getVideoData?.();
      if (data && data.title) {
        setTrackTitle(data.title);
      }
      const idx = player.getPlaylistIndex?.();
      if (typeof idx === 'number' && idx >= 0) {
        setTrackIndex(idx);
      }
    } catch {}
  };

  const handlePlayerStateChange = (state: number) => {
    updateTrackInfo();

    if (state === window.YT.PlayerState.PLAYING) {
      setAutoplayBlocked(false);
      setErrorMessage('');
    }

    // Only host drives room-wide state from player interactions
    if (!isHost || isApplyingRemote.current) return;

    const player = playerRef.current;
    if (!player) return;

    if (state === window.YT.PlayerState.PLAYING) {
      const pos = player.getCurrentTime?.() || 0;
      const idx = player.getPlaylistIndex?.() ?? currentTrackIndex;
      onMusicPlay(idx, pos);
    } else if (state === window.YT.PlayerState.PAUSED) {
      const pos = player.getCurrentTime?.() || 0;
      onMusicPause(pos);
    } else if (state === window.YT.PlayerState.ENDED) {
      // Advance to next song automatically
      onMusicNext();
    }
  };

  const handlePlayerError = (code: number) => {
    console.warn('[YouTube] Player error code:', code);
    const player = playerRef.current;

    if (code === 150 || code === 101) {
      setErrorMessage('Video embedding restricted by owner. Advancing to next track…');
      if (isHost && player && typeof player.nextVideo === 'function') {
        setTimeout(() => onMusicNext(), 1500);
      }
    } else if (code === 100 || code === 2) {
      setErrorMessage('Video unavailable or invalid link. Advancing…');
      if (isHost && player && typeof player.nextVideo === 'function') {
        setTimeout(() => onMusicNext(), 1500);
      }
    } else {
      setErrorMessage(`YouTube player notice (code ${code}).`);
    }
  };

  // ── 7. Host Action Handlers ──────────────────────────────────────────────
  const handleHostPlay = () => {
    const player = playerRef.current;
    const pos = player?.getCurrentTime?.() || playbackPositionSeconds;
    const idx = player?.getPlaylistIndex?.() ?? currentTrackIndex;
    player?.playVideo?.();
    onMusicPlay(idx, pos);
    setAutoplayBlocked(false);
  };

  const handleHostPause = () => {
    const player = playerRef.current;
    const pos = player?.getCurrentTime?.() || playbackPositionSeconds;
    player?.pauseVideo?.();
    onMusicPause(pos);
  };

  const handleHostNext = () => {
    const player = playerRef.current;
    player?.nextVideo?.();
    onMusicNext();
  };

  // ── 8. Local Audio Controls (Mute / Volume) ──────────────────────────────
  const toggleLocalMute = () => {
    const player = playerRef.current;
    if (!player) return;
    const next = !isMuted;
    setIsMuted(next);
    if (next) {
      player.mute?.();
    } else {
      player.unMute?.();
    }
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    const player = playerRef.current;
    if (player && typeof player.setVolume === 'function') {
      player.setVolume(v);
      if (isMuted && v > 0) {
        setIsMuted(false);
        player.unMute?.();
      }
    }
  };

  const handleManualSync = () => {
    alignToRoomState(false);
  };

  const handleAutoplayUnblock = () => {
    setAutoplayBlocked(false);
    const player = playerRef.current;
    if (player) {
      player.playVideo?.();
      player.unMute?.();
      setIsMuted(false);
      const elapsed = Math.max(0, (Date.now() - lastPlaybackCommandAt) / 1000);
      player.seekTo?.(playbackPositionSeconds + elapsed, true);
    }
  };

  // ── 9. Render ─────────────────────────────────────────────────────────────
  return (
    <div className={`yt-music-panel ${isMinimized ? 'yt-music-panel--minimized' : ''}`}>
      {/* Panel Header */}
      <div className="yt-music-panel__header">
        <div className="yt-music-panel__title-wrap">
          <span className="yt-music-panel__icon">🎵</span>
          <span className="yt-music-panel__title">
            {trackTitle || (playlistId ? `Track #${trackIndex + 1}` : 'Garba Playlist')}
          </span>
        </div>
        <div className="yt-music-panel__header-actions">
          <span className={`yt-status-badge yt-status-badge--${playbackState}`}>
            {playbackState === 'playing' ? '▶ Playing' : '⏸ Paused'}
          </span>
          <button
            type="button"
            className="yt-btn-icon"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Expand music panel' : 'Minimize music panel'}
          >
            {isMinimized ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Panel Body */}
      {!isMinimized && (
        <div className="yt-music-panel__body">
          {/* Embedded YouTube Player Container */}
          <div className="yt-music-panel__player-wrapper">
            <div ref={containerRef} id="youtube-player-embed" />

            {/* Autoplay blocked overlay */}
            {autoplayBlocked && (
              <div className="yt-autoplay-overlay">
                <button
                  type="button"
                  id="btn-unblock-audio"
                  className="btn btn-primary btn-sm"
                  onClick={handleAutoplayUnblock}
                >
                  🔊 Click to Listen
                </button>
              </div>
            )}
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="yt-music-panel__error" role="alert">
              <span>⚠️ {errorMessage}</span>
            </div>
          )}

          {/* Controls Bar */}
          <div className="yt-music-panel__controls">
            {/* Host Controls */}
            {isHost ? (
              <div className="yt-music-panel__host-btns">
                {playbackState === 'playing' ? (
                  <button
                    type="button"
                    id="btn-yt-pause"
                    className="btn btn-secondary btn-sm"
                    onClick={handleHostPause}
                    title="Pause for room"
                  >
                    ⏸ Pause
                  </button>
                ) : (
                  <button
                    type="button"
                    id="btn-yt-play"
                    className="btn btn-primary btn-sm"
                    onClick={handleHostPlay}
                    title="Play for room"
                  >
                    ▶ Play
                  </button>
                )}
                <button
                  type="button"
                  id="btn-yt-next"
                  className="btn btn-ghost btn-sm"
                  onClick={handleHostNext}
                  title="Next track"
                >
                  ⏭ Next
                </button>
              </div>
            ) : (
              <div className="yt-music-panel__guest-sync">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleManualSync}
                  title="Re-synchronize with host playback"
                >
                  🔄 Sync
                </button>
              </div>
            )}

            {/* Local Volume / Mute Controls */}
            <div className="yt-music-panel__volume-wrap">
              <button
                type="button"
                id="btn-yt-mute"
                className="yt-btn-icon"
                onClick={toggleLocalMute}
                title={isMuted ? 'Unmute locally' : 'Mute locally'}
                aria-label={isMuted ? 'Unmute locally' : 'Mute locally'}
              >
                {isMuted ? '🔇' : '🔊'}
              </button>
              <input
                id="slider-yt-volume"
                type="range"
                min="0"
                max="100"
                step="5"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="yt-volume-slider"
                aria-label="Local YouTube Volume"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
