-- Dev seed: creates a test game
INSERT OR IGNORE INTO games (id, code, status, host_user_id, config, created_at)
VALUES (
  'seed-game-1',
  'DEMO01',
  'LOBBY',
  'seed-user-1',
  '{"questionCount":10,"genres":"all","enabledTypes":["GUESS_THE_OWNER","TOP_ARTIST_MATCH"]}',
  CURRENT_TIMESTAMP
);
