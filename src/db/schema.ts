import { sqliteTable, integer, real, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const agentRuns = sqliteTable('agent_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  runAt: text('run_at').notNull().default(sql`(datetime('now'))`),
  topPicks: text('top_picks').notNull(),      // JSON: [{ticker, score, reasoning}]
  selectedTicker: text('selected_ticker').notNull(),
  reasoning: text('reasoning').notNull(),
  rawReddit: text('raw_reddit'),              // JSON
  rawNews: text('raw_news'),                  // JSON
  skipped: integer('skipped').default(0),    // 1 if no buy placed
  skipReason: text('skip_reason'),
});

export const positions = sqliteTable('positions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ticker: text('ticker').notNull(),
  buyPrice: real('buy_price').notNull(),
  quantity: real('quantity').notNull(),
  buyDate: text('buy_date').notNull(),        // ISO 8601 date e.g. "2026-05-27"
  sellPrice: real('sell_price'),
  sellDate: text('sell_date'),
  status: text('status').notNull().default('open'), // 'open' | 'closed'
  pnl: real('pnl'),
  pnlPct: real('pnl_pct'),
  agentRunId: integer('agent_run_id').references(() => agentRuns.id),
});

export const trades = sqliteTable('trades', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ticker: text('ticker').notNull(),
  action: text('action').notNull(),           // 'buy' | 'sell'
  price: real('price').notNull(),
  quantity: real('quantity').notNull(),
  executedAt: text('executed_at').notNull().default(sql`(datetime('now'))`),
  positionId: integer('position_id').references(() => positions.id),
});

export const equitySnapshots = sqliteTable('equity_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  snapshotAt: text('snapshot_at').notNull().default(sql`(datetime('now'))`),
  totalEquity: real('total_equity').notNull(),
  cash: real('cash').notNull(),
  investedValue: real('invested_value').notNull(),
  openPositionsCount: integer('open_positions_count').notNull(),
});
