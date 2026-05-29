# 📈 WSB Trader

> *"What if we just let AI read r/wallstreetbets and trade on the hype?"*

Vibe coded in an afternoon. A fully automated paper trading simulator that scrapes Reddit's [r/wallstreetbets](https://reddit.com/r/wallstreetbets), pulls financial news, feeds it all into GPT-4o, and simulates trades based on whatever the degenerates are excited about that day.

No real money. No real trades. Just vibes, memes, and data.

---

![r/wallstreetbets](https://img.shields.io/badge/powered%20by-r%2Fwallstreetbets-ff4500?style=for-the-badge&logo=reddit&logoColor=white)
![GPT-4o](https://img.shields.io/badge/AI-GPT--4o-412991?style=for-the-badge&logo=openai&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js&logoColor=white)
![SQLite](https://img.shields.io/badge/database-SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

---

## The Idea

Every weekday morning the system:

1. **Scrapes r/wallstreetbets** hot posts — counts ticker mentions, upvotes, comment velocity
2. **Pulls financial news** from NewsAPI — relevant headlines for the most hyped tickers
3. **Asks GPT-4o** to rank the top 5 picks by momentum conviction
4. **Simulates a buy** at ~9:35am ET — 20% of starting equity into the #1 pick
5. **Holds for 5 trading days**, then sells and logs the P&L
6. **Tracks everything** in a dashboard — equity curve, open positions, win rate, agent logs

The question: *can buying whatever WSB is yelling about, filtered through an AI, actually make money?*

---

## How it works

Two processes share a SQLite database:

- **Worker** (`worker.ts`) — two daily cron jobs:
  - `8:30am ET` — scrape WSB + news, call GPT-4o, save the picks
  - `9:35am ET` — close any positions held 5 trading days, open today's buy, snapshot equity

- **Next.js app** — dashboard at `localhost:3000` with equity chart, open positions with live P&L, today's pick, trade history, and full AI reasoning logs

---

## Stack

| Concern | Tech |
|---|---|
| Framework | Next.js 16 (App Router, SSR) |
| Database | SQLite via better-sqlite3 + Drizzle ORM |
| Reddit | OAuth API with RSS fallback |
| News | NewsAPI.org |
| Prices | yahoo-finance2 |
| AI | GPT-4o via GitHub Models (free with Copilot) or OpenAI API |
| Scheduler | node-cron |
| Process manager | PM2 |
| Charts | Recharts |
| Styling | Tailwind CSS 4 |

---

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
# Reddit — optional OAuth credentials; falls back to Old Reddit, then RSS if omitted/unavailable
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USER_AGENT=wsb-trader/1.0 by u/YOUR_REDDIT_USERNAME

# https://newsapi.org — free tier is 100 requests/day
NEWS_API_KEY=

# Option A: OpenAI API key (pay-per-use, ~pennies/day)
OPENAI_API_KEY=sk-...

# Option B: GitHub Models via Copilot subscription (free)
# Generate a PAT at github.com → Settings → Developer settings → Personal access tokens
# Make sure the token has the "Models: Read" permission
OPENAI_API_KEY=github_pat_...
OPENAI_BASE_URL=https://models.inference.ai.azure.com

# Simulator config — set your starting equity here
STARTING_EQUITY=100000
NEXT_PUBLIC_STARTING_EQUITY=100000
DATABASE_URL=./wsb-trader.db
CRON_TIMEZONE=America/New_York
```

**3. Initialise the database**

```bash
npm run db:migrate
```

**4. Start — production (recommended for always-on PC)**

```bash
# Install PM2 once globally
npm install -g pm2

# Build and launch both processes as background daemons
npm run pm2:start

# Survive reboots — run once, follow the printed sudo command
pm2 startup
pm2 save
```

**4. Start — development**

```bash
npm run dev
```

**5. Test the pipeline (optional)**

Trigger the full cycle immediately without waiting for the crons:

```bash
npm run worker:run
```

---

## Dashboard

| Route | What's there |
|---|---|
| `/` | Equity curve, stat cards, today's AI pick, open positions with live P&L |
| `/trades` | All closed trades with P&L |
| `/agent-logs` | Full log of every GPT-4o run — picks, scores, reasoning |

---

## Simulator rules

- **Starting equity:** configurable via `STARTING_EQUITY` (default $10,000)
- **Position size:** 20% of starting equity per trade — e.g. $20,000 on a $100k account
- **Max open positions:** 5 (max 100% of capital deployed at once)
- **Hold period:** exactly 5 NYSE trading days (holidays excluded)
- **Entry price:** live market price fetched at ~9:35am ET
- **Exit price:** live market price fetched at ~9:35am ET on day 5
- **One buy per day maximum**
- Buy is skipped if all 5 slots are occupied or cash is insufficient

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js + worker in dev mode |
| `npm run pm2:start` | Build and start both processes via PM2 |
| `npm run pm2:status` | See uptime and status of both processes |
| `npm run pm2:logs` | Tail live logs |
| `npm run pm2:restart` | Restart after changes |
| `npm run pm2:stop` | Stop both processes |
| `npm run worker:run` | Trigger full pipeline immediately |
| `npm test` | Run unit tests |
| `npm run db:migrate` | Apply pending database migrations |

---

## Disclaimer

This is a simulation. It does not place real trades and does not constitute financial advice. Buying stocks because Reddit is excited about them is, by most measures, a terrible idea. That's the point.
