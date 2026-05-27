import { NextResponse } from 'next/server';
import { db, equitySnapshots } from '@/db';

export async function GET() {
  const snapshots = db
    .select()
    .from(equitySnapshots)
    .orderBy(equitySnapshots.snapshotAt)
    .all();

  return NextResponse.json(snapshots);
}
