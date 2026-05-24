import { getSession } from './sessions';
import { spotifyClient, SpotifyArtist, SpotifyTrack } from './spotify-client';
import { refreshTokenIfNeeded } from './spotify-refresh';
import { broadcast, sessionToGame } from './game-state';

interface CachedMusicData {
  topArtists: SpotifyArtist[];
  topTracks: SpotifyTrack[];
  cachedAt: number;
}

const userDataCache = new Map<string, CachedMusicData>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function syncUserData(sessionId: string): Promise<void> {
  const session = getSession(sessionId);
  if (!session?.userId) {
    console.error(`[sync] session ${sessionId} has no userId`);
    return;
  }

  const token = await refreshTokenIfNeeded(sessionId);

  const [artists, tracks] = await Promise.all([
    spotifyClient.getTopArtists(token),
    spotifyClient.getTopTracks(token),
  ]);

  userDataCache.set(session.userId, {
    topArtists: artists.items,
    topTracks: tracks.items,
    cachedAt: Date.now(),
  });

  console.log(`[sync] ${session.displayName} ready (${artists.items.length} artists, ${tracks.items.length} tracks)`);

  const gameCode = sessionToGame.get(sessionId);
  if (gameCode) {
    broadcast(gameCode, { type: 'player:ready', payload: { userId: session.userId } });
  }
}

export function getUserData(userId: string): CachedMusicData | null {
  const cached = userDataCache.get(userId);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > CACHE_TTL) {
    userDataCache.delete(userId);
    return null;
  }
  return cached;
}
