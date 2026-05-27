'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface EquitySnapshot {
  snapshotAt: string;
  totalEquity: number;
}

interface EquityChartProps {
  data: EquitySnapshot[];
  startingEquity: number;
}

export function EquityChart({ data, startingEquity }: EquityChartProps) {
  const formatted = data.map(d => ({
    date: d.snapshotAt.slice(0, 10),
    equity: parseFloat(d.totalEquity.toFixed(2)),
  }));

  if (formatted.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 h-full flex flex-col">
        <p className="text-gray-400 text-sm font-semibold mb-3">Equity Growth</p>
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
          No data yet — first run pending
        </div>
      </div>
    );
  }

  // Y-axis: floor at starting equity (or lower if equity has dropped below it)
  const yMin = Math.min(...formatted.map(d => d.equity), startingEquity);
  const yDomain: [(v: number) => number, string] = [() => yMin - startingEquity * 0.01, 'auto'];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 h-full flex flex-col">
      <p className="text-gray-400 text-sm font-semibold mb-3">Equity Growth</p>
      <div className="flex-1 min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${v.toLocaleString()}`} width={65} domain={yDomain} />
          <Tooltip
            contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#9ca3af' }}
            formatter={(value) => {
              const num = typeof value === 'number' ? value : parseFloat(String(value ?? 0));
              return [`$${num.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 'Equity'] as [string, string];
            }}
          />
          <Line type="monotone" dataKey="equity" stroke="#3b82f6" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
