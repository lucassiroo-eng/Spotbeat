export default function Privacy() {
  return (
    <div className="min-h-screen px-6 py-12" style={{ background: 'var(--sp-black)', color: 'white' }}>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--sp-green)' }}>Privacy Policy</h1>
        <p className="text-sm mb-10" style={{ color: 'var(--sp-muted)' }}>Last updated: May 2026</p>

        <section className="mb-8">
          <h2 className="text-lg font-bold mb-3">What is Spotbeat?</h2>
          <p style={{ color: 'var(--sp-muted)' }} className="leading-relaxed">
            Spotbeat is a multiplayer music trivia game that uses your Spotify listening history
            to generate personalised quiz questions. Players compete to identify whose songs, artists,
            and listening habits match each clue.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold mb-3">Data we access</h2>
          <p style={{ color: 'var(--sp-muted)' }} className="mb-3 leading-relaxed">
            When you connect your Spotify account, we request the following scopes:
          </p>
          <ul className="space-y-2" style={{ color: 'var(--sp-muted)' }}>
            <li className="flex gap-2"><span style={{ color: 'var(--sp-green)' }}>•</span> <strong className="text-white">user-read-private / user-read-email</strong> — your Spotify user ID and display name, used to identify you in the game lobby.</li>
            <li className="flex gap-2"><span style={{ color: 'var(--sp-green)' }}>•</span> <strong className="text-white">user-top-read</strong> — your top artists and top tracks (medium term), used to generate quiz questions.</li>
            <li className="flex gap-2"><span style={{ color: 'var(--sp-green)' }}>•</span> <strong className="text-white">user-read-recently-played</strong> — your 50 most recently played tracks, used for "Recently Played" questions.</li>
            <li className="flex gap-2"><span style={{ color: 'var(--sp-green)' }}>•</span> <strong className="text-white">streaming / user-modify-playback-state</strong> — Spotify Connect playback, used only if you choose to play audio through the Spotify SDK (Premium accounts).</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold mb-3">How we use your data</h2>
          <ul className="space-y-2" style={{ color: 'var(--sp-muted)' }}>
            <li className="flex gap-2"><span style={{ color: 'var(--sp-green)' }}>•</span> Music data (artists, tracks) is used exclusively to generate in-game quiz questions.</li>
            <li className="flex gap-2"><span style={{ color: 'var(--sp-green)' }}>•</span> Other players in your game session can see your display name and answer correctly or incorrectly whether a track or artist belongs to you.</li>
            <li className="flex gap-2"><span style={{ color: 'var(--sp-green)' }}>•</span> We do not sell, share, or use your data for advertising.</li>
            <li className="flex gap-2"><span style={{ color: 'var(--sp-green)' }}>•</span> We do not build profiles or track your activity outside of active game sessions.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold mb-3">Data retention</h2>
          <p style={{ color: 'var(--sp-muted)' }} className="leading-relaxed">
            Your Spotify music data is cached in memory on our server for the duration of your game session
            (up to 1 hour). It is not written to permanent storage. When the server restarts, all session
            data is deleted. Game scores are stored in a local SQLite database solely for the purpose of
            showing the final leaderboard.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold mb-3">Third-party services</h2>
          <ul className="space-y-2" style={{ color: 'var(--sp-muted)' }}>
            <li className="flex gap-2"><span style={{ color: 'var(--sp-green)' }}>•</span> <strong className="text-white">Spotify</strong> — authentication and music data. Governed by <a href="https://www.spotify.com/legal/privacy-policy/" target="_blank" rel="noreferrer" style={{ color: 'var(--sp-green)' }}>Spotify's Privacy Policy</a>.</li>
            <li className="flex gap-2"><span style={{ color: 'var(--sp-green)' }}>•</span> <strong className="text-white">Apple iTunes Search API</strong> — used as a fallback to fetch 30-second song previews. No personal data is sent to Apple.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold mb-3">Your rights</h2>
          <p style={{ color: 'var(--sp-muted)' }} className="leading-relaxed">
            You can revoke Spotbeat's access to your Spotify account at any time by visiting{' '}
            <a href="https://www.spotify.com/account/apps/" target="_blank" rel="noreferrer" style={{ color: 'var(--sp-green)' }}>
              spotify.com/account/apps
            </a>{' '}
            and removing Spotbeat. Since we do not persist personal data beyond active sessions, there
            is nothing to delete on our end.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold mb-3">Contact</h2>
          <p style={{ color: 'var(--sp-muted)' }} className="leading-relaxed">
            Questions or concerns? Email us at{' '}
            <a href="mailto:lucassiroo@gmail.com" style={{ color: 'var(--sp-green)' }}>lucassiroo@gmail.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
