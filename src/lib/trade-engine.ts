import { eq } from 'drizzle-orm';
import { db, positions, trades, equitySnapshots } from '../db';
import { getPrices } from './prices';
import { countTradingDays } from './trading-days';

const STARTING_EQUITY = parseFloat(process.env.STARTING_EQUITY ?? '10000');
const POSITION_SIZE_PCT = parseFloat(process.env.POSITION_SIZE_PCT ?? '0.20');
const MAX_POSITIONS = 5;
const QUANTITY_DECIMALS = 6;

// --- Pure calculation helpers (exported for testing) ---

export function calculatePositionSize(startingEquity: number, pct: number): number {
  return startingEquity * pct;
}

export function calculateQuantity(positionSize: number, price: number): number {
  if (positionSize <= 0 || price <= 0) return 0;

  const multiplier = 10 ** QUANTITY_DECIMALS;
  return Math.floor((positionSize / price) * multiplier) / multiplier;
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

  // Position size based on closed equity only (cash + open positions valued at cost, no unrealised P&L)
  const investedAtCost = openPositions.reduce((sum, p) => sum + p.buyPrice * p.quantity, 0);
  const cash = getCash();
  const closedEquity = cash + investedAtCost;
  const positionSize = calculatePositionSize(closedEquity, POSITION_SIZE_PCT);

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
