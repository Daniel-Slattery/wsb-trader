// Words that match the ticker regex but aren't tickers
const BLOCKLIST = new Set([
  'A', 'I', 'IT', 'BE', 'GO', 'DO', 'NO', 'SO', 'OR', 'AT', 'TO',
  'IN', 'ON', 'US', 'IF', 'BY', 'MY', 'HE', 'ME', 'AM', 'PM', 'OF',
  'CEO', 'CFO', 'CTO', 'COO', 'IPO', 'ETF', 'SEC', 'NYSE', 'FDA',
  'GDP', 'CPI', 'fed', 'YOLO', 'FOMO', 'TBH', 'IMO', 'DD', 'OP',
  'WSB', 'ATH', 'ATL', 'EPS', 'PE', 'AI', 'AR', 'VR', 'PC', 'TV',
  'ALL', 'YOU', 'POV', 'SOLD', 'EVERY', 'THING', 'OWN', 'XD', 'FIG', 'PR', 'JP',
]);

// Matches tickers, including WSB-style mixed-case typos like SPCe.
const TICKER_REGEX = /\$([A-Za-z]{1,5})|(?<![A-Za-z0-9-])([A-Z]{2,5})(?![A-Za-z0-9-])|(?<![A-Za-z0-9-])([A-Z]{2,4}[a-z])(?![A-Za-z0-9-])/g;

export function extractTickers(text: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = TICKER_REGEX.exec(text)) !== null) {
    const ticker = (match[1] ?? match[2] ?? match[3])?.toUpperCase();
    if (ticker && !BLOCKLIST.has(ticker) && ticker.length >= 2 && ticker.length <= 5) {
      found.add(ticker);
    }
  }

  TICKER_REGEX.lastIndex = 0; // reset for reuse
  return Array.from(found);
}
