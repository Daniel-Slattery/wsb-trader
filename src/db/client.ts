import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

const DATABASE_URL = process.env.DATABASE_URL ?? './wsb-trader.db';

// Singleton — reuse connection across hot-reloads in Next.js dev
const globalForDb = global as unknown as { db: ReturnType<typeof drizzle> };

export const db = globalForDb.db ?? drizzle(new Database(DATABASE_URL), { schema });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = db;
}
