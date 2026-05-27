import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

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
