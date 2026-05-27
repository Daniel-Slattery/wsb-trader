interface ClosedPosition {
  id: number;
  ticker: string;
  buyPrice: number;
  sellPrice: number | null;
  buyDate: string;
  sellDate: string | null;
  quantity: number;
  pnl: number | null;
  pnlPct: number | null;
}

export function TradeHistoryTable({ positions }: { positions: ClosedPosition[] }) {
  const totalPnl = positions.reduce((sum, p) => sum + (p.pnl ?? 0), 0);
  const wins = positions.filter(p => (p.pnl ?? 0) > 0).length;

  if (positions.length === 0) {
    return <p className="text-gray-600 text-sm text-center py-8">No closed trades yet.</p>;
  }

  return (
    <div>
      <div className="flex gap-6 mb-4 text-sm">
        <span className="text-gray-500">Total trades: <span className="text-white font-medium">{positions.length}</span></span>
        <span className="text-gray-500">Wins: <span className="text-green-400 font-medium">{wins}</span></span>
        <span className="text-gray-500">Losses: <span className="text-red-400 font-medium">{positions.length - wins}</span></span>
        <span className="text-gray-500">Total P&L: <span className={`font-medium ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}</span></span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['Ticker', 'Buy Date', 'Sell Date', 'Buy Price', 'Sell Price', 'Qty', 'P&L', 'P&L %'].map(h => (
                <th key={h} className="text-gray-500 text-xs font-medium py-2 text-right first:text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map(pos => {
              const isGain = (pos.pnl ?? 0) >= 0;
              return (
                <tr key={pos.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                  <td className="py-2 text-blue-400 font-bold">{pos.ticker}</td>
                  <td className="py-2 text-gray-400 text-right">{pos.buyDate}</td>
                  <td className="py-2 text-gray-400 text-right">{pos.sellDate ?? '—'}</td>
                  <td className="py-2 text-gray-300 text-right">${pos.buyPrice.toFixed(2)}</td>
                  <td className="py-2 text-gray-300 text-right">${pos.sellPrice?.toFixed(2) ?? '—'}</td>
                  <td className="py-2 text-gray-300 text-right">{pos.quantity}</td>
                  <td className={`py-2 text-right font-medium ${isGain ? 'text-green-400' : 'text-red-400'}`}>
                    {isGain ? '+' : ''}${pos.pnl?.toFixed(2) ?? '—'}
                  </td>
                  <td className={`py-2 text-right text-xs ${isGain ? 'text-green-400' : 'text-red-400'}`}>
                    {pos.pnlPct != null ? `${isGain ? '+' : ''}${pos.pnlPct.toFixed(1)}%` : '—'}
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
