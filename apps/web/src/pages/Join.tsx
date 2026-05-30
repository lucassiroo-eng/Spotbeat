import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { generateCodeVerifier, generateCodeChallenge } from '../utils/pkce';

const SCOPES = [
  'streaming',
  'user-read-private',
  'user-top-read',
  'user-read-recently-played',
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
      redirect_uri: `${window.location.origin}${import.meta.env.BASE_URL}callback`,
      scope: SCOPES,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      state,
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params}`;
  }

  return (
    <div className="page-center" style={{ background: 'var(--sp-black)' }}>
      <div className="w-full max-w-sm text-center">
        {/* Logo */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="20" fill="#1DB954" />
              <path d="M12 20c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M14 23.5c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="20" cy="27" r="2" fill="white" />
            </svg>
            <span className="text-3xl font-bold tracking-tight">Spotbeat</span>
          </div>
          <p style={{ color: 'var(--sp-muted)' }} className="text-sm">Music quiz with friends</p>
        </div>

        {/* Invitation card */}
        {code && (
          <div className="card mb-6 text-left">
            <p style={{ color: 'var(--sp-muted)' }} className="text-xs uppercase tracking-wider mb-1">You were invited to</p>
            <p className="text-2xl font-bold tracking-widest" style={{ color: 'var(--sp-green)' }}>{code}</p>
          </div>
        )}

        {/* CTA */}
        <button onClick={handleConnect} disabled={loading} className="btn-green w-full text-base py-4">
          {loading
            ? <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Redirecting...</>
            : <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                Connect with Spotify
              </>
          }
        </button>

        {!code && (
          <p style={{ color: 'var(--sp-muted)' }} className="text-xs mt-4">
            Connect to create or join a game
          </p>
        )}
      </div>
    </div>
  );
}
