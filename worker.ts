import cron from 'node-cron';
import { eq } from 'drizzle-orm';
import { fetchWSBSignals } from './src/lib/reddit';
import { fetchNewsHeadlines } from './src/lib/news';
import { runAgent } from './src/lib/agent';
import { processSells, processBuyFromPicks, takeEquitySnapshot } from './src/lib/trade-engine';
import { db, agentRuns } from './src/db';

const TZ = process.env.CRON_TIMEZONE ?? 'America/New_York';

// --- Analysis pipeline (8:30am ET) ---
async function runAnalysis(): Promise<void> {
  console.log('[8:30am] Starting analysis run...');

  try {
    const { signals, rawPosts, source } = await fetchWSBSignals();
    console.log(`Reddit (${source}): found signals for ${signals.length} tickers`);

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

    // Step 3: simulate buy from the highest-ranked pick that is not already open
    const topPicks = JSON.parse(todaysRun.topPicks) as Array<{ ticker: string }>;
    const { skipped, ticker, skipReason } = await processBuyFromPicks(todaysRun.id, topPicks, today);

    if (skipped) {
      console.warn(`[9:35am] Buy skipped: ${skipReason}`);
      db.update(agentRuns)
        .set({ skipped: 1, skipReason })
        .where(eq(agentRuns.id, todaysRun.id))
        .run();
    } else if (ticker && ticker !== todaysRun.selectedTicker) {
      db.update(agentRuns)
        .set({ selectedTicker: ticker })
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
