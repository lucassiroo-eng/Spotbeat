const API_BASE = 'https://api.spotify.com/v1';

export class SpotifyApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'SpotifyApiError';
  }
}

async function spotifyFetch<T>(accessToken: string, path: string, retries = 3): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '1', 10);
    if (retries > 0) {
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      return spotifyFetch(accessToken, path, retries - 1);
    }
    throw new SpotifyApiError(429, 'Rate limit exceeded');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new SpotifyApiError(res.status, body.error?.message ?? res.statusText);
  }

  return res.json() as Promise<T>;
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  country: string;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  preview_url: string | null;
  artists: SpotifyArtist[];
}

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent: number;
}

export const spotifyClient = {
  getMe: (token: string) =>
    spotifyFetch<SpotifyUser>(token, '/me'),

  getTopArtists: (token: string, limit = 50, timeRange = 'medium_term') =>
    spotifyFetch<{ items: SpotifyArtist[] }>(token, `/me/top/artists?limit=${limit}&time_range=${timeRange}`),

  getTopTracks: (token: string, limit = 50, timeRange = 'medium_term') =>
    spotifyFetch<{ items: SpotifyTrack[] }>(token, `/me/top/tracks?limit=${limit}&time_range=${timeRange}`),

  getRecentlyPlayed: (token: string, limit = 50) =>
    spotifyFetch<{ items: { track: SpotifyTrack }[] }>(token, `/me/player/recently-played?limit=${limit}`),

  getDevices: (token: string) =>
    spotifyFetch<{ devices: SpotifyDevice[] }>(token, '/me/player/devices'),
};
