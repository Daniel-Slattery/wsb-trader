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
