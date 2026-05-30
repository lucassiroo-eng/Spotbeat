interface ItunesResult {
  trackName: string;
  artistName: string;
  previewUrl?: string;
}

export async function getItunesPreview(trackName: string, artistName: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`${artistName} ${trackName}`);
    const res = await fetch(`https://itunes.apple.com/search?term=${q}&media=music&entity=song&limit=10`);
    const data = await res.json() as { results: ItunesResult[] };
    const trackLower = trackName.toLowerCase();
    const artistLower = artistName.toLowerCase();
    const match = data.results.find(r =>
      r.previewUrl &&
      r.trackName.toLowerCase().includes(trackLower.slice(0, 12)) &&
      r.artistName.toLowerCase().includes(artistLower.slice(0, 8))
    ) ?? data.results.find(r => r.previewUrl);
    return match?.previewUrl ?? null;
  } catch {
    return null;
  }
}
