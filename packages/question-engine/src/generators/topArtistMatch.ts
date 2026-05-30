import { randomUUID } from 'crypto';
import { QuestionGenerator, QuestionGenInput, GeneratedQuestion } from '../types';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const topArtistMatchGenerator: QuestionGenerator = {
  type: 'TOP_ARTIST_MATCH',

  canGenerate(input: QuestionGenInput): boolean {
    return input.players.length >= 2 && input.players.some(p => p.topArtists.length > 0);
  },

  generate(input: QuestionGenInput): GeneratedQuestion | null {
    const eligible = input.players.filter(p => p.topArtists.length > 0);
    if (eligible.length === 0) return null;

    const owner = eligible[Math.floor(Math.random() * eligible.length)];
    const artistIndex = Math.floor(Math.random() * Math.min(owner.topArtists.length, 10));
    const artist = owner.topArtists[artistIndex];
    const rank = artistIndex + 1;

    // Find a top track from the owner featuring this artist to enable playback
    const matchingTrack = owner.topTracks.find(t =>
      t.artists.some(a => a.id === artist.id || a.name === artist.name)
    );

    const options = shuffle(input.players.map(p => ({ id: p.userId, label: p.displayName })));

    return {
      id: randomUUID(),
      type: 'TOP_ARTIST_MATCH',
      prompt: `Who has "${artist.name}" as one of their top ${rank <= 3 ? `#${rank}` : 'most listened'} artists?`,
      options,
      correctAnswerId: owner.userId,
      spotifyUri: matchingTrack?.uri,
      previewUrl: matchingTrack?.preview_url ?? undefined,
      albumArt: matchingTrack?.albumArt,
    };
  },
};
