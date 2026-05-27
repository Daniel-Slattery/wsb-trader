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
    ? { ...todaysRun, topPicks: JSON.parse(todaysRun.topPicks), skipped: todaysRun.skipped ?? 0 }
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
