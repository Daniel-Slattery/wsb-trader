interface Position {
  id: number;
  ticker: string;
  buyPrice: number;
  buyDate: string;
  quantity: number;
  currentPrice: number;
  unrealisedPnl: number;
  unrealisedPnlPct: number;
}

interface OpenPositionsTableProps {
  positions: Position[];
  tradingDaysLeft: Record<number, number>;
}

export function OpenPositionsTable({ positions, tradingDaysLeft }: OpenPositionsTableProps) {
  if (positions.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <p className="text-gray-400 text-sm font-semibold mb-3">Open Positions</p>
        <p className="text-gray-600 text-sm py-4 text-center">No open positions.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <p className="text-gray-400 text-sm font-semibold mb-3">Open Positions</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['Ticker', 'Buy Price', 'Current', 'P&L', 'Invested', 'Days Left'].map(h => (
                <th key={h} className="text-gray-500 text-xs font-medium py-2 text-right first:text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map(pos => {
              const isGain = pos.unrealisedPnl >= 0;
              const daysLeft = tradingDaysLeft[pos.id] ?? '?';
              const daysColor = typeof daysLeft === 'number' && daysLeft <= 1 ? 'text-yellow-400' : 'text-green-400';
              return (
                <tr key={pos.id} className="border-b border-gray-800/50">
                  <td className="py-2 text-blue-400 font-bold">{pos.ticker}</td>
                  <td className="py-2 text-gray-300 text-right">${pos.buyPrice.toFixed(2)}</td>
                  <td className="py-2 text-gray-300 text-right">${pos.currentPrice.toFixed(2)}</td>
                  <td className={`py-2 text-right font-medium ${isGain ? 'text-green-400' : 'text-red-400'}`}>
                    {isGain ? '+' : ''}${pos.unrealisedPnl.toFixed(2)}
                    <span className="text-xs ml-1">({isGain ? '+' : ''}{pos.unrealisedPnlPct.toFixed(1)}%)</span>
                  </td>
                  <td className="py-2 text-gray-300 text-right">${(pos.buyPrice * pos.quantity).toFixed(2)}</td>
                  <td className="py-2 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full bg-gray-800 ${daysColor}`}>
                      {daysLeft}d
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
