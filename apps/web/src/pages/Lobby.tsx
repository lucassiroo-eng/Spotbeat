import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import { apiGet } from '../utils/api';

interface Player {
  userId: string;
  displayName: string;
  score: number;
  ready: boolean;
}

interface Device {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
}

interface LobbyState {
  id: string;
  code: string;
  hostUserId: string;
  config: { questionCount: number; genres: string | string[]; enabledTypes: string[] };
  players: Array<{ userId: string; displayName: string; score: number }>;
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const hue = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
      style={{ background: `hsl(${hue},50%,35%)`, color: `hsl(${hue},70%,85%)` }}>
      {initials}
    </div>
  );
}

export default function Lobby() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const sessionId = sessionStorage.getItem('session_id') ?? '';
  const myUserId = sessionStorage.getItem('spotify_user_id') ?? '';

  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const isHost = lobby?.hostUserId === myUserId;

  useEffect(() => {
    if (!sessionId) { navigate(`/join/${code}`); return; }

    apiGet<LobbyState>(`/api/games/${code}`, sessionId)
      .then(data => {
        setLobby(data);
        setPlayers(data.players.map(p => ({ ...p, ready: false })));
      })
      .catch(() => navigate(`/join/${code}`));

    apiGet<{ devices: Device[] }>('/api/spotify/devices', sessionId)
      .then(({ devices: d }) => {
        setDevices(d);
        const active = d.find(x => x.is_active);
        if (active) setSelectedDevice(active.id);
      })
      .catch(() => {/* devices optional */});
  }, [code, sessionId, navigate]);

  const handleMessage = useCallback((msg: { type: string; payload?: unknown }) => {
    switch (msg.type) {
      case 'player:joined': {
        const p = msg.payload as { userId: string; displayName: string };
        setPlayers(prev =>
          prev.some(x => x.userId === p.userId)
            ? prev
            : [...prev, { userId: p.userId, displayName: p.displayName, score: 0, ready: false }]
        );
        break;
      }
      case 'player:ready': {
        const { userId } = msg.payload as { userId: string };
        setPlayers(prev => prev.map(p => p.userId === userId ? { ...p, ready: true } : p));
        break;
      }
      case 'player:left': {
        const { userId } = msg.payload as { userId: string };
        setPlayers(prev => prev.filter(p => p.userId !== userId));
        break;
      }
      case 'config:updated': {
        setLobby(prev => prev ? { ...prev, config: msg.payload as LobbyState['config'] } : prev);
        break;
      }
      case 'game:started': {
        navigate(`/game/${code}`);
        break;
      }
      case 'error': {
        setError((msg.payload as { message: string }).message);
        break;
      }
    }
  }, [code, navigate]);

  const { send } = useWebSocket(code, handleMessage);

  function copyCode() {
    navigator.clipboard.writeText(code ?? '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDeviceChange(deviceId: string) {
    setSelectedDevice(deviceId);
    send('device:select', { deviceId });
  }

  if (!lobby) {
    return (
      <div className="page-center">
        <div className="spinner mx-auto mb-4" />
        <p style={{ color: 'var(--sp-muted)' }}>Loading lobby...</p>
      </div>
    );
  }

  const readyCount = players.filter(p => p.ready).length;
  const allReady = readyCount === players.length && players.length > 0;

  return (
    <div className="min-h-screen px-4 py-8" style={{ background: 'var(--sp-black)' }}>
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <p style={{ color: 'var(--sp-muted)' }} className="text-xs uppercase tracking-widest mb-2">Game Code</p>
          <button onClick={copyCode} className="group flex items-center gap-3 mx-auto">
            <span className="text-5xl font-bold tracking-widest" style={{ color: 'var(--sp-green)', fontVariantNumeric: 'tabular-nums' }}>
              {code}
            </span>
            <span style={{ color: 'var(--sp-muted)' }} className="text-xs group-hover:text-white transition-colors">
              {copied ? '✓' : '⎘'}
            </span>
          </button>
          <p style={{ color: 'var(--sp-muted)' }} className="text-sm mt-2">
            {copied ? 'Copied!' : 'Tap to copy · Share with friends'}
          </p>
        </div>

        {error && (
          <div className="rounded-lg px-4 py-3 mb-4 text-sm" style={{ background: 'rgba(241,94,108,0.15)', color: 'var(--sp-error)' }}>
            {error}
          </div>
        )}

        {/* Players */}
        <div className="card mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">Players</h2>
            <span className="text-sm" style={{ color: 'var(--sp-muted)' }}>{readyCount}/{players.length} ready</span>
          </div>
          <ul className="space-y-3">
            {players.map(p => (
              <li key={p.userId} className="flex items-center gap-3">
                <Avatar name={p.displayName} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {p.displayName}
                    {p.userId === lobby.hostUserId && <span className="ml-1.5 text-xs" style={{ color: 'var(--sp-green)' }}>host</span>}
                    {p.userId === myUserId && <span className="ml-1.5 text-xs" style={{ color: 'var(--sp-muted)' }}>you</span>}
                  </p>
                </div>
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${p.ready ? 'pulse-ready' : ''}`}
                  style={{ background: p.ready ? 'var(--sp-green)' : 'var(--sp-border)' }} />
              </li>
            ))}
          </ul>
          {!allReady && (
            <p style={{ color: 'var(--sp-muted)' }} className="text-xs mt-4">
              Waiting for everyone's Spotify data to sync...
            </p>
          )}
        </div>

        {/* Device selector */}
        {devices.length > 0 && (
          <div className="card mb-4">
            <label className="text-sm font-semibold block mb-3">Playback Device</label>
            <select
              value={selectedDevice}
              onChange={e => handleDeviceChange(e.target.value)}
              className="input text-sm"
              style={{ cursor: 'pointer' }}
            >
              <option value="">— select device —</option>
              {devices.map(d => (
                <option key={d.id} value={d.id}>{d.name} · {d.type}</option>
              ))}
            </select>
            <p style={{ color: 'var(--sp-muted)' }} className="text-xs mt-2">Premium only — used for full-track playback</p>
          </div>
        )}

        {/* Invite link */}
        <div className="card mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Invite friends</p>
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--sp-muted)' }}>
                {typeof window !== 'undefined' ? `${window.location.origin}${import.meta.env.BASE_URL}join/${code}` : ''}
              </p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}${import.meta.env.BASE_URL}join/${code}`).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
              className="btn-outline text-xs py-1.5 px-4 flex-shrink-0 ml-3"
            >
              {copied ? '✓ Copied' : 'Copy link'}
            </button>
          </div>
        </div>

        {/* Config + Start (host only) */}
        {isHost && (
          <div className="card mb-4">
            <h2 className="font-bold mb-4">Game Settings</h2>

            {/* Question count */}
            <div className="mb-5">
              <div className="flex justify-between text-sm mb-2">
                <span style={{ color: 'var(--sp-muted)' }}>Questions</span>
                <span className="font-bold" style={{ color: 'var(--sp-green)' }}>{lobby.config.questionCount}</span>
              </div>
              <input
                type="range" min={5} max={20} step={5}
                value={lobby.config.questionCount}
                onChange={e => send('config:update', { questionCount: parseInt(e.target.value) })}
                className="w-full accent-[#1DB954]"
              />
              <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--sp-muted)' }}>
                <span>5</span><span>20</span>
              </div>
            </div>

            {/* Question type toggles */}
            <div className="mb-5">
              <p className="text-sm font-semibold mb-3" style={{ color: 'var(--sp-muted)' }}>Question Types</p>
              <div className="space-y-2">
                {[
                  { id: 'GUESS_THE_OWNER', label: '🎵 Guess the Owner', desc: 'Whose top track is this?' },
                  { id: 'TOP_ARTIST_MATCH', label: '🎤 Artist Match', desc: "Who's top artist is this?" },
                  { id: 'MOST_LIKELY_TO', label: '🏆 Most Likely To', desc: 'Who listens to this genre most?' },
                  { id: 'RECENT_TRACK', label: '🕐 Recent Track', desc: 'Who recently listened to this song?' },
                ].map(qt => {
                  const enabled = lobby.config.enabledTypes.includes(qt.id);
                  return (
                    <label key={qt.id} className="flex items-center gap-3 cursor-pointer group">
                      <button
                        role="checkbox"
                        aria-checked={enabled}
                        onClick={() => {
                          const current = lobby.config.enabledTypes;
                          const updated = enabled
                            ? current.filter(t => t !== qt.id)
                            : [...current, qt.id];
                          if (updated.length > 0) send('config:update', { enabledTypes: updated });
                        }}
                        className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-all"
                        style={{
                          background: enabled ? 'var(--sp-green)' : 'transparent',
                          borderColor: enabled ? 'var(--sp-green)' : 'var(--sp-border)',
                        }}
                      >
                        {enabled && <span className="text-black text-xs font-bold">✓</span>}
                      </button>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{qt.label}</p>
                        <p className="text-xs" style={{ color: 'var(--sp-muted)' }}>{qt.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => send('game:start')}
              disabled={players.length < 2}
              className="btn-green w-full py-4 text-base"
            >
              Start Game
            </button>
            {players.length < 2 && (
              <p style={{ color: 'var(--sp-muted)' }} className="text-xs text-center mt-2">
                Need at least 2 players
              </p>
            )}
          </div>
        )}

        {!isHost && (
          <div className="text-center py-6">
            <div className="spinner mx-auto mb-3" />
            <p style={{ color: 'var(--sp-muted)' }} className="text-sm">Waiting for host to start...</p>
          </div>
        )}
      </div>
    </div>
  );
}
