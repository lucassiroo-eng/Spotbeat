import { useParams } from 'react-router-dom';

export default function Game() {
  const { code } = useParams<{ code: string }>();

  return (
    <div>
      <h2>Game — {code}</h2>
      <p style={{ color: '#888', fontSize: 12 }}>Phase 4: Game loop + Spotify playback — not yet implemented</p>
    </div>
  );
}
