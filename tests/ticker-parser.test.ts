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

  it('normalizes mixed-case ticker typos', () => {
    expect(extractTickers('SpaceX (SPCe) Right to the Mars 🚀')).toContain('SPCE');
    expect(extractTickers('SPCe pre IPO YOLO')).toContain('SPCE');
  });

  it('normalizes cashtags regardless of case', () => {
    expect(extractTickers('loading up on $spce and $NvDa')).toEqual(['SPCE', 'NVDA']);
  });

  it('ignores uppercase fragments in hyphenated model names', () => {
    const result = extractTickers('Blue Origin New Glenn blew up at LC-36 before NG-4');
    expect(result).not.toContain('LC');
    expect(result).not.toContain('NG');
  });

  it('deduplicates tickers', () => {
    const result = extractTickers('NVDA NVDA NVDA');
    expect(result.filter(t => t === 'NVDA')).toHaveLength(1);
  });

  it('ignores tickers longer than 5 chars', () => {
    expect(extractTickers('TOOLONG is not a ticker')).not.toContain('TOOLONG');
  });
});
