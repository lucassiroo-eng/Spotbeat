import { randomUUID } from 'crypto';
import { db } from './db';
import { broadcast } from './game-state';
import { injectUserData } from './spotify-sync';
import { SpotifyArtist, SpotifyTrack } from './spotify-client';

export const BOT_USER_ID = 'bot-spotbeat-1';
export const BOT_DISPLAY_NAME = 'Spotbot 🤖';

// gameCode → set of bot userIds active in that game
export const botGames = new Map<string, Set<string>>();

function artist(id: string, name: string, genres: string[]): SpotifyArtist {
  return { id, name, genres };
}

function track(id: string, name: string, ar: SpotifyArtist): SpotifyTrack {
  return {
    id, name,
    uri: `spotify:track:${id}`,
    duration_ms: 210_000,
    preview_url: null,
    artists: [ar],
    album: { name: `${ar.name} – Album`, images: [] },
  };
}

const BOT_ARTISTS: SpotifyArtist[] = [
  artist('ar-weeknd',   'The Weeknd',      ['pop', 'r&b', 'canadian pop']),
  artist('ar-drake',    'Drake',           ['hip hop', 'rap', 'canadian hip hop']),
  artist('ar-taylor',   'Taylor Swift',    ['pop', 'country pop']),
  artist('ar-badbunny', 'Bad Bunny',       ['reggaeton', 'latin trap', 'urbano latino']),
  artist('ar-dua',      'Dua Lipa',        ['pop', 'dance pop', 'uk pop']),
  artist('ar-post',     'Post Malone',     ['pop', 'hip hop', 'trap']),
  artist('ar-billie',   'Billie Eilish',   ['pop', 'electropop', 'indie pop']),
  artist('ar-kendrick', 'Kendrick Lamar',  ['hip hop', 'rap', 'west coast hip hop']),
  artist('ar-ariana',   'Ariana Grande',   ['pop', 'r&b', 'dance pop']),
  artist('ar-sza',      'SZA',             ['r&b', 'soul', 'pop']),
];

const BOT_TRACKS: SpotifyTrack[] = [
  track('tr-blinding',  'Blinding Lights',     BOT_ARTISTS[0]),
  track('tr-godsplan',  "God's Plan",          BOT_ARTISTS[1]),
  track('tr-antihero',  'Anti-Hero',           BOT_ARTISTS[2]),
  track('tr-moscou',    'Moscow Mule',         BOT_ARTISTS[3]),
  track('tr-levitate',  'Levitating',          BOT_ARTISTS[4]),
  track('tr-circles',   'Circles',             BOT_ARTISTS[5]),
  track('tr-badguy',    'bad guy',             BOT_ARTISTS[6]),
  track('tr-humble',    'HUMBLE.',             BOT_ARTISTS[7]),
  track('tr-positions', 'Positions',           BOT_ARTISTS[8]),
  track('tr-killbill',  'Kill Bill',           BOT_ARTISTS[9]),
];

export function ensureBotUser(): void {
  const exists = db.prepare('SELECT 1 FROM users WHERE id = ?').get(BOT_USER_ID);
  if (!exists) {
    db.prepare('INSERT INTO users (id, display_name, country) VALUES (?, ?, ?)').run(BOT_USER_ID, BOT_DISPLAY_NAME, 'US');
  }
  injectUserData(BOT_USER_ID, {
    topArtists: BOT_ARTISTS,
    topTracks: BOT_TRACKS,
    recentlyPlayed: BOT_TRACKS.slice(0, 6),
    cachedAt: Date.now(),
  });
}

export function addBotToGame(gameId: string, gameCode: string): boolean {
  ensureBotUser();
  const inserted = db.prepare(
    'INSERT OR IGNORE INTO game_players (id, game_id, user_id, joined_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
  ).run(randomUUID(), gameId, BOT_USER_ID);

  if (!botGames.has(gameCode)) botGames.set(gameCode, new Set());
  botGames.get(gameCode)!.add(BOT_USER_ID);

  if (inserted.changes > 0) {
    broadcast(gameCode, { type: 'player:joined', payload: { userId: BOT_USER_ID, displayName: BOT_DISPLAY_NAME } });
  }
  broadcast(gameCode, { type: 'player:ready', payload: { userId: BOT_USER_ID } });
  return inserted.changes > 0;
}
