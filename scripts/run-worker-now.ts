/**
 * Manually triggers the full pipeline immediately.
 * Usage: npm run worker:run
 */
import { fetchWSBSignals } from '../src/lib/reddit';
import { fetchNewsHeadlines } from '../src/lib/news';
import { runAgent } from '../src/lib/agent';
import { processSells, processBuyFromPicks, takeEquitySnapshot } from '../src/lib/trade-engine';
import { db, agentRuns } from '../src/db';
import { eq } from 'drizzle-orm';

async function main() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`Manual run for ${today}`);

  // Analysis
  const { signals, rawPosts, metadata } = await fetchWSBSignals();
  console.log(`Reddit (${metadata.source}): fetched ${metadata.postCount} posts, found signals for ${signals.length} tickers`);
  if (metadata.fallbackReason) {
    console.warn(`Reddit fallback reason: ${metadata.fallbackReason}`);
  }
  const headlines = await fetchNewsHeadlines(signals.slice(0, 10).map(s => s.ticker));
  const agentResult = await runAgent(signals, rawPosts, headlines);

  const runRecord = db.insert(agentRuns)
    .values({
      topPicks: JSON.stringify(agentResult.picks),
      selectedTicker: agentResult.picks[0].ticker,
      reasoning: agentResult.summary,
      rawReddit: JSON.stringify({ ...metadata, signals, rawPosts }),
      rawNews: JSON.stringify(headlines),
      skipped: 0,
    })
    .returning({ id: agentRuns.id })
    .get();

  console.log('Agent picks:', agentResult.picks.map(p => `${p.ticker}(${p.score})`).join(', '));

  // Trade execution
  await processSells(today);

  const { skipped, ticker, skipReason } = await processBuyFromPicks(runRecord.id, agentResult.picks, today);

  if (skipped) {
    console.warn('Buy skipped:', skipReason);
    db.update(agentRuns).set({ skipped: 1, skipReason }).where(eq(agentRuns.id, runRecord.id)).run();
  } else if (ticker && ticker !== agentResult.picks[0].ticker) {
    db.update(agentRuns).set({ selectedTicker: ticker }).where(eq(agentRuns.id, runRecord.id)).run();
  }

  await takeEquitySnapshot();
  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
