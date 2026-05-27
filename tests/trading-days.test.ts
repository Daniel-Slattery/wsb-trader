import { countTradingDays, addTradingDays, isMarketOpen } from '../src/lib/trading-days';

describe('countTradingDays', () => {
  it('counts 1 day between consecutive trading days', () => {
    // Mon 2026-05-25 → Tue 2026-05-26
    expect(countTradingDays('2026-05-25', '2026-05-26')).toBe(1);
  });

  it('skips weekend — Friday to Monday = 1 trading day', () => {
    // Fri 2026-06-12 → Mon 2026-06-15
    expect(countTradingDays('2026-06-12', '2026-06-15')).toBe(1);
  });

  it('counts 5 trading days across a weekend', () => {
    // Mon 2026-06-08 → Mon 2026-06-15 = 5 trading days (Tue 9, Wed 10, Thu 11, Fri 12, Mon 15)
    expect(countTradingDays('2026-06-08', '2026-06-15')).toBe(5);
  });

  it('returns 0 for same day', () => {
    expect(countTradingDays('2026-05-25', '2026-05-25')).toBe(0);
  });
});

describe('addTradingDays', () => {
  it('adds 5 trading days skipping a weekend', () => {
    // Buy Mon 2026-06-08, sell date = Mon 2026-06-15
    expect(addTradingDays('2026-06-08', 5)).toBe('2026-06-15');
  });
});

describe('isMarketOpen', () => {
  it('returns false on Saturday', () => {
    expect(isMarketOpen(new Date('2026-05-23T14:00:00Z'))).toBe(false);
  });

  it('returns false on Sunday', () => {
    expect(isMarketOpen(new Date('2026-05-24T14:00:00Z'))).toBe(false);
  });
});
