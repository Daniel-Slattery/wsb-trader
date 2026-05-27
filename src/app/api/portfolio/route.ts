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
