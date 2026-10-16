import React, { useState } from 'react';
import { getServerUrl, setServerUrl } from '../colyseus';
import './ServerSettingsModal.css';

interface ServerSettingsModalProps {
  onClose: () => void;
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({ onClose }) => {
  const currentUrl = getServerUrl();
  const [urlInput, setUrlInput] = useState(currentUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const isRemoteSite = typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname);
  const isPointingToLocalhost = currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1');

  const handleSave = () => {
    setServerUrl(urlInput.trim());
    onClose();
    // Reload to apply new server across all modules
    window.location.reload();
  };

  const handleReset = () => {
    setServerUrl('');
    setUrlInput(getServerUrl());
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
      // Test resolve API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${httpBase}/api/rooms/resolve?token=ping_test`, {
        signal: controller.signal,
      }).catch((e) => {
        clearTimeout(timeoutId);
        throw e;
      });
      clearTimeout(timeoutId);

      // 404 with JSON { error: "Room not found or has ended" } means server is ONLINE!
      if (res.status === 404 || res.status === 200) {
        setTestResult({ ok: true, msg: '✓ Connected successfully! Server is online and responsive.' });
      } else {
        setTestResult({ ok: false, msg: `⚠️ Server returned HTTP ${res.status}.` });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setTestResult({ ok: false, msg: '⏱ Connection timed out after 6 seconds.' });
      } else {
        const msg = err.message === 'Load failed'
          ? 'Load failed (Network Error / Mixed Content). Make sure the server URL uses https:// or wss:// on deployed HTTPS sites.'
          : err.message || 'Failed to connect to server.';
        setTestResult({ ok: false, msg: `❌ ${msg}` });
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="server-modal-overlay fade-in" role="dialog" aria-label="Multiplayer Server Settings">
      <div className="server-modal scale-in">
        <div className="server-modal__header">
          <div className="server-modal__title">
            <span>⚙️</span>
            <h4>Multiplayer Server Configuration</h4>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="server-modal__body">
          {/* Warning if on Netlify with localhost backend */}
          {isRemoteSite && isPointingToLocalhost && (
            <div className="server-warning-box">
              <span className="server-warning-icon">⚠️</span>
              <div>
                <strong>Localhost Server Detected on Deployed Site</strong>
                <p>
                  Your site is running on <code>{window.location.hostname}</code>, but the multiplayer server is set to <code>{currentUrl}</code>.
                  Friends on other devices cannot reach your laptop's localhost. Enter a public backend URL below so other dancers can join.
                </p>
              </div>
            </div>
          )}

          <div className="server-field">
            <label htmlFor="input-server-url" className="server-label">
              Colyseus Server WebSocket / HTTP URL:
            </label>
            <div className="server-input-row">
              <input
                id="input-server-url"
                type="text"
                className="input server-input"
                placeholder="wss://your-garba-server.onrender.com"
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
          </div>

          {/* Test connection output */}
          {testResult && (
            <div className={`server-test-result ${testResult.ok ? 'server-test-result--success' : 'server-test-result--error'}`}>
              {testResult.msg}
            </div>
          )}

          {/* Quick guide */}
          <div className="server-tips-box">
            <h6>💡 How to Host the Multiplayer Server:</h6>
            <ul>
              <li>
                <strong>Option 1: Deploy on Render.com (Permanent &amp; Free)</strong>
                <br />
                Deploy the <code>server/</code> folder as a Render Web Service (Node.js). Once live, paste your <code>wss://your-app.onrender.com</code> URL above or set <code>VITE_SERVER_URL</code> in your Netlify site settings.
              </li>
              <li>
                <strong>Option 2: Instant Public Tunnel for Testing</strong>
                <br />
                Run <code>npx localtunnel --port 2567</code> or Cloudflare Tunnel on your laptop while the server is running. Paste the generated public HTTPS URL above.
              </li>
            </ul>
          </div>
        </div>

        <div className="server-modal__footer">
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleReset}>
            Reset to Default
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
