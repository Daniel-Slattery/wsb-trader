interface StatCardsProps {
  totalEquity: number;
  cash: number;
  openPositions: number;
  winRate: number | null;
}

export function StatCards({ totalEquity, cash, openPositions, winRate }: StatCardsProps) {
  const startingEquity = parseFloat(process.env.NEXT_PUBLIC_STARTING_EQUITY ?? '10000');
  const allTimeReturn = ((totalEquity - startingEquity) / startingEquity) * 100;
  const isPositive = allTimeReturn >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <p className="text-gray-500 text-xs uppercase tracking-wider">Total Equity</p>
        <p className="text-white text-2xl font-bold mt-1">${totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        <p className={`text-xs mt-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? '▲' : '▼'} {Math.abs(allTimeReturn).toFixed(1)}% all time
        </p>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <p className="text-gray-500 text-xs uppercase tracking-wider">Cash Available</p>
        <p className="text-white text-2xl font-bold mt-1">${cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        <p className="text-gray-500 text-xs mt-1">{((cash / totalEquity) * 100).toFixed(1)}% of equity</p>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <p className="text-gray-500 text-xs uppercase tracking-wider">Open Positions</p>
        <p className="text-white text-2xl font-bold mt-1">{openPositions} / 5</p>
        <p className="text-gray-500 text-xs mt-1">{5 - openPositions} slot{5 - openPositions !== 1 ? 's' : ''} free</p>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <p className="text-gray-500 text-xs uppercase tracking-wider">Win Rate</p>
        <p className="text-white text-2xl font-bold mt-1">{winRate !== null ? `${winRate.toFixed(0)}%` : '—'}</p>
        <p className="text-gray-500 text-xs mt-1">closed trades</p>
      </div>
    </div>
  );
}
