interface AgentPick {
  ticker: string;
  score: number;
  reasoning: string;
}

interface RedditTickerSignal {
  ticker: string;
  mentions: number;
  totalScore: number;
  totalComments: number;
}

interface RedditInput {
  source?: string;
  postCount?: number;
  fallbackReason?: string;
  cachedAt?: string;
  cacheAgeHours?: number;
  signals?: RedditTickerSignal[];
}

interface AgentRun {
  id: number;
  runAt: string;
  selectedTicker: string;
  reasoning: string;
  topPicks: AgentPick[];
  rawReddit?: RedditInput | RedditTickerSignal[] | null;
  skipped: number;
  skipReason: string | null;
}

interface TodaysPickProps {
  run: AgentRun | null;
  positionSize: number;
}

function getRedditHealth(rawReddit: AgentRun['rawReddit']): { label: string; degraded: boolean } | null {
  if (!rawReddit) return null;

  if (Array.isArray(rawReddit)) {
    return { label: `Reddit: legacy data, ${rawReddit.length} ticker signals`, degraded: false };
  }

  const source = rawReddit.source ?? 'unknown';
  const postCount = rawReddit.postCount ?? 0;
  const signalCount = rawReddit.signals?.length ?? 0;
  const cacheAge = rawReddit.cacheAgeHours === undefined ? '' : `, ${rawReddit.cacheAgeHours}h old`;
  return {
    label: `Reddit: ${source}, ${postCount} posts, ${signalCount} signals${cacheAge}`,
    degraded: source === 'rss' || source === 'cache' || postCount < 25,
  };
}

export function TodaysPick({ run, positionSize }: TodaysPickProps) {
  if (!run) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <p className="text-gray-400 text-sm font-semibold mb-3">Today&apos;s Pick</p>
        <p className="text-gray-600 text-sm">No analysis run yet today.</p>
      </div>
    );
  }

  const [top, ...rest] = run.topPicks;
  const redditHealth = getRedditHealth(run.rawReddit);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <p className="text-gray-400 text-sm font-semibold mb-3">Today&apos;s Pick</p>
      {redditHealth && (
        <p className={`text-xs mb-3 ${redditHealth.degraded ? 'text-yellow-500' : 'text-gray-500'}`}>
          {redditHealth.label}
        </p>
      )}

      <div className="bg-gray-800 rounded-lg p-3 mb-3 border-l-4 border-blue-500">
        <div className="flex items-center justify-between">
          <span className="text-blue-400 text-xl font-bold">{top.ticker}</span>
          {run.skipped ? (
            <span className="bg-yellow-900/50 text-yellow-400 text-xs px-2 py-1 rounded-full">SKIPPED</span>
          ) : (
            <span className="bg-green-900/50 text-green-400 text-xs px-2 py-1 rounded-full font-semibold">BUY ${positionSize.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
          )}
        </div>
        <p className="text-gray-400 text-xs mt-2 leading-relaxed">&quot;{run.reasoning}&quot;</p>
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
