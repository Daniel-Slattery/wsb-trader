# WSB Trader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a forward-testing stock trading simulator that uses Reddit + news signals fed into GPT-4o to pick daily stock buys, simulates 5-trading-day holds, and visualises performance in a Next.js dashboard.

**Architecture:** Two processes share a SQLite database — a worker process runs two daily crons (8:30am analysis, 9:35am trade execution) and a Next.js app serves the dashboard UI with read-only API routes. Started together with `npm run dev`.

**Tech Stack:** Next.js 15, TypeScript, SQLite (better-sqlite3 + Drizzle ORM), node-cron, concurrently, snoowrap (Reddit), NewsAPI.org, OpenAI GPT-4o, yahoo-finance2, Recharts, Tailwind CSS 4.

---

## File Map

```
wsb-trader/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout, dark theme
│   │   ├── page.tsx                    # Dashboard
│   │   ├── trades/page.tsx             # Trade History
│   │   ├── agent-logs/page.tsx         # Agent Logs
│   │   └── api/
│   │       ├── portfolio/route.ts      # GET open positions + live prices
│   │       ├── trades/route.ts         # GET all closed trades
│   │       ├── equity-history/route.ts # GET equity snapshots
│   │       └── agent-runs/route.ts     # GET agent run history
│   ├── db/
│   │   ├── client.ts                   # SQLite singleton via better-sqlite3
│   │   ├── schema.ts                   # Drizzle table definitions
│   │   └── index.ts                    # Re-exports db + schema
│   ├── lib/
│   │   ├── ticker-parser.ts            # Extract valid tickers from text
│   │   ├── trading-days.ts             # Count trading days between dates
│   │   ├── reddit.ts                   # WSB post fetcher
│   │   ├── news.ts                     # NewsAPI fetcher
│   │   ├── prices.ts                   # yahoo-finance2 wrapper
│   │   ├── agent.ts                    # GPT-4o prompt + response parsing
│   │   └── trade-engine.ts             # Buy/sell simulation + equity snapshot
│   └── components/
│       ├── StatCards.tsx               # Equity / cash / positions / win rate
│       ├── EquityChart.tsx             # Recharts line chart
│       ├── TodaysPick.tsx              # Today's AI pick + top 5 list
│       ├── OpenPositionsTable.tsx      # Live P&L table
│       ├── TradeHistoryTable.tsx       # Closed trades table
│       └── AgentRunCard.tsx            # Per-run expandable log card
├── worker.ts                           # Two crons: 8:30am analysis, 9:35am trades
├── scripts/
│   └── run-worker-now.ts              # Manual full pipeline trigger
├── tests/
│   ├── ticker-parser.test.ts
│   ├── trading-days.test.ts
│   └── trade-engine.test.ts
├── drizzle.config.ts
├── .env.local.example
└── package.json
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `drizzle.config.ts`
- Create: `.env.local.example`
- Create: `next.config.ts`
- Create: `src/app/layout.tsx`
- Create: `jest.config.ts`

- [ ] **Step 1: Bootstrap Next.js app**

```bash
cd ~/github
npx create-next-app@latest wsb-trader \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --no-import-alias
cd wsb-trader
```

- [ ] **Step 2: Install dependencies**

```bash
npm install better-sqlite3 drizzle-orm snoowrap openai yahoo-finance2 node-cron concurrently recharts
npm install --save-dev @types/better-sqlite3 @types/node-cron @types/snoowrap drizzle-kit tsx jest ts-jest @types/jest
```

- [ ] **Step 3: Create `drizzle.config.ts`**

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? './wsb-trader.db',
  },
} satisfies Config;
```

- [ ] **Step 4: Create `.env.local.example`**

```bash
# Reddit API (create app at https://www.reddit.com/prefs/apps)
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USERNAME=
REDDIT_PASSWORD=

# https://newsapi.org (free tier: 100 requests/day)
NEWS_API_KEY=

# https://platform.openai.com
OPENAI_API_KEY=

# Simulator config
STARTING_EQUITY=10000
DATABASE_URL=./wsb-trader.db
CRON_TIMEZONE=America/New_York
```

Copy to `.env.local` and fill in values:
```bash
cp .env.local.example .env.local
```

- [ ] **Step 5: Create `jest.config.ts`**

```typescript
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

- [ ] **Step 6: Update `package.json` scripts**

Add to the `"scripts"` block (merge with existing Next.js scripts):
```json
{
  "scripts": {
    "dev": "concurrently \"next dev --turbopack\" \"tsx watch worker.ts\"",
    "build": "next build",
    "start": "next start",
    "test": "jest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "worker:run": "tsx scripts/run-worker-now.ts"
  }
}
```

- [ ] **Step 7: Update `src/app/layout.tsx` with dark theme**

```tsx
import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'WSB Trader',
  description: 'AI-powered forward-testing stock simulator',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.className} bg-gray-950 text-gray-100 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding — Next.js + dependencies"
```

---

## Task 2: Database Schema & Client

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/client.ts`
- Create: `src/db/index.ts`

- [ ] **Step 1: Create `src/db/schema.ts`**

```typescript
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
  quantity: integer('quantity').notNull(),
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
  quantity: integer('quantity').notNull(),
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
```

- [ ] **Step 2: Create `src/db/client.ts`**

```typescript
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
```

- [ ] **Step 3: Create `src/db/index.ts`**

```typescript
export { db } from './client';
export * from './schema';
```

- [ ] **Step 4: Generate and run migrations**

```bash
npm run db:generate
npm run db:migrate
```

Expected: `src/db/migrations/` directory created, `wsb-trader.db` file created.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: database schema and Drizzle client"
```

---

## Task 3: Ticker Parser Utility

**Files:**
- Create: `src/lib/ticker-parser.ts`
- Create: `tests/ticker-parser.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/ticker-parser.test.ts
import { extractTickers } from '../src/lib/ticker-parser';

