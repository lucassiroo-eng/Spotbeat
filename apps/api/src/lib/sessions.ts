export interface Session {
  userId?: string;
  displayName?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const sessions = new Map<string, Session>();

export function getSession(sessionId: string): Session | undefined {
  return sessions.get(sessionId);
}

export function setSession(sessionId: string, session: Session): void {
  sessions.set(sessionId, session);
}

export function updateSession(sessionId: string, updates: Partial<Session>): void {
  const existing = sessions.get(sessionId);
  if (existing) sessions.set(sessionId, { ...existing, ...updates });
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function requireSession(sessionId: string | undefined): Session {
  if (!sessionId) throw new Error('missing_session');
  const session = sessions.get(sessionId);
  if (!session) throw new Error('session_not_found');
  return session;
}
