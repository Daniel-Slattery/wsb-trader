# WSB Trader

A forward-testing AI stock trading simulator. No real money, no real trades — pure paper trading to see how well Reddit hype + news sentiment predict short-term stock moves.

Every weekday the system scrapes r/wallstreetbets and financial news, feeds the signals into GPT-4o, simulates a $2,000 position in the top pick, holds for 5 trading days, then closes it and logs the P&L.

## How it works

Two processes share a SQLite database:

- **Worker** (`worker.ts`) — runs two daily cron jobs:
  - `8:30am ET` — scrapes WSB hot posts + NewsAPI headlines, calls GPT-4o to rank the top 5 tickers, saves the result
  - `9:35am ET` — checks for positions due to close (5 trading days elapsed), records sells, simulates today's buy at the opening price via yahoo-finance2, takes an equity snapshot

- **Next.js app** — read-only dashboard at `localhost:3000` showing equity growth, open positions with live P&L, today's AI pick, trade history, and agent run logs

Both start with a single `npm run dev`.

## Stack

| Concern | Tech |
|---|---|
| Framework | Next.js 15 (App Router, SSR) |
| Database | SQLite via better-sqlite3 + Drizzle ORM |
| Reddit | Public JSON API (no credentials) |
| News | NewsAPI.org |
| Prices | yahoo-finance2 |
| AI | OpenAI GPT-4o (`response_format: json_object`) |
| Scheduler | node-cron |
| Charts | Recharts |
| Styling | Tailwind CSS 4 |

## Setup

**1. Clone and install**

```bash
git clone https://github.com/Daniel-Slattery/wsb-trader.git
cd wsb-trader
npm install
```

**2. Configure environment**

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```bash
# Reddit — no credentials needed, uses the public JSON API

# https://newsapi.org — free tier is 100 requests/day
NEWS_API_KEY=

# https://platform.openai.com
OPENAI_API_KEY=

# Simulator config
STARTING_EQUITY=10000
NEXT_PUBLIC_STARTING_EQUITY=10000
DATABASE_URL=./wsb-trader.db
CRON_TIMEZONE=America/New_York
```

**3. Initialise the database**

```bash
npm run db:migrate
```

**4. Start**

```bash
npm run dev
```

Opens the dashboard at [http://localhost:3000](http://localhost:3000). The worker process starts alongside it and waits for the next scheduled cron.

**5. Trigger a manual run (optional)**

To test the full pipeline immediately without waiting for the crons:

```bash
npm run worker:run
```

This runs the complete analysis → buy → equity snapshot cycle right now. Requires real API keys.

## Dashboard pages

| Route | Description |
|---|---|
| `/` | Equity chart, stat cards, today's pick, open positions |
| `/trades` | All closed trades with P&L |
| `/agent-logs` | Expandable log of every GPT-4o analysis run |

## Simulator rules

- **Starting equity:** $10,000 (configurable via `STARTING_EQUITY`)
- **Position size:** 20% of starting equity = $2,000 fixed per trade
- **Max open positions:** 5
- **Hold period:** exactly 5 trading days (NYSE holidays excluded)
- **Buy price:** market price at ~9:35am ET on entry day
- **Sell price:** market price at ~9:35am ET on exit day
- **One buy per day maximum**
- Buy is skipped if all 5 slots are occupied or cash is insufficient

## Project structure

```
wsb-trader/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Dashboard
│   │   ├── trades/page.tsx             # Trade history
│   │   ├── agent-logs/page.tsx         # Agent logs
│   │   └── api/                        # portfolio, trades, equity-history, agent-runs
│   ├── db/                             # Drizzle schema + SQLite client
│   ├── lib/
│   │   ├── ticker-parser.ts            # Regex + blocklist ticker extraction
│   │   ├── trading-days.ts             # NYSE holiday list, trading day arithmetic
│   │   ├── reddit.ts                   # WSB hot post scraper
│   │   ├── news.ts                     # NewsAPI fetcher
│   │   ├── prices.ts                   # yahoo-finance2 wrapper
│   │   ├── agent.ts                    # GPT-4o prompt + JSON response parser
│   │   └── trade-engine.ts             # Buy/sell simulation, equity snapshot
│   └── components/                     # React UI components
├── worker.ts                           # Cron jobs
├── scripts/run-worker-now.ts           # Manual pipeline trigger
└── tests/                              # Jest unit tests (18 tests)
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js + worker together |
| `npm test` | Run unit tests |
| `npm run worker:run` | Trigger full pipeline immediately |
| `npm run db:generate` | Regenerate Drizzle migrations after schema changes |
| `npm run db:migrate` | Apply pending migrations |

## Disclaimer

This is a simulation. It does not place real trades and does not constitute financial advice. Past simulated performance has no bearing on real market outcomes.
