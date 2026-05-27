// US NYSE market holidays 2025–2027 (add more years as needed)
const NYSE_HOLIDAYS = new Set([
  // 2025
  '2025-01-01', '2025-01-20', '2025-02-17', '2025-04-18',
  '2025-05-26', '2025-06-19', '2025-07-04', '2025-09-01',
  '2025-11-27', '2025-12-25',
  // 2026
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03',
  '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07',
  '2026-11-26', '2026-12-25',
  // 2027
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26',
  '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06',
  '2027-11-25', '2027-12-24',
]);

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function isTradingDay(dateStr: string): boolean {
  const date = new Date(`${dateStr}T12:00:00Z`);
  const day = date.getUTCDay(); // 0 = Sun, 6 = Sat
  return day !== 0 && day !== 6 && !NYSE_HOLIDAYS.has(dateStr);
}

/** Count trading days elapsed from startDate (exclusive) to endDate (inclusive) */
export function countTradingDays(startDate: string, endDate: string): number {
  let count = 0;
  const cursor = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);

  cursor.setUTCDate(cursor.getUTCDate() + 1); // start exclusive

  while (cursor <= end) {
    const ds = toDateString(cursor);
    if (isTradingDay(ds)) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return count;
}

/** Return the date string n trading days after startDate */
export function addTradingDays(startDate: string, n: number): string {
  let count = 0;
  const cursor = new Date(`${startDate}T12:00:00Z`);

  while (count < n) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isTradingDay(toDateString(cursor))) count++;
  }

  return toDateString(cursor);
}

/** Returns true if the market is currently open (weekday, not holiday) */
export function isMarketOpen(now: Date = new Date()): boolean {
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  // Convert to ET and check 9:30–16:00
  const etOffset = -5; // UTC-5 (EST); adjust for DST if needed
  const etHour = (now.getUTCHours() + etOffset + 24) % 24;
  const etMinute = now.getUTCMinutes();
  const etMinutes = etHour * 60 + etMinute;
  return etMinutes >= 570 && etMinutes < 960; // 9:30am–4:00pm
}
