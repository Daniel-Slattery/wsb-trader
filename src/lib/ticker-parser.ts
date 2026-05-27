// Words that match the ticker regex but aren't tickers
const BLOCKLIST = new Set([
  'A', 'I', 'IT', 'BE', 'GO', 'DO', 'NO', 'SO', 'OR', 'AT', 'TO',
  'IN', 'ON', 'US', 'IF', 'BY', 'MY', 'HE', 'ME', 'AM', 'PM',
  'CEO', 'CFO', 'CTO', 'COO', 'IPO', 'ETF', 'SEC', 'NYSE', 'FDA',
  'GDP', 'CPI', 'fed', 'YOLO', 'FOMO', 'TBH', 'IMO', 'DD', 'OP',
  'WSB', 'ATH', 'ATL', 'EPS', 'PE', 'AI', 'AR', 'VR', 'PC', 'TV',
]);

// Matches 1–5 uppercase letters, optionally preceded by $ sign
const TICKER_REGEX = /\$([A-Z]{1,5})|(?<![a-z])([A-Z]{2,5})(?![a-z])/g;

export function extractTickers(text: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = TICKER_REGEX.exec(text)) !== null) {
    const ticker = match[1] ?? match[2];
    if (ticker && !BLOCKLIST.has(ticker) && ticker.length >= 2 && ticker.length <= 5) {
      found.add(ticker);
    }
  }

  TICKER_REGEX.lastIndex = 0; // reset for reuse
  return Array.from(found);
}
