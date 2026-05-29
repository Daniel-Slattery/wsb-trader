import { calculatePositionSize, calculateQuantity, calculatePnl } from '../src/lib/trade-engine';

describe('calculatePositionSize', () => {
  it('returns 20% of starting equity', () => {
    expect(calculatePositionSize(10000, 0.2)).toBe(2000);
  });

  it('respects custom percentage', () => {
    expect(calculatePositionSize(10000, 0.1)).toBe(1000);
  });
});

describe('calculateQuantity', () => {
  it('returns fractional shares rounded down to 6 decimals', () => {
    expect(calculateQuantity(2000, 150.33)).toBe(13.304064);
  });

  it('allows fractional shares when price exceeds position size', () => {
    expect(calculateQuantity(100, 500)).toBe(0.2);
  });

  it('returns 0 for invalid inputs', () => {
    expect(calculateQuantity(100, 0)).toBe(0);
    expect(calculateQuantity(0, 500)).toBe(0);
  });
});

describe('calculatePnl', () => {
  it('calculates positive P&L', () => {
    const result = calculatePnl(100, 120, 10);
    expect(result.pnl).toBe(200);
    expect(result.pnlPct).toBeCloseTo(20);
  });

  it('calculates negative P&L', () => {
    const result = calculatePnl(100, 80, 10);
    expect(result.pnl).toBe(-200);
    expect(result.pnlPct).toBeCloseTo(-20);
  });
});
