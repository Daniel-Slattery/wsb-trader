# WSB Trader — Design Spec

**Date:** 2026-05-27  
**Status:** Approved

---

## Overview

A forward-testing stock trading simulator. An AI agent scans Reddit (r/wallstreetbets) and aggregated financial news headlines daily, uses an LLM to pick its top 5 tech stocks, and simulates buying its #1 pick at market open every trading day. Each position is held for exactly 5 trading days then auto-sold. No real trades are ever executed — prices and decisions are tracked and visualised in a dashboard UI.

**Goal:** Observe how a hype-driven, momentum-following AI strategy performs in the real world over time, without financial risk.

---

## Architecture

Two processes share a single SQLite database, started together with one command.

```
npm run dev
  ├── next dev          → Next.js app (UI + API routes)
  └── tsx watch worker.ts → Worker (cron + agent + trade engine)
```

### Worker Process (`worker.ts`)

Runs independently of the web server. Responsible for all data fetching, LLM analysis, and trade simulation.

Two cron jobs run each weekday. Analysis fires first at 8:30am ET (before market open); trade execution fires at 9:35am ET (5 minutes after market open, when an opening price is available).

**Analysis cron:** `30 8 * * 1-5` (8:30am ET)
1. Fetch Reddit r/wallstreetbets hot/new posts (last 24h) — extract ticker mentions, post scores, comment counts
2. Fetch financial headlines from NewsAPI.org for top candidate tickers
3. Build a structured prompt combining both signals and send to GPT-4o
4. LLM returns: ranked top 5 tickers, a confidence score per ticker, and a plain-English reasoning summary
5. Record the run to `agent_runs` (picks stored, no buy yet)

**Trade execution cron:** `35 9 * * 1-5` (9:35am ET)
1. Check all open positions: if any have reached 5 trading days since buy date, fetch current price via `yahoo-finance2`, calculate P&L, close position, add proceeds back to cash
2. Simulate a buy for today's #1 pick (from the 8:30am `agent_runs` record): fetch current price (≈ opening price), record to `positions` and `trades`, deduct from cash
3. Write an `equity_snapshot` with current cash + mark-to-market value of all open positions

### Next.js App

Serves the UI and exposes read-only API routes that query SQLite. Also polls `yahoo-finance2` during market hours to show live unrealised P&L on open positions.

