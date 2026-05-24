import { useEffect, useRef, useCallback, useState } from 'react';

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: {
      Player: new (opts: {
        name: string;
        getOAuthToken: (cb: (t: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayer;
    };
  }
}

interface SpotifyPlayer {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, cb: (s: unknown) => void) => boolean;
  play: (opts: { spotify_uri: string }) => Promise<void>;
  pause: () => Promise<void>;
}

export interface PlayerState {
  sdkReady: boolean;
  isPlaying: boolean;
  premiumError: boolean;
}

export function useSpotifyPlayer(getToken: () => Promise<string>) {
  const playerRef = useRef<SpotifyPlayer | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<PlayerState>({
    sdkReady: false, isPlaying: false, premiumError: false,
  });

  useEffect(() => {
    let player: SpotifyPlayer | null = null;

    function init() {
      player = new window.Spotify.Player({
        name: 'Spotbeat',
        getOAuthToken: cb => { getToken().then(cb).catch(() => cb('')); },
        volume: 0.6,
      });

      player.addListener('ready', (s) => {
        const { device_id } = s as { device_id: string };
        console.log('[spotify] player ready', device_id);
        setState(p => ({ ...p, sdkReady: true }));
      });
      player.addListener('not_ready', () => setState(p => ({ ...p, sdkReady: false })));
      player.addListener('account_error', () => {
        setState(p => ({ ...p, premiumError: true }));
        console.warn('[spotify] Premium required for full playback');
      });
      player.addListener('initialization_error', (s) => {
        console.error('[spotify] init error', (s as { message: string }).message);
      });
      player.addListener('authentication_error', (s) => {
        console.error('[spotify] auth error', (s as { message: string }).message);
      });

      player.connect();
      playerRef.current = player;
    }

    if (window.Spotify) {
      init();
    } else {
      window.onSpotifyWebPlaybackSDKReady = init;
    }

    return () => {
      player?.disconnect();
      playerRef.current = null;
      audioRef.current?.pause();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const play = useCallback(async (uri?: string, previewUrl?: string | null) => {
    // Try SDK first (Premium)
    if (state.sdkReady && !state.premiumError && playerRef.current && uri) {
      try {
        await playerRef.current.play({ spotify_uri: uri });
        setState(p => ({ ...p, isPlaying: true }));
        return;
      } catch {
        console.warn('[spotify] SDK play failed, falling back to preview');
      }
    }

    // Fallback: 30s preview audio
    if (previewUrl) {
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = previewUrl;
      audioRef.current.volume = 0.6;
      audioRef.current.play().catch(console.error);
      setState(p => ({ ...p, isPlaying: true }));
    }
  }, [state.sdkReady, state.premiumError]);

  const stop = useCallback(async () => {
    if (state.sdkReady && playerRef.current) {
      await playerRef.current.pause().catch(() => null);
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setState(p => ({ ...p, isPlaying: false }));
  }, [state.sdkReady]);

  return { ...state, play, stop };
}
