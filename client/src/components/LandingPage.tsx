import React, { useState, useEffect } from 'react';
import './LandingPage.css';

interface LandingPageProps {
  inviteToken?: string; // pre-filled from URL
  onCreateRoom: () => void;
  onJoinRoom: (token: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  inviteToken,
  onCreateRoom,
  onJoinRoom,
}) => {
  const [joinToken, setJoinToken] = useState(inviteToken || '');
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    if (inviteToken) setJoinToken(inviteToken);
  }, [inviteToken]);

  const handleJoin = () => {
    const t = joinToken.trim();
    if (!t) {
      setJoinError('Please enter an invite link or code.');
      return;
    }
    // Accept full URL or bare token
    let token = t;
    try {
      const url = new URL(t);
      token = url.searchParams.get('invite') || url.pathname.split('/').pop() || t;
    } catch {
      // it's a bare token
    }
    if (token.length < 4) {
      setJoinError('That doesn\'t look like a valid invite code.');
      return;
    }
    setJoinError('');
    onJoinRoom(token);
  };

  return (
    <div className="landing">
      {/* Floating decorations */}
      <div className="landing__deco" aria-hidden="true">
        {['🪔','✨','🌸','🎊','💛','🪔','✨','🌺','🎉','💜'].map((e, i) => (
          <span key={i} className="landing__deco-item" style={{ '--i': i } as React.CSSProperties}>{e}</span>
        ))}
      </div>

      <div className="landing__content scale-in">
        {/* Hero */}
        <header className="landing__hero">
          <div className="landing__logo">
            <span className="landing__logo-diya">🪔</span>
            <span className="landing__logo-text">
              <span className="landing__logo-gully">Garba</span>
              <span className="landing__logo-garba"> Gully</span>
            </span>
          </div>
          <p className="landing__tagline">
            Dance together in your own private virtual Garba room.<br/>
            <span>No sign-up. No download. Just dance.</span>
          </p>
        </header>

        {/* Cards */}
        <div className="landing__cards">
          {/* Create room */}
          <div className="landing__card landing__card--create">
            <div className="landing__card-icon">🎊</div>
            <h2>Create a Room</h2>
            <p>Start a private room and invite your friends with a link.</p>
            <button
              id="btn-create-room"
              className="btn btn-primary btn-lg"
              onClick={onCreateRoom}
            >
              <span>🪔</span> Create Room
            </button>
          </div>

          {/* Divider */}
          <div className="landing__divider">
            <span>or</span>
          </div>

          {/* Join room */}
          <div className="landing__card landing__card--join">
            <div className="landing__card-icon">💃</div>
            <h2>Join a Room</h2>
            <p>Got an invite link? Paste it below and join the dance!</p>
            <div className="landing__join-form">
              <input
                id="input-invite-code"
                className="input"
                type="text"
                placeholder="Paste invite link or code…"
                value={joinToken}
                onChange={(e) => { setJoinToken(e.target.value); setJoinError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              />
              {joinError && <p className="landing__error">{joinError}</p>}
              <button
                id="btn-join-room"
                className="btn btn-primary btn-lg"
                onClick={handleJoin}
                disabled={!joinToken.trim()}
              >
                <span>🕺</span> Join Room
              </button>
            </div>
          </div>
        </div>

        {/* Features strip */}
        <div className="landing__features">
          {[
            { icon: '🔒', label: 'Private rooms' },
            { icon: '👥', label: 'Up to 8 dancers' },
            { icon: '🎵', label: 'Shared music' },
            { icon: '⚡', label: 'Real-time sync' },
            { icon: '🎭', label: 'Festive avatars' },
          ].map(({ icon, label }) => (
            <div key={label} className="landing__feature">
              <span>{icon}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
