import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { generateCodeVerifier, generateCodeChallenge } from '../utils/pkce';

const SCOPES = [
  'streaming',
  'user-read-private',
  'user-top-read',
  'user-read-playback-state',
  'user-modify-playback-state',
].join(' ');

export default function Join() {
  const { code } = useParams<{ code?: string }>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem('session_id')) {
      sessionStorage.setItem('session_id', crypto.randomUUID());
    }
    if (code) sessionStorage.setItem('game_code', code);
    else sessionStorage.removeItem('game_code');
  }, [code]);

  async function handleConnect() {
    setLoading(true);
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const state = crypto.randomUUID();

    sessionStorage.setItem('pkce_verifier', verifier);
    sessionStorage.setItem('pkce_state', state);

    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: `${window.location.origin}/callback`,
      scope: SCOPES,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      state,
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params}`;
  }

  return (
    <div style={{ padding: 32, fontFamily: 'sans-serif', maxWidth: 400 }}>
      <h1 style={{ marginBottom: 8 }}>Beatroulette</h1>
      {code
        ? <p>You were invited to game <strong>{code}</strong>.</p>
        : <p>Create a new game or enter a game code to join.</p>
      }
      <button onClick={handleConnect} disabled={loading} style={{ marginTop: 16, padding: '10px 24px', fontSize: 16, cursor: 'pointer' }}>
        {loading ? 'Redirecting...' : 'Connect Spotify'}
      </button>
    </div>
  );
}
