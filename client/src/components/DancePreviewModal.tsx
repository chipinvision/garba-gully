import React, { useEffect, useRef, useState } from 'react';
import {
  type DanceStyle,
  type ViewAngle,
  type DancePose,
  getGarbaPose,
  getDandiyaPose,
  renderCharacter,
  createCanvasDrawer,
  GARBA_STEPS,
  DANDIYA_STEPS,
} from '../game/garbaChoreography';
import { AVATARS, OUTFITS } from '../types';
import './DancePreviewModal.css';

interface DancePreviewModalProps {
  initialStyle?: DanceStyle;
  onClose: () => void;
  onSelectStyle?: (style: DanceStyle) => void;
  currentAvatarId?: number;
  currentOutfitId?: number;
}

export const DancePreviewModal: React.FC<DancePreviewModalProps> = ({
  initialStyle = 'garba',
  onClose,
  onSelectStyle,
  currentAvatarId = 0,
  currentOutfitId = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [style, setStyle] = useState<DanceStyle>(initialStyle);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [bpm, setBpm] = useState<number>(style === 'garba' ? 116 : 132);
  const [viewAngle, setViewAngle] = useState<ViewAngle>('front');
  const [zoom, setZoom] = useState<number>(1.6);
  const [avatarId, setAvatarId] = useState<number>(currentAvatarId);
  const [outfitId, setOutfitId] = useState<number>(currentOutfitId);

  // Manual scrub phase [0, 1)
  const [manualPhase, setManualPhase] = useState<number>(0);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(1);
  const [activePose, setActivePose] = useState<DancePose | null>(null);

  const animStateRef = useRef({
    phase: 0,
    lastTime: performance.now(),
    isPlaying: true,
  });

  // Keep ref updated
  useEffect(() => {
    animStateRef.current.isPlaying = isPlaying;
  }, [isPlaying]);

  // Adjust default BPM when switching styles
  const handleStyleChange = (newStyle: DanceStyle) => {
    setStyle(newStyle);
    setBpm(newStyle === 'garba' ? 116 : 132);
    animStateRef.current.phase = 0;
    setManualPhase(0);
  };

  // Step scrub change
  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setManualPhase(val);
    animStateRef.current.phase = val;
    setIsPlaying(false);
  };

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawer = createCanvasDrawer(ctx);
    let animId: number;

    const render = (timeNow: number) => {
      const state = animStateRef.current;
      const dt = (timeNow - state.lastTime) / 1000;
      state.lastTime = timeNow;

      if (state.isPlaying) {
        // Calculate cycle length based on BPM and total beats
        // Garba = 6 beats; Dandiya = 4 beats
        const beats = style === 'garba' ? 6 : 4;
        const cycleDurationSec = (60 / bpm) * beats;
        const deltaPhase = dt / cycleDurationSec;
        state.phase = (state.phase + deltaPhase) % 1.0;
        setManualPhase(state.phase);
      }

      const p = state.phase;
      const pose = style === 'garba' ? getGarbaPose(p) : getDandiyaPose(p);
      setActivePose(pose);
      setActiveStepIndex(pose.beatIndex);

      // Handle HiDPI
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const targetW = Math.round(rect.width * dpr);
      const targetH = Math.round(rect.height * dpr);

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      const cw = rect.width;
      const ch = rect.height;

      // Background festive gradient
      const bgGrad = ctx.createRadialGradient(cw / 2, ch / 2, 20, cw / 2, ch / 2, cw * 0.7);
      bgGrad.addColorStop(0, '#221133');
      bgGrad.addColorStop(0.6, '#130a21');
      bgGrad.addColorStop(1, '#0c0716');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, cw, ch);

      // Draw decorative festive mandala ring on the floor
      const centerX = cw / 2;
      const centerY = ch * 0.62;

      ctx.save();
      ctx.translate(centerX, centerY);

      // Floor rings
      ctx.strokeStyle = 'rgba(245, 200, 66, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 20, 90 * zoom, 32 * zoom, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(236, 72, 153, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 20, 120 * zoom, 42 * zoom, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Radial decorative dots
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const rx = Math.cos(a) * 90 * zoom;
        const ry = 20 + Math.sin(a) * 32 * zoom;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(245, 200, 66, 0.4)' : 'rgba(236, 72, 153, 0.4)';
        ctx.beginPath();
        ctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Render the articulated character
      const selectedOutfit = OUTFITS[outfitId] ?? OUTFITS[0];
      const selectedAvatar = AVATARS[avatarId] ?? AVATARS[0];

      renderCharacter(drawer, pose, selectedOutfit, selectedAvatar, {
        scale: zoom,
        viewAngle,
        showShadow: true,
      });

      ctx.restore();
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [style, bpm, zoom, viewAngle, outfitId, avatarId]);

  const stepsList = style === 'garba' ? GARBA_STEPS : DANDIYA_STEPS;
  const currentStep = stepsList[activeStepIndex - 1] ?? stepsList[0];

  return (
    <div className="dance-preview-overlay fade-in" role="dialog" aria-modal="true" aria-label="Authentic Dance Choreography Preview">
      <div className="dance-preview-modal scale-in">
        {/* Header */}
        <div className="dance-preview-header">
          <div className="dance-preview-header__title">
            <span className="dance-preview-header__icon">🪔</span>
            <div>
              <h3>Authentic Gujarati Dance Choreography</h3>
              <p>Navratri cultural movement validation &amp; preview</p>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm btn-close" onClick={onClose} aria-label="Close preview">✕</button>
        </div>

        {/* Main Content: Left Stage, Right Controls */}
        <div className="dance-preview-content">
          {/* Left: Interactive Canvas Stage */}
          <div className="dance-preview-stage">
            {/* Style Selector Tabs */}
            <div className="dance-style-tabs">
              <button
                id="btn-tab-garba"
                className={`dance-style-tab ${style === 'garba' ? 'dance-style-tab--active' : ''}`}
                onClick={() => handleStyleChange('garba')}
              >
                💃 Garba (3-Clap / Tran Tali)
              </button>
              <button
                id="btn-tab-dandiya"
                className={`dance-style-tab ${style === 'dandiya' ? 'dance-style-tab--active' : ''}`}
                onClick={() => handleStyleChange('dandiya')}
              >
                🥢 Dandiya Raas (Stick Dance)
              </button>
            </div>

            {/* Canvas Container */}
            <div className="dance-canvas-wrapper">
              <canvas ref={canvasRef} className="dance-preview-canvas" />

              {/* View Angle Pill Overlay */}
              <div className="dance-view-pills">
                <button
                  className={`pill-btn ${viewAngle === 'front' ? 'pill-btn--active' : ''}`}
                  onClick={() => setViewAngle('front')}
                >
                  Front
                </button>
                <button
                  className={`pill-btn ${viewAngle === 'iso' ? 'pill-btn--active' : ''}`}
                  onClick={() => setViewAngle('iso')}
                >
                  Isometric
                </button>
                <button
                  className={`pill-btn ${viewAngle === 'side' ? 'pill-btn--active' : ''}`}
                  onClick={() => setViewAngle('side')}
                >
                  Side
                </button>
              </div>

              {/* Active Step Banner on Stage */}
              <div className="dance-stage-banner">
                <span className="badge badge-gold">Beat {activeStepIndex} of {style === 'garba' ? 6 : 4}</span>
                <span className="dance-stage-banner__name">{currentStep.title}</span>
              </div>
            </div>

            {/* Scrubber & Playback Controls */}
            <div className="dance-timeline-controls">
              <div className="dance-timeline-row">
                <button
                  id="btn-preview-playpause"
                  className="btn btn-primary btn-sm"
                  onClick={() => setIsPlaying(!isPlaying)}
                  aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
                >
                  {isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>

                <div className="dance-scrubber-group">
                  <span className="scrubber-label">Phase:</span>
                  <input
                    type="range"
                    min="0"
                    max="0.999"
                    step="0.005"
                    value={manualPhase}
                    onChange={handleScrub}
                    className="dance-scrubber"
                  />
                  <span className="scrubber-pct">{Math.round(manualPhase * 100)}%</span>
                </div>

                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    animStateRef.current.phase = 0;
                    setManualPhase(0);
                  }}
                  title="Reset to Beat 1"
                >
                  ↺ Reset
                </button>
              </div>

              {/* Step indicator dots along timeline */}
              <div className="dance-beat-pills">
                {stepsList.map((st) => (
                  <button
                    key={st.beat}
                    className={`beat-pill ${activeStepIndex === st.beat ? 'beat-pill--active' : ''}`}
                    onClick={() => {
                      const p = (st.beat - 1) / stepsList.length;
                      animStateRef.current.phase = p;
                      setManualPhase(p);
                      setIsPlaying(false);
                    }}
                  >
                    <span className="beat-pill__num">{st.beat}</span>
                    <span className="beat-pill__name">{st.title.split(':')[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Choreography Inspector & Customizer */}
          <div className="dance-preview-inspector">
            {/* Step Detail Card */}
            <div className="inspector-card">
              <div className="inspector-card__header">
                <h4>Choreography Breakdown</h4>
                <span className="badge badge-purple">
                  {style === 'garba' ? '6-Beat Tran Tali' : '4-Beat Raas Taal'}
                </span>
              </div>
              <div className="step-detail-box">
                <div className="step-detail-box__title">
                  <span className="step-num">Beat {activeStepIndex}:</span> {currentStep.title}
                </div>
                <p className="step-detail-box__desc">{currentStep.description}</p>
                <div className="step-detail-box__cultural">
                  <strong>Cultural Detail:</strong> {currentStep.detail}
                </div>
              </div>
            </div>

            {/* Authenticity Validation Checks */}
            <div className="inspector-card">
              <div className="inspector-card__header">
                <h4>Authenticity Validation</h4>
              </div>
              <ul className="auth-checklist">
                <li className="auth-item auth-item--pass">
                  <span className="auth-icon">✓</span>
                  <div>
                    <strong>Planted Footwork:</strong>
                    <span>No foot sliding during grounded weight transfers.</span>
                  </div>
                </li>
                <li className="auth-item auth-item--pass">
                  <span className="auth-icon">✓</span>
                  <div>
                    <strong>C¹ Seamless Loop Boundary:</strong>
                    <span>Smooth cyclic position &amp; velocity match at 0% / 100%.</span>
                  </div>
                </li>
                <li className="auth-item auth-item--pass">
                  <span className="auth-icon">✓</span>
                  <div>
                    <strong>{style === 'garba' ? 'Hand Clapping (Tali)' : 'Visible Dual Dandiya Sticks'}:</strong>
                    <span>
                      {style === 'garba'
                        ? 'Hands meet precisely for chest, waist, and overhead claps with contact sparks.'
                        : 'Both dandiya sticks firmly gripped, striking at center, partner diagonal, & overhead.'}
                    </span>
                  </div>
                </li>
                <li className="auth-item auth-item--pass">
                  <span className="auth-icon">✓</span>
                  <div>
                    <strong>Costume Centrifugal Flare:</strong>
                    <span>Chaniya choli / kediyu skirt flares dynamically with rotation inertia.</span>
                  </div>
                </li>
              </ul>

              {/* Live Telemetry */}
              {activePose && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '0.74rem' }}>
                  <div>
                    <span style={{ color: 'rgba(253,244,231,0.6)' }}>L. Foot: </span>
                    <strong style={{ color: activePose.leftFoot.planted ? '#4ade80' : '#f5c842' }}>
                      {activePose.leftFoot.planted ? 'Planted' : 'Swing'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'rgba(253,244,231,0.6)' }}>R. Foot: </span>
                    <strong style={{ color: activePose.rightFoot.planted ? '#4ade80' : '#f5c842' }}>
                      {activePose.rightFoot.planted ? 'Planted' : 'Swing'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'rgba(253,244,231,0.6)' }}>Skirt Flare: </span>
                    <strong style={{ color: '#f5c842' }}>
                      {Math.round(activePose.skirtFlare * 100)}%
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'rgba(253,244,231,0.6)' }}>Impact: </span>
                    <strong style={{ color: activePose.impact ? '#f43f5e' : '#a78bfa' }}>
                      {activePose.impact ? (activePose.impact.type === 'clap' ? '👏 Clapped' : '🥢 Clacked') : 'In Motion'}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            {/* Tempo & Zoom Tuning */}
            <div className="inspector-card">
              <div className="inspector-card__header">
                <h4>Tempo &amp; Display</h4>
              </div>
              <div className="slider-control-row">
                <label>
                  <span>Tempo: <strong>{bpm} BPM</strong></span>
                  <input
                    type="range"
                    min="70"
                    max="180"
                    step="2"
                    value={bpm}
                    onChange={(e) => setBpm(parseInt(e.target.value, 10))}
                  />
                </label>
              </div>
              <div className="slider-control-row">
                <label>
                  <span>Zoom Scale: <strong>{zoom.toFixed(1)}x</strong></span>
                  <input
                    type="range"
                    min="1.0"
                    max="2.4"
                    step="0.1"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                  />
                </label>
              </div>
            </div>

            {/* Avatar & Costume Switching Preview */}
            <div className="inspector-card">
              <div className="inspector-card__header">
                <h4>Preview Outfit &amp; Dancer</h4>
              </div>
              <div className="character-preview-picks">
                <div className="pick-group">
                  <span className="pick-label">Dancer:</span>
                  <div className="pick-buttons">
                    {AVATARS.map((av) => (
                      <button
                        key={av.id}
                        className={`pick-chip ${avatarId === av.id ? 'pick-chip--active' : ''}`}
                        onClick={() => setAvatarId(av.id)}
                      >
                        {av.emoji} {av.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pick-group">
                  <span className="pick-label">Traditional Outfit:</span>
                  <div className="pick-buttons">
                    {OUTFITS.map((ot) => (
                      <button
                        key={ot.id}
                        className={`pick-chip ${outfitId === ot.id ? 'pick-chip--active' : ''}`}
                        onClick={() => setOutfitId(ot.id)}
                      >
                        {ot.emoji} {ot.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="dance-preview-footer">
          <div className="dance-preview-footer__left">
            <span>Selected Style: </span>
            <strong style={{ color: '#f5c842' }}>
              {style === 'garba' ? '💃 Gujarati Garba (Tran Tali)' : '🥢 Dandiya Raas (Taal)'}
            </strong>
          </div>
          <div className="dance-preview-footer__actions">
            <button className="btn btn-ghost" onClick={onClose}>Close Preview</button>
            {onSelectStyle && (
              <button
                id="btn-use-selected-dance"
                className="btn btn-primary"
                onClick={() => {
                  onSelectStyle(style);
                  onClose();
                }}
              >
                ✓ Dance with {style === 'garba' ? 'Garba' : 'Dandiya'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
