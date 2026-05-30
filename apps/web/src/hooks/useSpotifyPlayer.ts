import { useEffect, useRef, useCallback, useState } from 'react';
import { getItunesPreview } from '../utils/itunesPreview';

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
  setVolume: (v: number) => Promise<void>;
}

export interface PlayerState {
  sdkReady: boolean;
  isPlaying: boolean;
  premiumError: boolean;
  volume: number;
  playBlocked: boolean;
}

export function useSpotifyPlayer(getToken: () => Promise<string>) {
  const playerRef = useRef<SpotifyPlayer | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingUrlRef = useRef<string | null>(null);
  const [state, setState] = useState<PlayerState>({
    sdkReady: false, isPlaying: false, premiumError: false, volume: 0.7, playBlocked: false,
  });

  useEffect(() => {
    let player: SpotifyPlayer | null = null;

    function init() {
      player = new window.Spotify.Player({
        name: 'Spotbeat',
        getOAuthToken: cb => { getToken().then(cb).catch(() => cb('')); },
        volume: 0.7,
      });

      player.addListener('ready', (s) => {
        const { device_id } = s as { device_id: string };
        console.log('[spotify] player ready', device_id);
        setState(p => ({ ...p, sdkReady: true }));
      });
      player.addListener('not_ready', () => setState(p => ({ ...p, sdkReady: false })));
      player.addListener('account_error', () => {
        setState(p => ({ ...p, premiumError: true }));
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

  const setVolume = useCallback((v: number) => {
    setState(p => ({ ...p, volume: v }));
    if (audioRef.current) audioRef.current.volume = v;
    playerRef.current?.setVolume(v).catch(() => null);
  }, []);

  const play = useCallback(async (
    uri?: string,
    previewUrl?: string | null,
    trackName?: string,
    artistName?: string,
  ) => {
    pendingUrlRef.current = null;
    setState(p => ({ ...p, playBlocked: false }));

    // Try Spotify SDK (Premium)
    if (state.sdkReady && !state.premiumError && playerRef.current && uri) {
      try {
        await playerRef.current.play({ spotify_uri: uri });
        setState(p => ({ ...p, isPlaying: true }));
        return;
      } catch {
        console.warn('[spotify] SDK play failed, trying preview');
      }
    }

    // Resolve URL: previewUrl → iTunes
    let url: string | null = previewUrl ?? null;
    if (!url && trackName && artistName) {
      url = await getItunesPreview(trackName, artistName);
    }

    if (!url) return;

    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = url;
    audioRef.current.volume = state.volume;

    try {
      await audioRef.current.play();
      setState(p => ({ ...p, isPlaying: true, playBlocked: false }));
    } catch {
      // Autoplay blocked — store URL so user gesture can resume
      pendingUrlRef.current = url;
      setState(p => ({ ...p, isPlaying: false, playBlocked: true }));
    }
  }, [state.sdkReady, state.premiumError, state.volume]);

  // Called directly from a user-gesture handler to unlock autoplay
  const resumeAudio = useCallback(() => {
    const url = pendingUrlRef.current;
    if (!url) return;
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = url;
    audioRef.current.volume = state.volume;
    audioRef.current.play()
      .then(() => {
        pendingUrlRef.current = null;
        setState(p => ({ ...p, isPlaying: true, playBlocked: false }));
      })
      .catch(console.error);
  }, [state.volume]);

  const stop = useCallback(async () => {
    pendingUrlRef.current = null;
    if (state.sdkReady && playerRef.current) {
      await playerRef.current.pause().catch(() => null);
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setState(p => ({ ...p, isPlaying: false, playBlocked: false }));
  }, [state.sdkReady]);

  return { ...state, play, stop, setVolume, resumeAudio };
}
