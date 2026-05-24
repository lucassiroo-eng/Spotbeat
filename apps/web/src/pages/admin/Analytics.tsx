import { useState } from 'react';

interface ByType { type: string; total: number; correct: number; avg_ms: number }
interface RecentGame { code: string; started_at: string; finished_at: string; player_count: number; top_score: number }
interface AnalyticsData {
  totalGames: number; totalAnswers: number; totalCorrect: number;
  byType: ByType[]; recentGames: RecentGame[];
}

const API_BASE = import.meta.env.VITE_API_URL ?? '';

function pct(correct: number, total: number) {
  if (!total) return '—';
  return `${Math.round((correct / total) * 100)}%`;
}

function fmt(dt: string) {
  return new Date(dt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Analytics() {
  const [password, setPassword] = useState('');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/analytics`, {
        headers: { 'x-admin-password': password },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setData(await res.json() as AnalyticsData);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!data) {
    return (
      <div className="page-center">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-center mb-6">Admin Analytics</h1>
          <div className="card">
            <label className="text-sm font-semibold block mb-2" style={{ color: 'var(--sp-muted)' }}>Admin Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchData()}
              className="input mb-4"
              placeholder="•���••••••"
              autoFocus
            />
            {error && (
              <p className="text-sm mb-3" style={{ color: 'var(--sp-error)' }}>{error}</p>
            )}
            <button onClick={fetchData} disabled={loading || !password} className="btn-green w-full py-3">
              {loading ? 'Loading...' : 'View Dashboard'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const overallPct = pct(data.totalCorrect, data.totalAnswers);

  return (
    <div className="min-h-screen px-4 py-8" style={{ background: 'var(--sp-black)' }}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Analytics</h1>
          <button onClick={() => setData(null)} className="btn-outline text-xs py-1.5 px-4">Logout</button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Games Played', value: data.totalGames },
            { label: 'Answers', value: data.totalAnswers },
            { label: 'Accuracy', value: overallPct },
          ].map(s => (
            <div key={s.label} className="card text-center">
              <p className="text-3xl font-bold" style={{ color: 'var(--sp-green)' }}>{s.value}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--sp-muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* By question type */}
        {data.byType.length > 0 && (
          <div className="card mb-6">
            <h2 className="font-bold mb-4">By Question Type</h2>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--sp-muted)' }} className="text-xs uppercase tracking-wider">
                  <th className="text-left pb-2">Type</th>
                  <th className="text-right pb-2">Total</th>
                  <th className="text-right pb-2">Accuracy</th>
                  <th className="text-right pb-2">Avg. time</th>
                </tr>
              </thead>
              <tbody>
                {data.byType.map(row => (
                  <tr key={row.type} className="border-t" style={{ borderColor: 'var(--sp-border)' }}>
                    <td className="py-2.5 font-medium">{row.type.replace(/_/g, ' ')}</td>
                    <td className="py-2.5 text-right">{row.total}</td>
                    <td className="py-2.5 text-right font-semibold" style={{ color: 'var(--sp-green)' }}>
                      {pct(row.correct, row.total)}
                    </td>
                    <td className="py-2.5 text-right" style={{ color: 'var(--sp-muted)' }}>
                      {row.avg_ms ? `${(row.avg_ms / 1000).toFixed(1)}s` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Recent games */}
        {data.recentGames.length > 0 && (
          <div className="card">
            <h2 className="font-bold mb-4">Recent Games</h2>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--sp-muted)' }} className="text-xs uppercase tracking-wider">
                  <th className="text-left pb-2">Code</th>
                  <th className="text-right pb-2">Players</th>
                  <th className="text-right pb-2">Top score</th>
                  <th className="text-right pb-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recentGames.map(g => (
                  <tr key={g.code} className="border-t" style={{ borderColor: 'var(--sp-border)' }}>
                    <td className="py-2.5 font-mono font-bold tracking-wider" style={{ color: 'var(--sp-green)' }}>{g.code}</td>
                    <td className="py-2.5 text-right">{g.player_count}</td>
                    <td className="py-2.5 text-right">{g.top_score ?? 0} pts</td>
                    <td className="py-2.5 text-right" style={{ color: 'var(--sp-muted)' }}>{fmt(g.finished_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.recentGames.length === 0 && data.byType.length === 0 && (
          <div className="text-center py-12" style={{ color: 'var(--sp-muted)' }}>
            <p className="text-4xl mb-3">🎮</p>
            <p>No completed games yet. Play your first round!</p>
          </div>
        )}
      </div>
    </div>
  );
}
