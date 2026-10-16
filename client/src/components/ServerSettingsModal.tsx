import React, { useState } from 'react';
import { getServerUrl, setServerUrl, isP2PMode, setNetworkMode } from '../colyseus';
import './ServerSettingsModal.css';

interface ServerSettingsModalProps {
  onClose: () => void;
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({ onClose }) => {
  const currentUrl = getServerUrl();
  const [selectedMode, setSelectedMode] = useState<'p2p' | 'colyseus'>(() => isP2PMode() ? 'p2p' : 'colyseus');
  const [urlInput, setUrlInput] = useState(currentUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleSave = () => {
    setNetworkMode(selectedMode);
    if (selectedMode === 'colyseus') {
      setServerUrl(urlInput.trim());
    }
    onClose();
    window.location.reload();
  };

  const handleReset = () => {
    setNetworkMode('p2p');
    setSelectedMode('p2p');
    setServerUrl('');
    setUrlInput('ws://localhost:2567');
    setTestResult(null);
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);

    const targetUrl = urlInput.trim();
    let httpBase = targetUrl.replace(/^ws(s?):/, (_m, s) => s ? 'https:' : 'http:');
    if (!httpBase.startsWith('http')) {
      httpBase = (window.location.protocol === 'https:' ? 'https://' : 'http://') + httpBase;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${httpBase}/api/rooms/resolve?token=ping_test`, {
        signal: controller.signal,
      }).catch((e) => {
        clearTimeout(timeoutId);
        throw e;
      });
      clearTimeout(timeoutId);

      if (res.status === 404 || res.status === 200) {
        setTestResult({ ok: true, msg: '✓ Connected successfully! Colyseus server is online and responsive.' });
      } else {
        setTestResult({ ok: false, msg: `⚠️ Server returned HTTP ${res.status}.` });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setTestResult({ ok: false, msg: '⏱ Connection timed out after 6 seconds.' });
      } else {
        const msg = err.message === 'Load failed'
          ? 'Load failed (Network Error / Mixed Content). Ensure the server URL uses https:// or wss:// on HTTPS sites.'
          : err.message || 'Failed to connect to server.';
        setTestResult({ ok: false, msg: `❌ ${msg}` });
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="server-modal-overlay fade-in" role="dialog" aria-label="Multiplayer Network Settings">
      <div className="server-modal scale-in">
        <div className="server-modal__header">
          <div className="server-modal__title">
            <span>⚙️</span>
            <h4>Multiplayer Network Mode</h4>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="server-modal__body">
          {/* Mode selector cards */}
          <div className="server-mode-cards">
            {/* P2P Mode */}
            <div
              className={`server-mode-card ${selectedMode === 'p2p' ? 'server-mode-card--active' : ''}`}
              onClick={() => setSelectedMode('p2p')}
            >
              <div className="server-mode-card__top">
                <span className="server-mode-radio">{selectedMode === 'p2p' ? '◉' : '○'}</span>
                <strong>⚡ Serverless WebRTC (Netlify-Native)</strong>
                <span className="badge badge-gold" style={{ fontSize: '0.65rem', marginLeft: 'auto' }}>Recommended</span>
              </div>
              <p>
                Runs <strong>100% on Netlify</strong> with zero external servers! Dancers connect directly peer-to-peer with ultra-low latency. No Render or Railway accounts needed.
              </p>
            </div>

            {/* Dedicated Colyseus Mode */}
            <div
              className={`server-mode-card ${selectedMode === 'colyseus' ? 'server-mode-card--active' : ''}`}
              onClick={() => setSelectedMode('colyseus')}
            >
              <div className="server-mode-card__top">
                <span className="server-mode-radio">{selectedMode === 'colyseus' ? '◉' : '○'}</span>
                <strong>🖥️ Dedicated WebSocket Server (Optional)</strong>
              </div>
              <p>
                Connect to a custom Colyseus server (e.g. <code>ws://localhost:2567</code> for local testing or custom VPS).
              </p>
            </div>
          </div>

          {/* Colyseus specific inputs */}
          {selectedMode === 'colyseus' && (
            <div className="server-field fade-in">
              <label htmlFor="input-server-url" className="server-label">
                Colyseus Server URL:
              </label>
              <div className="server-input-row">
                <input
                  id="input-server-url"
                  type="text"
                  className="input server-input"
                  placeholder="ws://localhost:2567 or wss://custom-server.com"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    setTestResult(null);
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={testConnection}
                  disabled={testing || !urlInput.trim()}
                >
                  {testing ? 'Testing…' : '🔌 Test'}
                </button>
              </div>
              {testResult && (
                <div className={`server-test-result ${testResult.ok ? 'server-test-result--success' : 'server-test-result--error'}`}>
                  {testResult.msg}
                </div>
              )}
            </div>
          )}

          {selectedMode === 'p2p' && (
            <div className="server-status-box fade-in">
              <span style={{ fontSize: '1.2rem' }}>🎉</span>
              <div>
                <strong>Zero Backend Required!</strong>
                <p>
                  Invite links look like <code>{window.location.origin}?room=garba-XXXX</code>. Anyone with the link connects straight into the room via WebRTC.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="server-modal__footer">
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleReset}>
            Reset to Netlify P2P
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              id="btn-save-server-config"
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
            >
              Save &amp; Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
