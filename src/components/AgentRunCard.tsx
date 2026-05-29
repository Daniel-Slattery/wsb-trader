'use client';

import { useState } from 'react';

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
  skipped: number | null;
  skipReason: string | null;
}

function getRedditInputSummary(rawReddit: AgentRun['rawReddit']): string | null {
  if (!rawReddit) return null;

  if (Array.isArray(rawReddit)) {
    return `Reddit: legacy format, ${rawReddit.length} ticker signals`;
  }

  const source = rawReddit.source ?? 'unknown';
  const postCount = rawReddit.postCount ?? 0;
  const signalCount = rawReddit.signals?.length ?? 0;
  const cacheAge = rawReddit.cacheAgeHours === undefined ? '' : `, ${rawReddit.cacheAgeHours}h old`;
  return `Reddit: ${source}, ${postCount} posts, ${signalCount} ticker signals${cacheAge}`;
}

export function AgentRunCard({ run }: { run: AgentRun }) {
  const [expanded, setExpanded] = useState(false);
  const date = run.runAt.slice(0, 10);
  const time = run.runAt.slice(11, 16);
  const redditInputSummary = getRedditInputSummary(run.rawReddit);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-3">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm font-mono">{date}</span>
          <span className="text-gray-600 text-xs">{time} ET</span>
          <span className="text-blue-400 font-bold text-sm">{run.selectedTicker}</span>
          {run.skipped ? (
            <span className="bg-yellow-900/40 text-yellow-400 text-xs px-2 py-0.5 rounded-full">SKIPPED</span>
          ) : (
            <span className="bg-green-900/40 text-green-400 text-xs px-2 py-0.5 rounded-full">BOUGHT</span>
          )}
        </div>
        <span className="text-gray-600 text-xs">{expanded ? '▲ collapse' : '▼ expand'}</span>
      </div>

      {expanded && (
        <div className="mt-4 border-t border-gray-800 pt-4">
          {redditInputSummary && (
            <p className="text-gray-500 text-xs mb-2">{redditInputSummary}</p>
          )}
          {run.rawReddit && !Array.isArray(run.rawReddit) && run.rawReddit.fallbackReason && (
            <p className="text-yellow-500/80 text-xs mb-3">Fallback: {run.rawReddit.fallbackReason}</p>
          )}
          <p className="text-gray-400 text-sm leading-relaxed mb-4">&quot;{run.reasoning}&quot;</p>

          <p className="text-gray-600 text-xs uppercase tracking-wider mb-2">All picks</p>
          <div className="flex flex-col gap-2 mb-4">
            {run.topPicks.map((pick, i) => (
              <div key={pick.ticker} className="bg-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`font-bold text-sm ${i === 0 ? 'text-blue-400' : 'text-gray-300'}`}>
                    #{i + 1} {pick.ticker}
                  </span>
                  <span className="text-gray-500 text-xs">score {pick.score}</span>
                </div>
                <p className="text-gray-500 text-xs leading-relaxed">{pick.reasoning}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
