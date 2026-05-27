interface AgentPick {
  ticker: string;
  score: number;
  reasoning: string;
}

interface AgentRun {
  id: number;
  runAt: string;
  selectedTicker: string;
  reasoning: string;
  topPicks: AgentPick[];
  skipped: number;
  skipReason: string | null;
}

interface TodaysPickProps {
  run: AgentRun | null;
}

export function TodaysPick({ run }: TodaysPickProps) {
  if (!run) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <p className="text-gray-400 text-sm font-semibold mb-3">Today's Pick</p>
        <p className="text-gray-600 text-sm">No analysis run yet today.</p>
      </div>
    );
  }

  const [top, ...rest] = run.topPicks;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <p className="text-gray-400 text-sm font-semibold mb-3">Today's Pick</p>

      <div className="bg-gray-800 rounded-lg p-3 mb-3 border-l-4 border-blue-500">
        <div className="flex items-center justify-between">
          <span className="text-blue-400 text-xl font-bold">{top.ticker}</span>
          {run.skipped ? (
            <span className="bg-yellow-900/50 text-yellow-400 text-xs px-2 py-1 rounded-full">SKIPPED</span>
          ) : (
            <span className="bg-green-900/50 text-green-400 text-xs px-2 py-1 rounded-full font-semibold">BUY $2,000</span>
          )}
        </div>
        <p className="text-gray-400 text-xs mt-2 leading-relaxed">"{run.reasoning}"</p>
        {run.skipped && run.skipReason && (
          <p className="text-yellow-500 text-xs mt-1">⚠ {run.skipReason}</p>
        )}
      </div>

      <p className="text-gray-600 text-xs mb-2 uppercase tracking-wider">Also considered</p>
      <div className="flex flex-col gap-1.5">
        {rest.map(pick => (
          <div key={pick.ticker} className="flex justify-between bg-gray-800/50 rounded px-3 py-1.5">
            <span className="text-gray-300 text-sm font-semibold">{pick.ticker}</span>
            <span className="text-gray-500 text-xs">score {pick.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