**Pages:**
- `/` — Dashboard (equity chart, stat cards, today's pick, open positions table)
- `/trades` — Full trade history (all buys and sells with P&L)
- `/agent-logs` — Per-run agent reasoning, top 5 picks, raw signal data

**API routes:**
- `GET /api/portfolio` — open positions with current prices
- `GET /api/trades` — all completed trades
- `GET /api/equity-history` — equity snapshots for chart
- `GET /api/agent-runs` — agent run history with reasoning

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database | SQLite via `better-sqlite3` + Drizzle ORM |
| Scheduler | `node-cron` (inside worker.ts) |
| Process runner | `concurrently` |
| Reddit | Reddit API via `snoowrap` |
| News | NewsAPI.org REST API |
| LLM | OpenAI GPT-4o (`openai` npm package) |
| Stock prices | `yahoo-finance2` (no API key required) |
| Charts | Recharts |
| Styling | Tailwind CSS |

---

## Data Sources

### Reddit (r/wallstreetbets)
- Fetch hot + new posts from the last 24 hours using the Reddit API
- Extract: post title, score (upvotes), number of comments, author flair
- Parse ticker symbols from titles using a regex + a known-ticker allowlist (to avoid false positives like "I", "A", "IT")
- Aggregate per ticker: mention count, total upvote score, total comments

### NewsAPI.org
- Query the `everything` endpoint with finance-related keywords and top ticker candidates
- Sources include Reuters, CNBC, MarketWatch, Benzinga, The Motley Fool, and others aggregated by NewsAPI
- Fetch headlines from the last 24 hours
- Each headline is included in the LLM prompt as a signal

### Yahoo Finance (`yahoo-finance2`)
- Used by the trade execution cron (9:35am ET) to fetch the current price as a proxy for the opening price
- Used by the Next.js app to poll current prices for open positions during market hours
- No API key required; free tier sufficient for this usage pattern

---

## Agent Pipeline

### Input prompt structure

```
You are a momentum trading analyst. Based on the following signals from Reddit (r/wallstreetbets) and financial news in the last 24 hours, rank the top 5 most hyped tech stocks most likely to move today.

REDDIT SIGNALS:
- NVDA: 847 mentions, 42,300 upvotes, 3,200 comments
- AMD: 312 mentions, 18,100 upvotes, 1,400 comments
- TSLA: 289 mentions, 31,000 upvotes, 2,100 comments
...

NEWS HEADLINES:
- "Nvidia beats Q2 earnings estimates by 18%" (Reuters, 2h ago)
- "AMD announces new GPU lineup" (CNBC, 5h ago)
...

Return a JSON object with this exact structure:
{
  "picks": [
    { "ticker": "NVDA", "score": 95, "reasoning": "..." },
    ...
  ],
  "summary": "Plain English summary of today's market sentiment"
}
```

### Output
- `picks`: array of 5 objects, ranked by score (0–100)
- `summary`: 2–3 sentence plain-English explanation shown in the UI
- The #1 pick (highest score) is the simulated buy for the day

---

## Trade Engine

### Position sizing
- Starting equity: configurable via `STARTING_EQUITY` env var (default: `10000`)
- Each position: 20% of starting equity (fixed dollar amount, not floating)
- Max 5 open positions at any time
- If all 5 slots are occupied, the day's buy is skipped and logged

### Buy logic
1. Check available cash ≥ position size
2. Check open positions < 5
3. Fetch current price via `yahoo-finance2` (trade execution cron runs at 9:35am ET, ≈ opening price)
4. Calculate quantity = `floor(positionSize / openingPrice)`
5. Record buy in `trades` and `positions`
6. Deduct `quantity * openingPrice` from cash

### Sell logic (runs each day before the buy step)
1. Query all open positions
2. For each, count trading days elapsed since `buy_date` (skipping weekends and US market holidays using the `date-holidays` package)
3. If elapsed trading days ≥ 5: fetch current price, calculate P&L, close position, add proceeds back to cash

### P&L calculation
```
pnl = (sell_price - buy_price) * quantity
pnl_pct = ((sell_price - buy_price) / buy_price) * 100
```

---

## Data Model (SQLite)

### `agent_runs`
```sql
id              INTEGER PRIMARY KEY
run_at          TEXT NOT NULL          -- ISO 8601 timestamp
top_picks       TEXT NOT NULL          -- JSON: [{ticker, score, reasoning}]
selected_ticker TEXT NOT NULL
reasoning       TEXT NOT NULL          -- LLM summary
raw_reddit      TEXT                   -- JSON: raw Reddit signal
raw_news        TEXT                   -- JSON: raw NewsAPI headlines
skipped         INTEGER DEFAULT 0      -- 1 if no buy made (slots full / no cash)
skip_reason     TEXT
```

### `positions`
```sql
id              INTEGER PRIMARY KEY
ticker          TEXT NOT NULL
buy_price       REAL NOT NULL
quantity        INTEGER NOT NULL
buy_date        TEXT NOT NULL          -- ISO 8601 date
sell_price      REAL
sell_date       TEXT
status          TEXT DEFAULT 'open'    -- 'open' | 'closed'
pnl             REAL
pnl_pct         REAL
agent_run_id    INTEGER REFERENCES agent_runs(id)
```

### `trades`
```sql
id              INTEGER PRIMARY KEY
ticker          TEXT NOT NULL
action          TEXT NOT NULL          -- 'buy' | 'sell'
price           REAL NOT NULL
quantity        INTEGER NOT NULL
executed_at     TEXT NOT NULL          -- ISO 8601 timestamp
position_id     INTEGER REFERENCES positions(id)
```

### `equity_snapshots`
```sql
id                    INTEGER PRIMARY KEY
snapshot_at           TEXT NOT NULL
total_equity          REAL NOT NULL
cash                  REAL NOT NULL
invested_value        REAL NOT NULL    -- mark-to-market of open positions
open_positions_count  INTEGER NOT NULL
```

---

## UI

### Dashboard (`/`)
- **Stat cards row:** Total Equity, Cash Available, Open Positions (n/5), Win Rate
- **Equity Growth chart:** Line chart of `equity_snapshots.total_equity` over time (Recharts)
- **Today's Pick panel:** Selected ticker, buy amount, LLM reasoning summary, ranked list of all 5 candidates with scores
- **Open Positions table:** Ticker, buy price, current price (live polled), unrealised P&L ($ and %), invested amount, trading days remaining

### Trade History (`/trades`)
- Table of all closed trades: ticker, buy date, sell date, buy price, sell price, P&L, P&L %
- Summary stats: total trades, total P&L, win/loss count

### Agent Logs (`/agent-logs`)
- Per-run log: date, selected ticker, top 5 picks with scores, LLM reasoning summary
- Expandable raw signal data (Reddit mentions, news headlines)

---

## Configuration (`.env.local`)

```bash
# Required
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USERNAME=
REDDIT_PASSWORD=
NEWS_API_KEY=
OPENAI_API_KEY=

# Optional
STARTING_EQUITY=10000
POSITION_SIZE_PCT=0.20
CRON_TIMEZONE=America/New_York
```

---

## Development Setup

```bash
# Install dependencies
npm install

# Initialise database (runs Drizzle migrations)
npm run db:migrate

# Start both processes
npm run dev
# → next dev on :3000
# → tsx watch worker.ts (cron fires at 8:30am ET)

# Manually trigger one agent run (for testing)
npm run worker:run
```

The `worker:run` script bypasses the cron and executes the full pipeline immediately — useful for testing the agent without waiting for market hours.

---

## Key Constraints & Decisions

- **No real trades.** The app never connects to a brokerage. All buys and sells are purely simulated using fetched market prices.
- **5 trading days** (not calendar days). Weekends and US market holidays are excluded from the hold period count.
- **Fixed position size.** 20% of `STARTING_EQUITY`, not 20% of current equity. This keeps position sizing predictable and avoids compounding distortions.
- **One buy per day maximum.** Even if multiple positions close on the same day, only one new buy is made per daily run.
- **Slot full = skip.** If 5 positions are already open, the day's run is logged but no buy is placed.
- **yahoo-finance2 for prices.** Free, no API key, reliable for this usage volume. The trade execution cron fires at 9:35am ET (5 minutes after market open) to fetch a price that closely approximates the official opening price.
