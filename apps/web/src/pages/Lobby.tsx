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

export default function Lobby() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const sessionId = sessionStorage.getItem('session_id') ?? '';

  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [error, setError] = useState('');

  const isHost = lobby ? lobby.hostUserId === sessionStorage.getItem('spotify_user_id') : false;

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
    type PlayerPayload = { userId: string; displayName: string };

    switch (msg.type) {
      case 'player:joined': {
        const p = msg.payload as PlayerPayload;
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

  function handleDeviceChange(deviceId: string) {
    setSelectedDevice(deviceId);
    send('device:select', { deviceId });
  }

  function handleStart() {
    send('game:start');
  }

  if (!lobby) return <div style={{ padding: 32 }}>Loading lobby...</div>;

  return (
    <div style={{ padding: 32, fontFamily: 'sans-serif', maxWidth: 600 }}>
      <h2>Lobby</h2>
      <p style={{ fontSize: 28, fontWeight: 700, letterSpacing: 4 }}>{code}</p>
      <p style={{ color: '#888', marginTop: -8 }}>Share this code with friends</p>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <h3>Players ({players.length})</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {players.map(p => (
          <li key={p.userId} style={{ padding: '8px 0', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
            <span>{p.displayName} {p.userId === lobby.hostUserId ? '👑' : ''}</span>
            <span style={{ color: p.ready ? 'green' : '#aaa', fontSize: 12 }}>
              {p.ready ? 'Ready' : 'Syncing...'}
            </span>
          </li>
        ))}
      </ul>

      {devices.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <label><strong>Playback device:</strong></label>
          <select value={selectedDevice} onChange={e => handleDeviceChange(e.target.value)} style={{ display: 'block', marginTop: 8, padding: '6px 12px', fontSize: 14 }}>
            <option value="">— select device —</option>
            {devices.map(d => (
              <option key={d.id} value={d.id}>{d.name} ({d.type})</option>
            ))}
          </select>
        </div>
      )}

      {isHost && (
        <div style={{ marginTop: 24 }}>
          <h3>Game config</h3>
          <label>Questions: <strong>{lobby.config.questionCount}</strong></label>
          <input type="range" min={5} max={20} step={5} value={lobby.config.questionCount}
            onChange={e => send('config:update', { questionCount: parseInt(e.target.value) })}
            style={{ display: 'block', marginTop: 4, width: 200 }}
          />
          <button onClick={handleStart} disabled={players.length < 2} style={{ marginTop: 24, padding: '12px 32px', fontSize: 16, cursor: 'pointer', background: '#1DB954', color: '#fff', border: 'none', borderRadius: 4 }}>
            Start Game
          </button>
          {players.length < 2 && <p style={{ color: '#aaa', fontSize: 12 }}>Need at least 2 players</p>}
        </div>
      )}

      {!isHost && (
        <p style={{ marginTop: 24, color: '#888' }}>Waiting for host to start the game...</p>
      )}
    </div>
  );
}
