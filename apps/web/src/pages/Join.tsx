import { useParams } from 'react-router-dom';

export default function Join() {
  const { code } = useParams<{ code?: string }>();

  return (
    <div>
      <h1>Beatroulette</h1>
      {code ? <p>Joining game <strong>{code}</strong></p> : <p>Enter a game code to join</p>}
      <button disabled>Conectar Spotify</button>
      <p style={{ color: '#888', fontSize: 12 }}>Phase 1: Spotify OAuth PKCE — not yet implemented</p>
    </div>
  );
}
