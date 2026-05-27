import { NextResponse } from 'next/server';
import { db, positions } from '@/db';
import { eq } from 'drizzle-orm';

export async function GET() {
  const closed = db
    .select()
    .from(positions)
    .where(eq(positions.status, 'closed'))
    .orderBy(positions.sellDate)
    .all()
    .reverse();

  return NextResponse.json(closed);
}
