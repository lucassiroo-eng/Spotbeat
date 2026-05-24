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

    async function createGameWithRetry(sid: string, retries = 5): Promise<{ code: string }> {
      for (let i = 0; i < retries; i++) {
        try {
          return await apiPost<{ code: string }>('/api/games', {}, sid);
        } catch (err) {
          if (i < retries - 1 && (err as Error).message.includes('sync_pending')) {
            await new Promise(r => setTimeout(r, 1200));
          } else {
            throw err;
          }
        }
      }
      throw new Error('sync_pending: timed out');
    }

    apiPost<{ ok: boolean; userId: string; displayName: string }>(
      '/api/auth/spotify/callback',
      { code, code_verifier: verifier, session_id: sessionId, redirect_uri: `${window.location.origin}/callback` },
    )
      .then(async ({ userId, displayName }) => {
        sessionStorage.setItem('spotify_user_id', userId);
        sessionStorage.setItem('spotify_display_name', displayName);

        if (gameCode) {
          navigate(`/lobby/${gameCode}`);
        } else {
          const { code: newCode } = await createGameWithRetry(sessionId);
          navigate(`/lobby/${newCode}`);
        }
      })
      .catch(err => setError((err as Error).message));
  }, [navigate]);

  if (error) {
    return (
      <div className="page-center">
        <div className="card w-full max-w-sm text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="font-semibold mb-1">Something went wrong</p>
          <p style={{ color: 'var(--sp-error)' }} className="text-sm mb-6">{error}</p>
          <a href="/" className="btn-outline text-sm">Try again</a>
        </div>
      </div>
    );
  }

  return (
    <div className="page-center">
      <div className="text-center">
        <div className="spinner mx-auto mb-5" />
        <p className="font-medium">Connecting to Spotify...</p>
        <p style={{ color: 'var(--sp-muted)' }} className="text-sm mt-1">Fetching your music taste</p>
      </div>
    </div>
  );
}
