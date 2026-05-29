<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# WSB Trader — Agent Context

## What This Is

A paper-trading simulator. Every weekday morning it scrapes r/wallstreetbets, fetches financial news, sends both to GPT-4o, and simulates a stock buy. After 5 trading days it auto-sells and records P&L. A Next.js dashboard shows the equity curve, open positions, and AI reasoning logs. **No real money. No real trades.**

---

## Architecture: Two Processes, One Database

```
worker.ts          (node-cron — two jobs per weekday)
Next.js app        (App Router SSR — dashboard + API routes)
wsb-trader.db      (SQLite — shared by both processes)
```

In **dev**: `concurrently` runs both. In **production**: PM2 manages both (see `ecosystem.config.cjs`).

### Worker schedule (America/New_York)
| Time | Job | What it does |
|---|---|---|
| 8:30am | `runAnalysis()` | Scrape WSB → fetch news → GPT-4o → insert `agent_runs` row |
| 9:35am | `runTradeExecution()` | Close 5-day-old positions → open today's buy → snapshot equity |

The 65-minute gap is intentional — waits for market open (9:30am ET).

---

## Directory Structure

```
wsb-trader/
├── worker.ts                   # Cron worker process (root level)
├── scripts/
│   └── run-worker-now.ts       # Manual one-shot pipeline trigger (npm run worker:run)
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout (dark mode, Geist font)
│   │   ├── page.tsx            # Dashboard (SSR) — equity chart, positions, today's pick
│   │   ├── globals.css
│   │   ├── components/Nav.tsx
│   │   ├── agent-logs/page.tsx # All past GPT-4o runs, newest first
│   │   ├── trades/page.tsx     # Closed trade history table
│   │   └── api/
│   │       ├── agent-runs/route.ts      # GET — all runs, JSON fields parsed
│   │       ├── equity-history/route.ts  # GET — all equity snapshots
│   │       ├── portfolio/route.ts       # GET — open positions + live Yahoo Finance prices
│   │       └── trades/route.ts          # GET — all closed positions
│   ├── components/             # Shared 'use client' UI components
│   │   ├── AgentRunCard.tsx    # Collapsible card per agent run
│   │   ├── EquityChart.tsx     # Recharts equity curve
│   │   ├── OpenPositionsTable.tsx
│   │   ├── StatCards.tsx       # Summary row: equity, cash, positions, win rate
│   │   ├── TodaysPick.tsx      # Today's AI pick with score and reasoning
│   │   └── TradeHistoryTable.tsx
│   ├── db/
│   │   ├── schema.ts           # Drizzle schema — 4 tables (source of truth)
│   │   ├── client.ts           # Singleton DB connection (global var, hot-reload safe)
│   │   ├── index.ts            # Re-exports db + all tables
│   │   └── migrations/         # Drizzle-generated SQL (do not hand-edit)
│   └── lib/                    # Pure TypeScript business logic — no React
│       ├── agent.ts            # GPT-4o prompt + OpenAI call → top 5 picks
│       ├── news.ts             # NewsAPI fetcher (last 24h headlines)
│       ├── prices.ts           # Yahoo Finance — single + batch price fetch
│       ├── reddit.ts           # r/wallstreetbets OAuth fetcher with RSS fallback
│       ├── ticker-parser.ts    # Regex ticker extractor ($NVDA / NVDA), has blocklist
│       ├── trade-engine.ts     # Core trading logic + pure calc helpers
│       └── trading-days.ts     # NYSE calendar: countTradingDays, addTradingDays, isMarketOpen
└── tests/
    ├── ticker-parser.test.ts
    ├── trade-engine.test.ts    # Tests pure calc helpers only (no DB/network)
    └── trading-days.test.ts
```

---

## Database Schema (SQLite + Drizzle ORM)

Schema lives in `src/db/schema.ts`. To change schema: edit schema → `npm run db:generate` → `npm run db:migrate`.

### `agent_runs`
One row per GPT-4o analysis run.
- `top_picks` — JSON string: `[{ticker, score, reasoning}]`
- `selected_ticker` — the #1 pick
- `reasoning` — GPT-4o summary paragraph
- `raw_reddit`, `raw_news` — JSON strings of raw input data
- `skipped`, `skip_reason` — set during trade execution if buy was not placed

### `positions`
One row per simulated position.
- `status`: `'open'` | `'closed'`
- `sell_price`, `sell_date`, `pnl`, `pnl_pct` — null until closed
- `buy_date` / `sell_date` — ISO 8601 date strings (`"2026-05-27"`)
- `agent_run_id` — FK to `agent_runs`

### `trades`
Buy/sell ledger.
- `action`: `'buy'` | `'sell'`

### `equity_snapshots`
Daily portfolio value for the equity chart.
- `total_equity` = cash + market value of open positions

---

## Key Conventions

**Synchronous DB access.** Drizzle + better-sqlite3 is synchronous. No `await` on DB calls — use `.run()`, `.all()`, `.get()`. Do not introduce async DB patterns.

**JSON columns.** `top_picks`, `raw_reddit`, `raw_news` are stored as JSON strings. Always `JSON.parse()` on read, `JSON.stringify()` on write. This is intentional.

**Page-level SSR data fetching.** `page.tsx` files query the DB directly (not via API routes). API routes exist for potential client-side polling. All pages export `export const revalidate = 60`.

**`'use client'` boundary.** Only components that need state or browser APIs are client components (`AgentRunCard`, `EquityChart`). All pages are server components.

**Pure functions in `trade-engine.ts`.** `calculatePositionSize`, `calculateQuantity`, `calculatePnl` are pure and tested. `processBuy`, `processSells`, `takeEquitySnapshot` have side effects (DB + network) and are not unit-tested.

**Path alias.** `@/` maps to `src/`.

**Package manager.** `npm` only. Do not use yarn or pnpm.

---

## Trading Rules (hardcoded in `trade-engine.ts`)

- Max 5 open positions at once
- Position size = 20% of total equity per trade
- Hold period = exactly 5 NYSE trading days
- NYSE holiday calendar hardcoded 2025–2027 in `trading-days.ts` — update when adding future years

---

## Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `NEWS_API_KEY` | Yes | newsapi.org — free tier 100 req/day |
| `OPENAI_API_KEY` | Yes | OpenAI key **or** GitHub Models PAT |
| `OPENAI_BASE_URL` | No | Set to `https://models.inference.ai.azure.com` for GitHub Models (free with Copilot) |
| `STARTING_EQUITY` | No | Default `10000` |
| `DATABASE_URL` | No | Default `./wsb-trader.db` |
| `CRON_TIMEZONE` | No | Default `America/New_York` |
| `POSITION_SIZE_PCT` | No | Default `0.20` |

---

## Commands

```bash
npm run dev          # Start Next.js (Turbopack) + worker concurrently
npm run worker:run   # Trigger full pipeline immediately (bypasses cron)
npm test             # Jest unit tests
npm run db:generate  # Generate migration from schema changes
npm run db:migrate   # Apply migrations
npm run pm2:start    # Build + start both processes via PM2
npm run pm2:logs     # Tail live logs
npm run pm2:restart  # Restart after code changes
```

---

## Testing

- Jest + ts-jest, `testEnvironment: 'node'`
- Tests cover pure functions only — no DB, no network, no Next.js
- Files: `tests/**/*.test.ts`
- Run: `npm test`
