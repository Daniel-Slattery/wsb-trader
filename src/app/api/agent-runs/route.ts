import { NextResponse } from 'next/server';
import { db, agentRuns } from '@/db';

export async function GET() {
  const runs = db
    .select()
    .from(agentRuns)
    .orderBy(agentRuns.runAt)
    .all()
    .reverse();

  return NextResponse.json(
    runs.map(r => ({
      ...r,
      topPicks: JSON.parse(r.topPicks),
      rawReddit: r.rawReddit ? JSON.parse(r.rawReddit) : null,
      rawNews: r.rawNews ? JSON.parse(r.rawNews) : null,
    }))
  );
}
