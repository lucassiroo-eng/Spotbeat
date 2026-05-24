import { useParams } from 'react-router-dom';

export default function Lobby() {
  const { code } = useParams<{ code: string }>();

  return (
    <div>
      <h2>Lobby — {code}</h2>
      <p>Waiting for players...</p>
      <p style={{ color: '#888', fontSize: 12 }}>Phase 2: WebSocket lobby — not yet implemented</p>
    </div>
  );
}
