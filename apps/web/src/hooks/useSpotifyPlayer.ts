import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayer;
    };
  }
}

interface SpotifyPlayer {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, cb: (state: unknown) => void) => void;
  play: (options: { spotify_uri: string }) => Promise<void>;
  pause: () => Promise<void>;
}

export function useSpotifyPlayer(getToken: () => Promise<string>) {
  const playerRef = useRef<SpotifyPlayer | null>(null);

  useEffect(() => {
    // Phase 4: initialise Spotify Web Playback SDK
    return () => playerRef.current?.disconnect();
  }, [getToken]);

  return { player: playerRef.current };
}
