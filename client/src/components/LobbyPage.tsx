import React, { useState } from 'react';
import { AVATARS, OUTFITS } from '../types';
import { extractPlaylistId } from '../utils/youtube';
import { DancePreviewModal } from './DancePreviewModal';
import { ServerSettingsModal } from './ServerSettingsModal';
import './LobbyPage.css';

interface LobbyPageProps {
  mode: 'create' | 'join';
  inviteToken?: string;
  isConnecting: boolean;
  errorMessage?: string;
  onBack: () => void;
  onEnter: (nickname: string, avatarId: number, outfitId: number, playlistId?: string) => void;
}

export const LobbyPage: React.FC<LobbyPageProps> = ({
  mode,
  inviteToken,
  isConnecting,
  errorMessage,
  onBack,
  onEnter,
}) => {
  const [nickname, setNickname] = useState('');
  const [avatarId, setAvatarId] = useState(0);
  const [outfitId, setOutfitId] = useState(0);
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [playlistError, setPlaylistError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);

  const selectedAvatar = AVATARS[avatarId] ?? AVATARS[0];
  const selectedOutfit = OUTFITS[outfitId] ?? OUTFITS[0];

  const handleEnter = () => {
    const name = nickname.trim();
    if (!name) {
      setNicknameError('Please enter a nickname.');
      return;
    }
    if (name.length > 24) {
      setNicknameError('Nickname must be 24 characters or fewer.');
      return;
    }

    let validPlaylistId: string | undefined = undefined;
    if (mode === 'create') {
      const extracted = extractPlaylistId(playlistUrl);
      if (!extracted) {
        setPlaylistError('Please enter a valid YouTube playlist URL containing a "list" parameter.');
        return;
      }
      validPlaylistId = extracted;
    }

    setNicknameError('');
    setPlaylistError('');
    onEnter(name, avatarId, outfitId, validPlaylistId);
  };

  return (
    <div className="lobby">
      <div className="lobby__bg" aria-hidden="true" />

      <div className="lobby__panel scale-in">
        {/* Header */}
        <div className="lobby__header">
          <button id="btn-lobby-back" className="btn btn-ghost btn-sm" onClick={onBack}>
            ← Back
          </button>
          <h1 className="lobby__title">
            {mode === 'create' ? '🎊 Create Your Room' : '💃 Join the Dance'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {inviteToken && (
              <span className="badge badge-gold">🔑 Room: {inviteToken}</span>
            )}
            <button
              type="button"
              id="btn-lobby-server-settings"
              className="btn btn-ghost btn-sm"
              style={{ color: '#f5c842', padding: '4px 8px' }}
              onClick={() => setShowServerSettings(true)}
              title="Configure Multiplayer Network Mode"
            >
              ⚙️ Network
            </button>
          </div>
        </div>

        <div className="lobby__body">
          {/* Preview pane */}
          <div className="lobby__preview">
            <h3>Your Avatar</h3>
            <div className="lobby__avatar-preview" style={{ '--outfit-color': selectedOutfit.colors[0], '--outfit-accent': selectedOutfit.colors[1] } as React.CSSProperties}>
              <AvatarPreview avatarId={avatarId} outfitId={outfitId} />
              <div className="lobby__preview-name">
                {nickname.trim() || 'Your Name'}
              </div>
              <div className="lobby__preview-badge">
                {selectedAvatar.name} · {selectedOutfit.name}
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="lobby__form">
            {/* Nickname */}
            <div className="lobby__field">
              <label htmlFor="input-nickname" className="lobby__label">Nickname</label>
              <input
                id="input-nickname"
                className="input"
                type="text"
                maxLength={24}
                placeholder="Enter your name…"
                value={nickname}
                onChange={(e) => { setNickname(e.target.value); setNicknameError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleEnter()}
                autoFocus
              />
              {nicknameError && <p className="lobby__field-error">{nicknameError}</p>}
            </div>

            {/* YouTube Playlist URL (Required for room creation) */}
            {mode === 'create' && (
              <div className="lobby__field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="input-playlist-url" className="lobby__label">
                    YouTube playlist URL
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, padding: '2px 8px', height: 'auto', color: '#f5c842' }}
                    onClick={() => {
                      setPlaylistUrl('https://www.youtube.com/playlist?list=PL4fGSIvJcnXUXN7q0o6r473X-5_Vz42h4');
                      setPlaylistError('');
                    }}
                  >
                    Use Sample Garba Playlist ✨
                  </button>
                </div>
                <input
                  id="input-playlist-url"
                  className="input"
                  type="text"
                  placeholder="Paste your Garba playlist link"
                  value={playlistUrl}
                  onChange={(e) => {
                    setPlaylistUrl(e.target.value);
                    setPlaylistError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleEnter()}
                />
                {playlistError && (
                  <p className="lobby__field-error" id="playlist-error">
                    {playlistError}
                  </p>
                )}
              </div>
            )}

            {/* Avatar selection */}
            <div className="lobby__field">
              <label className="lobby__label">Choose Avatar</label>
              <div className="lobby__grid" role="radiogroup" aria-label="Avatar selection">
                {AVATARS.map((a) => (
                  <button
                    key={a.id}
                    id={`btn-avatar-${a.id}`}
                    role="radio"
                    aria-checked={avatarId === a.id}
                    className={`lobby__grid-item ${avatarId === a.id ? 'lobby__grid-item--selected' : ''}`}
                    onClick={() => setAvatarId(a.id)}
                  >
                    <span className="lobby__grid-emoji">{a.emoji}</span>
                    <span className="lobby__grid-label">{a.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Outfit selection */}
            <div className="lobby__field">
              <label className="lobby__label">Choose Outfit</label>
              <div className="lobby__grid" role="radiogroup" aria-label="Outfit selection">
                {OUTFITS.map((o) => (
                  <button
                    key={o.id}
                    id={`btn-outfit-${o.id}`}
                    role="radio"
                    aria-checked={outfitId === o.id}
                    className={`lobby__grid-item ${outfitId === o.id ? 'lobby__grid-item--selected' : ''}`}
                    onClick={() => setOutfitId(o.id)}
                  >
                    <span
                      className="lobby__outfit-swatch"
                      style={{ background: `linear-gradient(135deg, ${o.colors[0]}, ${o.colors[1]})` }}
                    />
                    <span className="lobby__grid-label">{o.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dance Preview Trigger */}
            <div style={{ marginTop: '0.25rem', marginBottom: '0.5rem' }}>
              <button
                type="button"
                id="btn-lobby-preview-dance"
                className="btn btn-ghost btn-sm"
                style={{ width: '100%', color: '#f5c842', border: '1px solid rgba(245,200,66,0.3)', padding: '8px' }}
                onClick={() => setShowPreview(true)}
              >
                ✨ Preview Garba &amp; Dandiya Dance Steps
              </button>
            </div>

            {/* Error */}
            {errorMessage && (
              <div className="lobby__error-banner" role="alert" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div>⚠️ {errorMessage}</div>
                {(errorMessage.toLowerCase().includes('server') || errorMessage.toLowerCase().includes('connect') || errorMessage.toLowerCase().includes('unreachable') || errorMessage.toLowerCase().includes('load failed')) && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ alignSelf: 'flex-start', fontSize: '11px', padding: '3px 8px' }}
                    onClick={() => setShowServerSettings(true)}
                  >
                    ⚙️ Configure Multiplayer Server URL
                  </button>
                )}
              </div>
            )}

            {/* CTA */}
            <button
              id="btn-enter-room"
              className="btn btn-primary btn-lg lobby__cta"
              onClick={handleEnter}
              disabled={isConnecting || !nickname.trim()}
            >
              {isConnecting ? (
                <><span className="lobby__spinner" />Connecting…</>
              ) : (
                <>{mode === 'create' ? 'Create Room' : '💃 Enter Room'}</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Dance Preview Modal */}
      {showPreview && (
        <DancePreviewModal
          initialStyle="garba"
          currentAvatarId={avatarId}
          currentOutfitId={outfitId}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Server Settings Modal */}
      {showServerSettings && (
        <ServerSettingsModal
          onClose={() => setShowServerSettings(false)}
        />
      )}
    </div>
  );
};

// Detailed SVG fitting preview, matched to the in-room character silhouettes.
const AvatarPreview: React.FC<{ avatarId: number; outfitId: number }> = ({ avatarId, outfitId }) => {
  const outfit = OUTFITS[outfitId] ?? OUTFITS[0];
  const avatar = AVATARS[avatarId] ?? AVATARS[0];
  const skinTones = ['#b87854', '#9b6048', '#c58d68', '#81513f', '#ae7354', '#704634'];
  const skin = skinTones[avatar.id % skinTones.length];
  const primary = outfit.colors[0];
  const accent  = outfit.colors[1];
  const isMale = avatar.id === 1 || avatar.id === 3 || avatar.id === 5;

  return (
    <svg width="120" height="160" viewBox="-60 -90 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="preview-fabric" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={accent} />
          <stop offset="1" stopColor={primary} />
        </linearGradient>
        <linearGradient id="preview-skin" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#e0a17a" />
          <stop offset="1" stopColor={skin} />
        </linearGradient>
      </defs>
      <ellipse cx="0" cy="35" rx="27" ry="8" fill="rgba(0,0,0,0.38)" />
      {isMale ? <>
        <path d="M-12 3h10l-2 30h-12zM2 3h10l4 30H2z" fill="#e8dfd0" />
        <path d="M-13 -14 Q0 -21 13 -14 L16 9 Q12 15 10 21 L-10 21 Q-12 13 -16 9z" fill="url(#preview-fabric)" stroke="#d6b56c" strokeWidth="1.2" />
        <path d="M-8 -11Q-2 -7-4 18M8 -11Q2 -7 4 18" fill="none" stroke="#f3d899" strokeWidth="1" opacity=".75" />
        <path d="M-10 -16Q-7 -6-9 27l-5 0Q-15-5-15-13zM3-15Q8-9 10 28h-5Q1 1-3-10z" fill="#e8decb" stroke={accent} strokeWidth="1" />
      </> : <>
        <path d="M-9 3h18Q16 17 26 32Q0 41-26 32Q-16 14-9 3z" fill="url(#preview-fabric)" stroke="#e8c66e" strokeWidth="1.5" />
        {[-16,-9,-3,4,11,18].map((x) => <path key={x} d={`M0 3Q${x} 15 ${x * 1.4} 32`} fill="none" stroke="#f1d58e" strokeWidth=".8" opacity=".62" />)}
        <path d="M-12 -15Q0-20 12-15L15 2H-15z" fill={accent} stroke="#e8c66e" strokeWidth="1" />
        <path d="M-12 -14Q-2 -6 11 -10L14 3" fill="none" stroke="#f0c66e" strokeWidth="2" />
        <path d="M-2 4h4" stroke="#e8c66e" strokeWidth="2" />
      </>}
      <path d="M-7-20v8h14v-8" fill="url(#preview-skin)" />
      <ellipse cx="0" cy="-27" rx="14" ry="17" fill="url(#preview-skin)" />
      {isMale ? <path d="M-14-29Q-15-47 0-45Q15-45 14-29L10-32 8-39Q0-34-9-37L-12-31z" fill="#211813" /> : <>
        <path d="M-14-29Q-16-45 0-46Q16-45 14-29L12-20Q19-15 14-5L9-12 8-35Q0-31-8-35L-10-12-15-7Q-20-19-12-22z" fill="#211813" />
        <circle cx="0" cy="-31" r="1.7" fill="#edc76b" />
        <circle cx="0" cy="-24" r="1.5" fill="#8e2334" />
      </>}
      <path d="M-7-28l4-1M3-29l4 1" stroke="#39241d" strokeWidth="1.2" strokeLinecap="round" />
      <ellipse cx="-4" cy="-25" rx="1.4" ry="2" fill="#261812" />
      <ellipse cx="4" cy="-25" rx="1.4" ry="2" fill="#261812" />
      <path d="M0-23v3M-4-17Q0-14 4-17" fill="none" stroke="#704634" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M-8 1Q0 5 8 1" fill="none" stroke="#e9ca78" strokeWidth="1.2" />
      <circle cx="-13" cy="-22" r="1.5" fill="#e9ca78" />
      <circle cx="13" cy="-22" r="1.5" fill="#e9ca78" />
    </svg>
  );
};
