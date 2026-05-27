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
  const { signals } = await fetchWSBSignals();
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
