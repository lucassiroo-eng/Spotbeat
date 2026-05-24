import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { initDb } from './lib/db';
import { setupWebSocket } from './modules/realtime';
import authRouter from './modules/auth';
import spotifyRouter from './modules/spotify';
import gameRouter from './modules/game';
import analyticsRouter from './modules/analytics';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use((req, res, next) => {
  const origin = process.env.WEB_URL ?? 'http://127.0.0.1:5173';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-session-id');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/spotify', spotifyRouter);
app.use('/api/games', gameRouter);
app.use('/api/admin/analytics', analyticsRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message ?? 'internal_error' });
});

setupWebSocket(wss);

const PORT = parseInt(process.env.PORT ?? '3000', 10);

initDb();
server.listen(PORT, '127.0.0.1', () => {
  console.log(`[api] running on http://127.0.0.1:${PORT}`);
});
