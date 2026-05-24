const BASE = import.meta.env.VITE_API_URL ?? '';

function sessionHeaders(sessionId?: string): Record<string, string> {
  return sessionId ? { 'x-session-id': sessionId } : {};
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; message?: string };
    throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string, sessionId?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: sessionHeaders(sessionId),
  });
  return handle<T>(res);
}

export async function apiPost<T>(path: string, body: unknown, sessionId?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sessionHeaders(sessionId) },
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}

export async function apiPatch<T>(path: string, body: unknown, sessionId?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...sessionHeaders(sessionId) },
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}
