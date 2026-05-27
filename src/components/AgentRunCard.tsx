'use client';

import { useState } from 'react';

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
  skipped: number | null;
  skipReason: string | null;
}

export function AgentRunCard({ run }: { run: AgentRun }) {
  const [expanded, setExpanded] = useState(false);
  const date = run.runAt.slice(0, 10);
  const time = run.runAt.slice(11, 16);

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
          <p className="text-gray-400 text-sm leading-relaxed mb-4">"{run.reasoning}"</p>

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
