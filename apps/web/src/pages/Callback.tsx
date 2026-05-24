import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../utils/api';

export default function Callback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const errorParam = params.get('error');

    if (errorParam) {
      setError(`Spotify denied access: ${errorParam}`);
      return;
    }

    const storedState = sessionStorage.getItem('pkce_state');
    const verifier = sessionStorage.getItem('pkce_verifier');
    const sessionId = sessionStorage.getItem('session_id');

    if (!code || !verifier || !sessionId || state !== storedState) {
      setError('Invalid OAuth state. Please try again.');
      return;
    }

    sessionStorage.removeItem('pkce_state');
    sessionStorage.removeItem('pkce_verifier');

    const gameCode = sessionStorage.getItem('game_code');

    apiPost('/api/auth/spotify/callback', {
      code,
      code_verifier: verifier,
      session_id: sessionId,
      redirect_uri: `${window.location.origin}/callback`,
    })
      .then(async () => {
        if (gameCode) {
          navigate(`/lobby/${gameCode}`);
        } else {
          // Host flow: create a game
          const { code: newCode } = await apiPost<{ code: string }>('/api/games', {}, sessionId);
          navigate(`/lobby/${newCode}`);
        }
      })
      .catch(err => setError((err as Error).message));
  }, [navigate]);

  if (error) {
    return (
      <div style={{ padding: 32, fontFamily: 'sans-serif' }}>
        <p style={{ color: 'red' }}>Error: {error}</p>
        <a href="/">Try again</a>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <p>Connecting to Spotify...</p>
    </div>
  );
}