describe('extractTickers', () => {
  it('extracts uppercase ticker from text', () => {
    expect(extractTickers('NVDA is going to moon 🚀')).toContain('NVDA');
  });

  it('filters out common false positives', () => {
    const result = extractTickers('I bought A shares and IT was worth it');
    expect(result).not.toContain('I');
    expect(result).not.toContain('A');
    expect(result).not.toContain('IT');
  });

  it('extracts multiple tickers', () => {
    const result = extractTickers('NVDA and AMD both look bullish, also TSLA');
    expect(result).toContain('NVDA');
    expect(result).toContain('AMD');
    expect(result).toContain('TSLA');
  });

  it('deduplicates tickers', () => {
    const result = extractTickers('NVDA NVDA NVDA');
    expect(result.filter(t => t === 'NVDA')).toHaveLength(1);
  });

  it('ignores tickers longer than 5 chars', () => {
    expect(extractTickers('TOOLONG is not a ticker')).not.toContain('TOOLONG');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/ticker-parser.test.ts
```

Expected: FAIL — `Cannot find module '../src/lib/ticker-parser'`

- [ ] **Step 3: Implement `src/lib/ticker-parser.ts`**

```typescript
// Words that match the ticker regex but aren't tickers
const BLOCKLIST = new Set([
  'A', 'I', 'IT', 'BE', 'GO', 'DO', 'NO', 'SO', 'OR', 'AT', 'TO',
  'IN', 'ON', 'US', 'IF', 'BY', 'MY', 'HE', 'ME', 'AM', 'PM',
  'CEO', 'CFO', 'CTO', 'COO', 'IPO', 'ETF', 'SEC', 'NYSE', 'FDA',
  'GDP', 'CPI', 'fed', 'YOLO', 'FOMO', 'TBH', 'IMO', 'DD', 'OP',
  'WSB', 'ATH', 'ATL', 'EPS', 'PE', 'AI', 'AR', 'VR', 'PC', 'TV',
]);

// Matches 1–5 uppercase letters, optionally preceded by $ sign
const TICKER_REGEX = /\$([A-Z]{1,5})|(?<![a-z])([A-Z]{2,5})(?![a-z])/g;

export function extractTickers(text: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = TICKER_REGEX.exec(text)) !== null) {
    const ticker = match[1] ?? match[2];
    if (ticker && !BLOCKLIST.has(ticker) && ticker.length >= 2 && ticker.length <= 5) {
      found.add(ticker);
    }
  }

  TICKER_REGEX.lastIndex = 0; // reset for reuse
  return Array.from(found);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/ticker-parser.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/ticker-parser.ts tests/ticker-parser.test.ts
git commit -m "feat: ticker parser with blocklist"
```

---

## Task 4: Trading Days Utility

**Files:**
- Create: `src/lib/trading-days.ts`
- Create: `tests/trading-days.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/trading-days.test.ts
import { countTradingDays, addTradingDays, isMarketOpen } from '../src/lib/trading-days';

describe('countTradingDays', () => {
  it('counts 1 day between consecutive trading days', () => {
    // Mon 2026-05-25 → Tue 2026-05-26
    expect(countTradingDays('2026-05-25', '2026-05-26')).toBe(1);
  });

  it('skips weekend — Friday to Monday = 1 trading day', () => {
    // Fri 2026-05-22 → Mon 2026-05-25
    expect(countTradingDays('2026-05-22', '2026-05-25')).toBe(1);
  });

  it('counts 5 trading days across a weekend', () => {
    // Mon 2026-05-18 → Mon 2026-05-25 = 5 trading days
    expect(countTradingDays('2026-05-18', '2026-05-25')).toBe(5);
  });

  it('returns 0 for same day', () => {
    expect(countTradingDays('2026-05-25', '2026-05-25')).toBe(0);
  });
});

describe('addTradingDays', () => {
  it('adds 5 trading days skipping a weekend', () => {
    // Buy Mon 2026-05-18, sell date = Mon 2026-05-25
    expect(addTradingDays('2026-05-18', 5)).toBe('2026-05-25');
  });
});

describe('isMarketOpen', () => {
  it('returns false on Saturday', () => {
    expect(isMarketOpen(new Date('2026-05-23T14:00:00Z'))).toBe(false);
  });

  it('returns false on Sunday', () => {
    expect(isMarketOpen(new Date('2026-05-24T14:00:00Z'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/trading-days.test.ts
```

Expected: FAIL — `Cannot find module '../src/lib/trading-days'`

- [ ] **Step 3: Implement `src/lib/trading-days.ts`**

```typescript
// US NYSE market holidays 2025–2027 (add more years as needed)
const NYSE_HOLIDAYS = new Set([
  // 2025
  '2025-01-01', '2025-01-20', '2025-02-17', '2025-04-18',
  '2025-05-26', '2025-06-19', '2025-07-04', '2025-09-01',
  '2025-11-27', '2025-12-25',
  // 2026
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03',
  '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07',
  '2026-11-26', '2026-12-25',
  // 2027
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26',
  '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06',
  '2027-11-25', '2027-12-24',
]);

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function isTradingDay(dateStr: string): boolean {
  const date = new Date(`${dateStr}T12:00:00Z`);
  const day = date.getUTCDay(); // 0 = Sun, 6 = Sat
  return day !== 0 && day !== 6 && !NYSE_HOLIDAYS.has(dateStr);
}

/** Count trading days elapsed from startDate (exclusive) to endDate (inclusive) */
export function countTradingDays(startDate: string, endDate: string): number {
  let count = 0;
  const cursor = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);

  cursor.setUTCDate(cursor.getUTCDate() + 1); // start exclusive

  while (cursor <= end) {
    const ds = toDateString(cursor);
    if (isTradingDay(ds)) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return count;
}

/** Return the date string n trading days after startDate */
export function addTradingDays(startDate: string, n: number): string {
  let count = 0;
  const cursor = new Date(`${startDate}T12:00:00Z`);

  while (count < n) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isTradingDay(toDateString(cursor))) count++;
  }

  return toDateString(cursor);
}

/** Returns true if the market is currently open (weekday, not holiday) */
export function isMarketOpen(now: Date = new Date()): boolean {
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  // Convert to ET and check 9:30–16:00
  const etOffset = -5; // UTC-5 (EST); adjust for DST if needed
  const etHour = (now.getUTCHours() + etOffset + 24) % 24;
  const etMinute = now.getUTCMinutes();
  const etMinutes = etHour * 60 + etMinute;
  return etMinutes >= 570 && etMinutes < 960; // 9:30am–4:00pm
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/trading-days.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/trading-days.ts tests/trading-days.test.ts
git commit -m "feat: trading days utility with NYSE holiday list"
```

---

## Task 5: Reddit Data Fetcher

**Files:**
- Create: `src/lib/reddit.ts`

- [ ] **Step 1: Create `src/lib/reddit.ts`**

```typescript
import Snoowrap from 'snoowrap';
import { extractTickers } from './ticker-parser';

export interface RedditTickerSignal {
  ticker: string;
  mentions: number;
  totalScore: number;
  totalComments: number;
}

let redditClient: Snoowrap | null = null;

function getClient(): Snoowrap {
  if (!redditClient) {
    redditClient = new Snoowrap({
      userAgent: 'WSBTrader/1.0',
      clientId: process.env.REDDIT_CLIENT_ID!,
      clientSecret: process.env.REDDIT_CLIENT_SECRET!,
      username: process.env.REDDIT_USERNAME!,
      password: process.env.REDDIT_PASSWORD!,
    });
  }
  return redditClient;
}

export async function fetchWSBSignals(): Promise<{
  signals: RedditTickerSignal[];
  rawPosts: Array<{ title: string; score: number; numComments: number }>;
}> {
  const client = getClient();

  // Fetch top 100 hot posts from last 24 hours
  const posts = await client.getSubreddit('wallstreetbets').getHot({ limit: 100 });

  const rawPosts = posts.map(p => ({
    title: p.title,
    score: p.score,
    numComments: p.num_comments,
  }));

  // Aggregate ticker signals
  const tickerMap = new Map<string, RedditTickerSignal>();

  for (const post of rawPosts) {
    const tickers = extractTickers(post.title);
    for (const ticker of tickers) {
      const existing = tickerMap.get(ticker) ?? {
        ticker,
        mentions: 0,
        totalScore: 0,
        totalComments: 0,
      };
      tickerMap.set(ticker, {
        ticker,
        mentions: existing.mentions + 1,
        totalScore: existing.totalScore + post.score,
        totalComments: existing.totalComments + post.numComments,
      });
    }
  }

  // Return sorted by total score descending, top 20
  const signals = Array.from(tickerMap.values())
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 20);

  return { signals, rawPosts };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/reddit.ts
git commit -m "feat: Reddit WSB signal fetcher"
```

---

## Task 6: NewsAPI Fetcher

**Files:**
- Create: `src/lib/news.ts`

- [ ] **Step 1: Create `src/lib/news.ts`**

```typescript
export interface NewsHeadline {
  title: string;
  source: string;
  publishedAt: string;
  url: string;
}

export async function fetchNewsHeadlines(tickers: string[]): Promise<NewsHeadline[]> {
  const apiKey = process.env.NEWS_API_KEY!;

  // Build query: top ticker names + general finance terms
  const tickerQuery = tickers.slice(0, 5).join(' OR ');
  const query = encodeURIComponent(`(${tickerQuery}) AND (stock OR shares OR earnings OR rally)`);

  const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const url = `https://newsapi.org/v2/everything?q=${query}&from=${from}&language=en&sortBy=popularity&pageSize=30&apiKey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`NewsAPI error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as {
    articles: Array<{ title: string; source: { name: string }; publishedAt: string; url: string }>;
  };

  return data.articles.map(a => ({
    title: a.title,
    source: a.source.name,
    publishedAt: a.publishedAt,
    url: a.url,
  }));
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/news.ts
git commit -m "feat: NewsAPI headlines fetcher"
```

---

## Task 7: Yahoo Finance Price Fetcher

**Files:**
- Create: `src/lib/prices.ts`

- [ ] **Step 1: Create `src/lib/prices.ts`**

```typescript
import yahooFinance from 'yahoo-finance2';

export interface StockPrice {
  ticker: string;
  price: number;
  marketState: string; // 'REGULAR' | 'PRE' | 'POST' | 'CLOSED'
}

export async function getPrice(ticker: string): Promise<StockPrice> {
  const quote = await yahooFinance.quote(ticker);

  const price = quote.regularMarketPrice ?? quote.preMarketPrice ?? quote.postMarketPrice;

  if (price == null) {
    throw new Error(`Could not fetch price for ${ticker}`);
  }

  return {
    ticker,
    price,
    marketState: quote.marketState ?? 'UNKNOWN',
  };
}

export async function getPrices(tickers: string[]): Promise<Map<string, StockPrice>> {
  const results = await Promise.allSettled(tickers.map(t => getPrice(t)));
  const map = new Map<string, StockPrice>();

  for (let i = 0; i < tickers.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      map.set(tickers[i], result.value);
    } else {
      console.error(`Failed to fetch price for ${tickers[i]}:`, result.reason);
    }
  }

  return map;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/prices.ts
git commit -m "feat: yahoo-finance2 price fetcher"
```

---

## Task 8: LLM Agent

**Files:**
- Create: `src/lib/agent.ts`

- [ ] **Step 1: Create `src/lib/agent.ts`**

```typescript
import OpenAI from 'openai';
import type { RedditTickerSignal } from './reddit';
import type { NewsHeadline } from './news';

export interface AgentPick {
  ticker: string;
  score: number;
  reasoning: string;
}

export interface AgentResult {
  picks: AgentPick[];
  summary: string;
}

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  return openaiClient;
}

function buildPrompt(
  redditSignals: RedditTickerSignal[],
  headlines: NewsHeadline[]
): string {
  const redditSection = redditSignals
    .map(s => `- ${s.ticker}: ${s.mentions} mentions, ${s.totalScore.toLocaleString()} upvotes, ${s.totalComments.toLocaleString()} comments`)
    .join('\n');

  const newsSection = headlines
    .slice(0, 20)
    .map(h => {
      const age = Math.round((Date.now() - new Date(h.publishedAt).getTime()) / 3_600_000);
      return `- "${h.title}" (${h.source}, ${age}h ago)`;
    })
    .join('\n');

  return `You are a momentum trading analyst. Based on the following signals from Reddit (r/wallstreetbets) and financial news in the last 24 hours, identify the top 5 most hyped US tech stocks most likely to make a significant move today.

REDDIT SIGNALS (r/wallstreetbets, last 24h):
${redditSection}

NEWS HEADLINES (last 24h):
${newsSection}

Instructions:
- Only include tickers that trade on US exchanges (NYSE/NASDAQ)
- Rank by combined momentum: social hype + news sentiment
- Score each pick 0–100 (100 = highest conviction)
- Keep each reasoning to 1–2 sentences

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "picks": [
    { "ticker": "NVDA", "score": 95, "reasoning": "Dominant WSB mentions with major earnings beat headline driving strong bullish sentiment." }
  ],
  "summary": "2–3 sentence plain English summary of today's overall market sentiment."
}`;
}

export async function runAgent(
  redditSignals: RedditTickerSignal[],
  headlines: NewsHeadline[]
): Promise<AgentResult> {
  const client = getClient();
  const prompt = buildPrompt(redditSignals, headlines);

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3, // low temp for consistent structured output
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('Empty response from GPT-4o');

  const parsed = JSON.parse(content) as AgentResult;

  if (!Array.isArray(parsed.picks) || parsed.picks.length === 0) {
    throw new Error(`Invalid agent response: ${content}`);
  }

  // Sort by score descending and take top 5
  parsed.picks = parsed.picks
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return parsed;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/agent.ts
git commit -m "feat: GPT-4o agent with structured JSON output"
```

---

## Task 9: Trade Engine

**Files:**
- Create: `src/lib/trade-engine.ts`
- Create: `tests/trade-engine.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/trade-engine.test.ts
import { calculatePositionSize, calculateQuantity, calculatePnl } from '../src/lib/trade-engine';

describe('calculatePositionSize', () => {
  it('returns 20% of starting equity', () => {
    expect(calculatePositionSize(10000, 0.2)).toBe(2000);
  });

  it('respects custom percentage', () => {
    expect(calculatePositionSize(10000, 0.1)).toBe(1000);
  });
});

describe('calculateQuantity', () => {
  it('floors to whole shares', () => {
    expect(calculateQuantity(2000, 150.33)).toBe(13);
  });

  it('returns 0 if price exceeds position size', () => {
    expect(calculateQuantity(100, 500)).toBe(0);
  });
});

describe('calculatePnl', () => {
  it('calculates positive P&L', () => {
    const result = calculatePnl(100, 120, 10);
    expect(result.pnl).toBe(200);
    expect(result.pnlPct).toBeCloseTo(20);
  });

  it('calculates negative P&L', () => {
    const result = calculatePnl(100, 80, 10);
    expect(result.pnl).toBe(-200);
    expect(result.pnlPct).toBeCloseTo(-20);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/trade-engine.test.ts
```

Expected: FAIL — `Cannot find module '../src/lib/trade-engine'`

- [ ] **Step 3: Implement `src/lib/trade-engine.ts`**

```typescript
import { eq, and } from 'drizzle-orm';
import { db, positions, trades, equitySnapshots } from '../db';
import { getPrices } from './prices';
import { countTradingDays } from './trading-days';
import type { AgentResult } from './agent';

const STARTING_EQUITY = parseFloat(process.env.STARTING_EQUITY ?? '10000');
const POSITION_SIZE_PCT = parseFloat(process.env.POSITION_SIZE_PCT ?? '0.20');
const MAX_POSITIONS = 5;

// --- Pure calculation helpers (exported for testing) ---

export function calculatePositionSize(startingEquity: number, pct: number): number {
  return startingEquity * pct;
}

export function calculateQuantity(positionSize: number, price: number): number {
  return Math.floor(positionSize / price);
}

export function calculatePnl(
  buyPrice: number,
  sellPrice: number,
  quantity: number
): { pnl: number; pnlPct: number } {
  const pnl = (sellPrice - buyPrice) * quantity;
  const pnlPct = ((sellPrice - buyPrice) / buyPrice) * 100;
  return { pnl, pnlPct };
}

// --- State helpers ---

export function getCash(): number {
  const STARTING_EQUITY = parseFloat(process.env.STARTING_EQUITY ?? '10000');
  const allTrades = db.select().from(trades).all();
  let cash = STARTING_EQUITY;
  for (const trade of allTrades) {
    if (trade.action === 'buy') cash -= trade.price * trade.quantity;
    if (trade.action === 'sell') cash += trade.price * trade.quantity;
  }
  return cash;
}

export function getOpenPositions() {
  return db
    .select()
    .from(positions)
    .where(eq(positions.status, 'open'))
    .all();
}

// --- Sell logic ---

export async function processSells(today: string): Promise<void> {
  const openPositions = getOpenPositions();

  for (const pos of openPositions) {
    const elapsed = countTradingDays(pos.buyDate, today);
    if (elapsed < 5) continue;

    const priceData = await getPrices([pos.ticker]);
    const current = priceData.get(pos.ticker);
    if (!current) {
      console.error(`Cannot fetch price for ${pos.ticker}, skipping sell`);
      continue;
    }

    const { pnl, pnlPct } = calculatePnl(pos.buyPrice, current.price, pos.quantity);

    // Close position
    db.update(positions)
      .set({
        sellPrice: current.price,
        sellDate: today,
        status: 'closed',
        pnl,
        pnlPct,
      })
      .where(eq(positions.id, pos.id))
      .run();

    // Record sell trade
    db.insert(trades)
      .values({
        ticker: pos.ticker,
        action: 'sell',
        price: current.price,
        quantity: pos.quantity,
        positionId: pos.id,
      })
      .run();

    console.log(`SELL ${pos.ticker}: ${pos.quantity} shares @ $${current.price.toFixed(2)} | P&L: $${pnl.toFixed(2)} (${pnlPct.toFixed(1)}%)`);
  }
}

// --- Buy logic ---

export async function processBuy(
  agentRunId: number,
  ticker: string,
  today: string
): Promise<{ skipped: boolean; skipReason?: string }> {
  const openPositions = getOpenPositions();

  if (openPositions.length >= MAX_POSITIONS) {
    return { skipped: true, skipReason: `All ${MAX_POSITIONS} position slots occupied` };
  }

  const positionSize = calculatePositionSize(STARTING_EQUITY, POSITION_SIZE_PCT);
  const cash = getCash();

  if (cash < positionSize) {
    return { skipped: true, skipReason: `Insufficient cash: $${cash.toFixed(2)} < $${positionSize.toFixed(2)}` };
  }

  const priceData = await getPrices([ticker]);
  const current = priceData.get(ticker);

  if (!current) {
    return { skipped: true, skipReason: `Failed to fetch price for ${ticker}` };
  }

  const quantity = calculateQuantity(positionSize, current.price);

  if (quantity === 0) {
    return { skipped: true, skipReason: `Price $${current.price} exceeds position size $${positionSize}` };
  }

  const actualCost = quantity * current.price;

  // Insert position
  const positionResult = db.insert(positions)
    .values({
      ticker,
      buyPrice: current.price,
      quantity,
      buyDate: today,
      status: 'open',
      agentRunId,
    })
    .returning({ id: positions.id })
    .get();

  // Insert buy trade
  db.insert(trades)
    .values({
      ticker,
      action: 'buy',
      price: current.price,
      quantity,
      positionId: positionResult.id,
    })
    .run();

  console.log(`BUY ${ticker}: ${quantity} shares @ $${current.price.toFixed(2)} | Cost: $${actualCost.toFixed(2)}`);

  return { skipped: false };
}

// --- Equity snapshot ---

export async function takeEquitySnapshot(): Promise<void> {
  const openPositions = getOpenPositions();
  const positionSize = calculatePositionSize(STARTING_EQUITY, POSITION_SIZE_PCT);

  // Fetch current prices for open positions
  const tickers = openPositions.map(p => p.ticker);
  const priceMap = tickers.length > 0 ? await getPrices(tickers) : new Map();

  let investedValue = 0;
  for (const pos of openPositions) {
    const current = priceMap.get(pos.ticker);
    investedValue += current ? current.price * pos.quantity : pos.buyPrice * pos.quantity;
  }

  // Calculate cash: starting equity minus all buy costs plus all sell proceeds
  const allTrades = db.select().from(trades).all();
  let cash = STARTING_EQUITY;
  for (const trade of allTrades) {
    if (trade.action === 'buy') cash -= trade.price * trade.quantity;
    if (trade.action === 'sell') cash += trade.price * trade.quantity;
  }

  const totalEquity = cash + investedValue;

  db.insert(equitySnapshots)
    .values({
      totalEquity,
      cash,
      investedValue,
      openPositionsCount: openPositions.length,
    })
    .run();

  console.log(`Equity snapshot: $${totalEquity.toFixed(2)} (cash: $${cash.toFixed(2)}, invested: $${investedValue.toFixed(2)})`);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/trade-engine.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/trade-engine.ts tests/trade-engine.test.ts
git commit -m "feat: trade engine — buy/sell simulation and equity snapshot"
```

---

## Task 10: Worker Process

**Files:**
- Create: `worker.ts`
- Create: `scripts/run-worker-now.ts`

- [ ] **Step 1: Create `worker.ts`**

```typescript
import cron from 'node-cron';
import { eq } from 'drizzle-orm';
import { fetchWSBSignals } from './src/lib/reddit';
import { fetchNewsHeadlines } from './src/lib/news';
import { runAgent } from './src/lib/agent';
import { processSells, processBuy, takeEquitySnapshot } from './src/lib/trade-engine';
import { db, agentRuns } from './src/db';

const TZ = process.env.CRON_TIMEZONE ?? 'America/New_York';

// --- Analysis pipeline (8:30am ET) ---
async function runAnalysis(): Promise<void> {
  console.log('[8:30am] Starting analysis run...');

  try {
    const { signals, rawPosts } = await fetchWSBSignals();
    console.log(`Reddit: found signals for ${signals.length} tickers`);

    const topTickers = signals.slice(0, 10).map(s => s.ticker);
    const headlines = await fetchNewsHeadlines(topTickers);
    console.log(`News: fetched ${headlines.length} headlines`);

    const agentResult = await runAgent(signals, headlines);
    console.log(`Agent picks: ${agentResult.picks.map(p => p.ticker).join(', ')}`);
    console.log(`Selected: ${agentResult.picks[0].ticker}`);

    db.insert(agentRuns)
      .values({
        topPicks: JSON.stringify(agentResult.picks),
        selectedTicker: agentResult.picks[0].ticker,
        reasoning: agentResult.summary,
        rawReddit: JSON.stringify(signals),
        rawNews: JSON.stringify(headlines),
        skipped: 0,
      })
      .run();

    console.log('[8:30am] Analysis complete.');
  } catch (err) {
    console.error('[8:30am] Analysis failed:', err);
  }
}

// --- Trade execution pipeline (9:35am ET) ---
async function runTradeExecution(): Promise<void> {
  console.log('[9:35am] Starting trade execution...');

  try {
    const today = new Date().toISOString().split('T')[0];

    // Step 1: process any sells due today
    await processSells(today);

    // Step 2: find today's agent run
    const todaysRun = db
      .select()
      .from(agentRuns)
      .orderBy(agentRuns.id)
      .all()
      .reverse()
      .find(r => r.runAt.startsWith(today));

    if (!todaysRun) {
      console.warn('[9:35am] No analysis run found for today — skipping buy.');
      return;
    }

    // Step 3: simulate buy
    const { skipped, skipReason } = await processBuy(
      todaysRun.id,
      todaysRun.selectedTicker,
      today
    );

    if (skipped) {
      console.warn(`[9:35am] Buy skipped: ${skipReason}`);
      db.update(agentRuns)
        .set({ skipped: 1, skipReason })
        .where(eq(agentRuns.id, todaysRun.id))
        .run();
    }

    // Step 4: take equity snapshot
    await takeEquitySnapshot();

    console.log('[9:35am] Trade execution complete.');
  } catch (err) {
    console.error('[9:35am] Trade execution failed:', err);
  }
}

// --- Cron jobs ---
cron.schedule('30 8 * * 1-5', runAnalysis, { timezone: TZ });
cron.schedule('35 9 * * 1-5', runTradeExecution, { timezone: TZ });

console.log(`Worker started. Crons scheduled (timezone: ${TZ})`);
console.log('  Analysis:         8:30am ET weekdays');
console.log('  Trade execution:  9:35am ET weekdays');
```

- [ ] **Step 2: Create `scripts/run-worker-now.ts`**

```typescript
/**
 * Manually triggers the full pipeline immediately.
 * Usage: npm run worker:run
 */
import { fetchWSBSignals } from '../src/lib/reddit';
import { fetchNewsHeadlines } from '../src/lib/news';
import { runAgent } from '../src/lib/agent';
import { processSells, processBuy, takeEquitySnapshot } from '../src/lib/trade-engine';
import { db, agentRuns } from '../src/db';
import { eq } from 'drizzle-orm';

async function main() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`Manual run for ${today}`);

  // Analysis
  const { signals, rawPosts } = await fetchWSBSignals();
  const headlines = await fetchNewsHeadlines(signals.slice(0, 10).map(s => s.ticker));
  const agentResult = await runAgent(signals, headlines);

  const runRecord = db.insert(agentRuns)
    .values({
      topPicks: JSON.stringify(agentResult.picks),
      selectedTicker: agentResult.picks[0].ticker,
      reasoning: agentResult.summary,
      rawReddit: JSON.stringify(signals),
      rawNews: JSON.stringify(headlines),
      skipped: 0,
    })
    .returning({ id: agentRuns.id })
    .get();

  console.log('Agent picks:', agentResult.picks.map(p => `${p.ticker}(${p.score})`).join(', '));

  // Trade execution
  await processSells(today);

  const { skipped, skipReason } = await processBuy(runRecord.id, agentResult.picks[0].ticker, today);

  if (skipped) {
    console.warn('Buy skipped:', skipReason);
    db.update(agentRuns).set({ skipped: 1, skipReason }).where(eq(agentRuns.id, runRecord.id)).run();
  }

  await takeEquitySnapshot();
  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add worker.ts scripts/run-worker-now.ts
git commit -m "feat: worker process with two crons and manual trigger script"
```

---

## Task 11: API Routes

**Files:**
- Create: `src/app/api/portfolio/route.ts`
- Create: `src/app/api/trades/route.ts`
- Create: `src/app/api/equity-history/route.ts`
- Create: `src/app/api/agent-runs/route.ts`

- [ ] **Step 1: Create `src/app/api/portfolio/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, positions } from '@/db';
import { getPrices } from '@/lib/prices';

export async function GET() {
  const openPositions = db
    .select()
    .from(positions)
    .where(eq(positions.status, 'open'))
    .all();

  const tickers = openPositions.map(p => p.ticker);
  const priceMap = tickers.length > 0 ? await getPrices(tickers) : new Map();

  const enriched = openPositions.map(pos => {
    const current = priceMap.get(pos.ticker);
    const currentPrice = current?.price ?? pos.buyPrice;
    const unrealisedPnl = (currentPrice - pos.buyPrice) * pos.quantity;
    const unrealisedPnlPct = ((currentPrice - pos.buyPrice) / pos.buyPrice) * 100;

    return {
      ...pos,
      currentPrice,
      unrealisedPnl,
      unrealisedPnlPct,
    };
  });

  return NextResponse.json(enriched);
}
```

- [ ] **Step 2: Create `src/app/api/trades/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { db, positions } from '@/db';
import { eq } from 'drizzle-orm';

export async function GET() {
  const closed = db
    .select()
    .from(positions)
    .where(eq(positions.status, 'closed'))
    .orderBy(positions.sellDate)
    .all()
    .reverse();

  return NextResponse.json(closed);
}
```

- [ ] **Step 3: Create `src/app/api/equity-history/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { db, equitySnapshots } from '@/db';

export async function GET() {
  const snapshots = db
    .select()
    .from(equitySnapshots)
    .orderBy(equitySnapshots.snapshotAt)
    .all();

  return NextResponse.json(snapshots);
}
```

- [ ] **Step 4: Create `src/app/api/agent-runs/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { db, agentRuns } from '@/db';

export async function GET() {
  const runs = db
    .select()
    .from(agentRuns)
    .orderBy(agentRuns.runAt)
    .all()
    .reverse();

  return NextResponse.json(
    runs.map(r => ({
      ...r,
      topPicks: JSON.parse(r.topPicks),
      rawReddit: r.rawReddit ? JSON.parse(r.rawReddit) : null,
      rawNews: r.rawNews ? JSON.parse(r.rawNews) : null,
    }))
  );
}
```

- [ ] **Step 5: Start dev server and verify routes respond**

```bash
npm run db:migrate  # ensure DB is up to date
# In a separate terminal: npm run dev
curl http://localhost:3000/api/portfolio
curl http://localhost:3000/api/equity-history
curl http://localhost:3000/api/agent-runs
curl http://localhost:3000/api/trades
```

Expected: each returns `[]` (empty array, no data yet).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/
git commit -m "feat: API routes — portfolio, trades, equity-history, agent-runs"
```

---

## Task 12: Dashboard UI Components

**Files:**
- Create: `src/components/StatCards.tsx`
- Create: `src/components/EquityChart.tsx`
- Create: `src/components/TodaysPick.tsx`
- Create: `src/components/OpenPositionsTable.tsx`

- [ ] **Step 1: Create `src/components/StatCards.tsx`**

```tsx
interface StatCardsProps {
  totalEquity: number;
  cash: number;
  openPositions: number;
  winRate: number | null;
}

export function StatCards({ totalEquity, cash, openPositions, winRate }: StatCardsProps) {
  const startingEquity = parseFloat(process.env.NEXT_PUBLIC_STARTING_EQUITY ?? '10000');
  const allTimeReturn = ((totalEquity - startingEquity) / startingEquity) * 100;
  const isPositive = allTimeReturn >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <p className="text-gray-500 text-xs uppercase tracking-wider">Total Equity</p>
        <p className="text-white text-2xl font-bold mt-1">${totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        <p className={`text-xs mt-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? '▲' : '▼'} {Math.abs(allTimeReturn).toFixed(1)}% all time
        </p>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <p className="text-gray-500 text-xs uppercase tracking-wider">Cash Available</p>
        <p className="text-white text-2xl font-bold mt-1">${cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        <p className="text-gray-500 text-xs mt-1">{((cash / totalEquity) * 100).toFixed(1)}% of equity</p>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <p className="text-gray-500 text-xs uppercase tracking-wider">Open Positions</p>
        <p className="text-white text-2xl font-bold mt-1">{openPositions} / 5</p>
        <p className="text-gray-500 text-xs mt-1">{5 - openPositions} slot{5 - openPositions !== 1 ? 's' : ''} free</p>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <p className="text-gray-500 text-xs uppercase tracking-wider">Win Rate</p>
        <p className="text-white text-2xl font-bold mt-1">{winRate !== null ? `${winRate.toFixed(0)}%` : '—'}</p>
        <p className="text-gray-500 text-xs mt-1">closed trades</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/EquityChart.tsx`**

```tsx
'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface EquitySnapshot {
  snapshotAt: string;
  totalEquity: number;
}

interface EquityChartProps {
  data: EquitySnapshot[];
}

export function EquityChart({ data }: EquityChartProps) {
  const formatted = data.map(d => ({
    date: d.snapshotAt.slice(0, 10),
    equity: parseFloat(d.totalEquity.toFixed(2)),
  }));

  if (formatted.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <p className="text-gray-400 text-sm font-semibold mb-3">Equity Growth</p>
        <div className="flex items-center justify-center h-36 text-gray-600 text-sm">
          No data yet — first run pending
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <p className="text-gray-400 text-sm font-semibold mb-3">Equity Growth</p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={formatted}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${v.toLocaleString()}`} width={65} />
          <Tooltip
            contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#9ca3af' }}
            formatter={(value: number) => [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 'Equity']}
          />
          <Line type="monotone" dataKey="equity" stroke="#3b82f6" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/TodaysPick.tsx`**

```tsx
interface AgentPick {
  ticker: string;
  score: number;
  reasoning: string;
}

interface AgentRun {
  id: number;
  runAt: string;
  selectedTicker: string;
  reasoning: string;
  topPicks: AgentPick[];
  skipped: number;
  skipReason: string | null;
}

interface TodaysPickProps {
  run: AgentRun | null;
}

export function TodaysPick({ run }: TodaysPickProps) {
  if (!run) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <p className="text-gray-400 text-sm font-semibold mb-3">Today's Pick</p>
        <p className="text-gray-600 text-sm">No analysis run yet today.</p>
      </div>
    );
  }

  const [top, ...rest] = run.topPicks;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <p className="text-gray-400 text-sm font-semibold mb-3">Today's Pick</p>

      <div className="bg-gray-800 rounded-lg p-3 mb-3 border-l-4 border-blue-500">
        <div className="flex items-center justify-between">
          <span className="text-blue-400 text-xl font-bold">{top.ticker}</span>
          {run.skipped ? (
            <span className="bg-yellow-900/50 text-yellow-400 text-xs px-2 py-1 rounded-full">SKIPPED</span>
          ) : (
            <span className="bg-green-900/50 text-green-400 text-xs px-2 py-1 rounded-full font-semibold">BUY $2,000</span>
          )}
        </div>
        <p className="text-gray-400 text-xs mt-2 leading-relaxed">"{run.reasoning}"</p>
        {run.skipped && run.skipReason && (
          <p className="text-yellow-500 text-xs mt-1">⚠ {run.skipReason}</p>
        )}
      </div>

      <p className="text-gray-600 text-xs mb-2 uppercase tracking-wider">Also considered</p>
      <div className="flex flex-col gap-1.5">
        {rest.map(pick => (
          <div key={pick.ticker} className="flex justify-between bg-gray-800/50 rounded px-3 py-1.5">
            <span className="text-gray-300 text-sm font-semibold">{pick.ticker}</span>
            <span className="text-gray-500 text-xs">score {pick.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/OpenPositionsTable.tsx`**

```tsx
interface Position {
  id: number;
  ticker: string;
  buyPrice: number;
  buyDate: string;
  quantity: number;
  currentPrice: number;
  unrealisedPnl: number;
  unrealisedPnlPct: number;
}

interface OpenPositionsTableProps {
  positions: Position[];
  tradingDaysLeft: Record<number, number>;
}

export function OpenPositionsTable({ positions, tradingDaysLeft }: OpenPositionsTableProps) {
  if (positions.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <p className="text-gray-400 text-sm font-semibold mb-3">Open Positions</p>
        <p className="text-gray-600 text-sm py-4 text-center">No open positions.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <p className="text-gray-400 text-sm font-semibold mb-3">Open Positions</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['Ticker', 'Buy Price', 'Current', 'P&L', 'Invested', 'Days Left'].map(h => (
                <th key={h} className="text-gray-500 text-xs font-medium py-2 text-right first:text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map(pos => {
              const isGain = pos.unrealisedPnl >= 0;
              const daysLeft = tradingDaysLeft[pos.id] ?? '?';
              const daysColor = typeof daysLeft === 'number' && daysLeft <= 1 ? 'text-yellow-400' : 'text-green-400';
              return (
                <tr key={pos.id} className="border-b border-gray-800/50">
                  <td className="py-2 text-blue-400 font-bold">{pos.ticker}</td>
                  <td className="py-2 text-gray-300 text-right">${pos.buyPrice.toFixed(2)}</td>
                  <td className="py-2 text-gray-300 text-right">${pos.currentPrice.toFixed(2)}</td>
                  <td className={`py-2 text-right font-medium ${isGain ? 'text-green-400' : 'text-red-400'}`}>
                    {isGain ? '+' : ''}${pos.unrealisedPnl.toFixed(2)}
                    <span className="text-xs ml-1">({isGain ? '+' : ''}{pos.unrealisedPnlPct.toFixed(1)}%)</span>
                  </td>
                  <td className="py-2 text-gray-300 text-right">${(pos.buyPrice * pos.quantity).toFixed(2)}</td>
                  <td className="py-2 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full bg-gray-800 ${daysColor}`}>
                      {daysLeft}d
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: dashboard UI components — StatCards, EquityChart, TodaysPick, OpenPositionsTable"
```

---

## Task 13: Dashboard Page

**Files:**
- Create: `src/app/page.tsx`
- Create: `src/app/components/Nav.tsx`

- [ ] **Step 1: Create `src/app/components/Nav.tsx`**

```tsx
import Link from 'next/link';

export function Nav({ active }: { active: 'dashboard' | 'trades' | 'agent-logs' }) {
  const links = [
    { href: '/', label: 'Dashboard', key: 'dashboard' },
    { href: '/trades', label: 'Trade History', key: 'trades' },
    { href: '/agent-logs', label: 'Agent Logs', key: 'agent-logs' },
  ] as const;

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="text-blue-400 font-bold text-base">📈 WSB Trader</span>
        {links.map(link => (
          <Link
            key={link.key}
            href={link.href}
            className={`text-sm ${active === link.key ? 'text-blue-400 border-b-2 border-blue-400 pb-0.5' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {link.label}
          </Link>
        ))}
      </div>
      <span className="text-gray-600 text-xs">Sim only — no real trades</span>
    </nav>
  );
}
```

- [ ] **Step 2: Create `src/app/page.tsx`**

```tsx
import { Nav } from './components/Nav';
import { StatCards } from '@/components/StatCards';
import { EquityChart } from '@/components/EquityChart';
import { TodaysPick } from '@/components/TodaysPick';
import { OpenPositionsTable } from '@/components/OpenPositionsTable';
import { db, positions, equitySnapshots, agentRuns } from '@/db';
import { eq } from 'drizzle-orm';
import { countTradingDays } from '@/lib/trading-days';
import { getPrices } from '@/lib/prices';

export const revalidate = 60; // revalidate every 60 seconds

async function getDashboardData() {
  const today = new Date().toISOString().split('T')[0];

  // Equity snapshots for chart
  const snapshots = db.select().from(equitySnapshots).orderBy(equitySnapshots.snapshotAt).all();
  const latestSnapshot = snapshots.at(-1);

  // Open positions with live prices
  const openPositions = db.select().from(positions).where(eq(positions.status, 'open')).all();
  const priceMap = openPositions.length > 0
    ? await getPrices(openPositions.map(p => p.ticker))
    : new Map();

  const enrichedPositions = openPositions.map(pos => {
    const current = priceMap.get(pos.ticker);
    const currentPrice = current?.price ?? pos.buyPrice;
    return {
      ...pos,
      currentPrice,
      unrealisedPnl: (currentPrice - pos.buyPrice) * pos.quantity,
      unrealisedPnlPct: ((currentPrice - pos.buyPrice) / pos.buyPrice) * 100,
    };
  });

  // Trading days left per position
  const tradingDaysLeft: Record<number, number> = {};
  for (const pos of openPositions) {
    const elapsed = countTradingDays(pos.buyDate, today);
    tradingDaysLeft[pos.id] = Math.max(0, 5 - elapsed);
  }

  // Win rate
  const closedPositions = db.select().from(positions).where(eq(positions.status, 'closed')).all();
  const wins = closedPositions.filter(p => (p.pnl ?? 0) > 0).length;
  const winRate = closedPositions.length > 0 ? (wins / closedPositions.length) * 100 : null;

  // Today's agent run
  const allRuns = db.select().from(agentRuns).orderBy(agentRuns.runAt).all().reverse();
  const todaysRun = allRuns.find(r => r.runAt.startsWith(today)) ?? null;
  const parsedRun = todaysRun
    ? { ...todaysRun, topPicks: JSON.parse(todaysRun.topPicks) }
    : null;

  const startingEquity = parseFloat(process.env.STARTING_EQUITY ?? '10000');
  const cash = latestSnapshot?.cash ?? startingEquity;
  const totalEquity = latestSnapshot?.totalEquity ?? startingEquity;

  return { snapshots, enrichedPositions, tradingDaysLeft, winRate, parsedRun, cash, totalEquity };
}

export default async function DashboardPage() {
  const { snapshots, enrichedPositions, tradingDaysLeft, winRate, parsedRun, cash, totalEquity } =
    await getDashboardData();

  return (
    <main>
      <Nav active="dashboard" />
      <div className="max-w-7xl mx-auto px-6 py-6">
        <StatCards
          totalEquity={totalEquity}
          cash={cash}
          openPositions={enrichedPositions.length}
          winRate={winRate}
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
          <div className="lg:col-span-2">
            <EquityChart data={snapshots} />
          </div>
          <TodaysPick run={parsedRun} />
        </div>
        <OpenPositionsTable positions={enrichedPositions} tradingDaysLeft={tradingDaysLeft} />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Start the app and verify the dashboard loads**

```bash
npm run db:migrate
npm run dev
```

Open http://localhost:3000 — expect the dashboard to load with empty state (no positions, no chart data, "No analysis run yet today").

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/components/
git commit -m "feat: dashboard page wired up with server components"
```

---

## Task 14: Trade History Page

**Files:**
- Create: `src/components/TradeHistoryTable.tsx`
- Create: `src/app/trades/page.tsx`

- [ ] **Step 1: Create `src/components/TradeHistoryTable.tsx`**

```tsx
interface ClosedPosition {
  id: number;
  ticker: string;
  buyPrice: number;
  sellPrice: number | null;
  buyDate: string;
  sellDate: string | null;
  quantity: number;
  pnl: number | null;
  pnlPct: number | null;
}

export function TradeHistoryTable({ positions }: { positions: ClosedPosition[] }) {
  const totalPnl = positions.reduce((sum, p) => sum + (p.pnl ?? 0), 0);
  const wins = positions.filter(p => (p.pnl ?? 0) > 0).length;

  if (positions.length === 0) {
    return <p className="text-gray-600 text-sm text-center py-8">No closed trades yet.</p>;
  }

  return (
    <div>
      <div className="flex gap-6 mb-4 text-sm">
        <span className="text-gray-500">Total trades: <span className="text-white font-medium">{positions.length}</span></span>
        <span className="text-gray-500">Wins: <span className="text-green-400 font-medium">{wins}</span></span>
        <span className="text-gray-500">Losses: <span className="text-red-400 font-medium">{positions.length - wins}</span></span>
        <span className="text-gray-500">Total P&L: <span className={`font-medium ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}</span></span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['Ticker', 'Buy Date', 'Sell Date', 'Buy Price', 'Sell Price', 'Qty', 'P&L', 'P&L %'].map(h => (
                <th key={h} className="text-gray-500 text-xs font-medium py-2 text-right first:text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map(pos => {
              const isGain = (pos.pnl ?? 0) >= 0;
              return (
                <tr key={pos.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                  <td className="py-2 text-blue-400 font-bold">{pos.ticker}</td>
                  <td className="py-2 text-gray-400 text-right">{pos.buyDate}</td>
                  <td className="py-2 text-gray-400 text-right">{pos.sellDate ?? '—'}</td>
                  <td className="py-2 text-gray-300 text-right">${pos.buyPrice.toFixed(2)}</td>
                  <td className="py-2 text-gray-300 text-right">${pos.sellPrice?.toFixed(2) ?? '—'}</td>
                  <td className="py-2 text-gray-300 text-right">{pos.quantity}</td>
                  <td className={`py-2 text-right font-medium ${isGain ? 'text-green-400' : 'text-red-400'}`}>
                    {isGain ? '+' : ''}${pos.pnl?.toFixed(2) ?? '—'}
                  </td>
                  <td className={`py-2 text-right text-xs ${isGain ? 'text-green-400' : 'text-red-400'}`}>
                    {pos.pnlPct != null ? `${isGain ? '+' : ''}${pos.pnlPct.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/trades/page.tsx`**

```tsx
import { Nav } from '../components/Nav';
import { TradeHistoryTable } from '@/components/TradeHistoryTable';
import { db, positions } from '@/db';
import { eq } from 'drizzle-orm';

export const revalidate = 60;

export default function TradesPage() {
  const closed = db
    .select()
    .from(positions)
    .where(eq(positions.status, 'closed'))
    .orderBy(positions.sellDate)
    .all()
    .reverse();

  return (
    <main>
      <Nav active="trades" />
      <div className="max-w-7xl mx-auto px-6 py-6">
        <h1 className="text-xl font-bold text-white mb-5">Trade History</h1>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <TradeHistoryTable positions={closed} />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify the page loads at http://localhost:3000/trades**

Expected: page loads, shows "No closed trades yet."

- [ ] **Step 4: Commit**

```bash
git add src/components/TradeHistoryTable.tsx src/app/trades/
git commit -m "feat: trade history page"
```

---

## Task 15: Agent Logs Page

**Files:**
- Create: `src/components/AgentRunCard.tsx`
- Create: `src/app/agent-logs/page.tsx`

- [ ] **Step 1: Create `src/components/AgentRunCard.tsx`**

```tsx
'use client';

import { useState } from 'react';

interface AgentPick {
  ticker: string;
  score: number;
  reasoning: string;
}

interface AgentRun {
  id: number;
  runAt: string;
  selectedTicker: string;
  reasoning: string;
  topPicks: AgentPick[];
  skipped: number;
  skipReason: string | null;
}

export function AgentRunCard({ run }: { run: AgentRun }) {
  const [expanded, setExpanded] = useState(false);
  const date = run.runAt.slice(0, 10);
  const time = run.runAt.slice(11, 16);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-3">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm font-mono">{date}</span>
          <span className="text-gray-600 text-xs">{time} ET</span>
          <span className="text-blue-400 font-bold text-sm">{run.selectedTicker}</span>
          {run.skipped ? (
            <span className="bg-yellow-900/40 text-yellow-400 text-xs px-2 py-0.5 rounded-full">SKIPPED</span>
          ) : (
            <span className="bg-green-900/40 text-green-400 text-xs px-2 py-0.5 rounded-full">BOUGHT</span>
          )}
        </div>
        <span className="text-gray-600 text-xs">{expanded ? '▲ collapse' : '▼ expand'}</span>
      </div>

      {expanded && (
        <div className="mt-4 border-t border-gray-800 pt-4">
          <p className="text-gray-400 text-sm leading-relaxed mb-4">"{run.reasoning}"</p>

          <p className="text-gray-600 text-xs uppercase tracking-wider mb-2">All picks</p>
          <div className="flex flex-col gap-2 mb-4">
            {run.topPicks.map((pick, i) => (
              <div key={pick.ticker} className="bg-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`font-bold text-sm ${i === 0 ? 'text-blue-400' : 'text-gray-300'}`}>
                    #{i + 1} {pick.ticker}
                  </span>
                  <span className="text-gray-500 text-xs">score {pick.score}</span>
                </div>
                <p className="text-gray-500 text-xs leading-relaxed">{pick.reasoning}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/agent-logs/page.tsx`**

```tsx
import { Nav } from '../components/Nav';
import { AgentRunCard } from '@/components/AgentRunCard';
import { db, agentRuns } from '@/db';

export const revalidate = 60;

export default function AgentLogsPage() {
  const runs = db
    .select()
    .from(agentRuns)
    .orderBy(agentRuns.runAt)
    .all()
    .reverse()
    .map(r => ({
      ...r,
      topPicks: JSON.parse(r.topPicks),
    }));

  return (
    <main>
      <Nav active="agent-logs" />
      <div className="max-w-4xl mx-auto px-6 py-6">
        <h1 className="text-xl font-bold text-white mb-5">Agent Logs</h1>
        {runs.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-8">No runs yet — first cron fires at 8:30am ET on a weekday.</p>
        ) : (
          runs.map(run => <AgentRunCard key={run.id} run={run} />)
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify all three pages load cleanly**

```bash
# With npm run dev running:
open http://localhost:3000            # Dashboard
open http://localhost:3000/trades     # Trade History
open http://localhost:3000/agent-logs # Agent Logs
```

Expected: all three load without errors. Empty state messages shown throughout.

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all tests pass (ticker-parser, trading-days, trade-engine).

- [ ] **Step 5: Trigger a manual worker run to verify end-to-end**

```bash
# Ensure .env.local has real API keys filled in, then:
npm run worker:run
```

Expected: console output showing Reddit signals, news headlines, GPT-4o picks, a simulated buy, and an equity snapshot. Refresh http://localhost:3000 to see data appear.

- [ ] **Step 6: Final commit**

```bash
git add src/components/AgentRunCard.tsx src/app/agent-logs/
git commit -m "feat: agent logs page with expandable run cards"
git tag v0.1.0
```

---

## Done

The simulator is fully operational. From this point:

- The PC running the app 24/7 will fire the two daily crons automatically on weekdays
- http://localhost:3000 shows live equity, open positions, and AI reasoning
- `npm run worker:run` can trigger an immediate test cycle at any time
- Extend the NYSE holiday list in `src/lib/trading-days.ts` each year
