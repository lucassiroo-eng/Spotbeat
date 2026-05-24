import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'fs';
import path from 'path';

const dbPath = (process.env.DATABASE_URL ?? 'sqlite:./dev.db').replace('sqlite:', '');
export let db: DatabaseSync;

export function initDb(): void {
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  const schema = readFileSync(path.join(__dirname, '../../db/schema.sql'), 'utf-8');
  db.exec(schema);

  console.log(`[db] SQLite ready at ${dbPath}`);
}
