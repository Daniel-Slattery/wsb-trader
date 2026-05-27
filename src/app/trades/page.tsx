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
