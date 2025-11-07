import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { db } from '@/lib/db';
import { trialSearchSession } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get search history for the user, ordered by most recent first
    const searchHistory = await db
      .select()
      .from(trialSearchSession)
      .where(eq(trialSearchSession.user_id, session.user.id))
      .orderBy(desc(trialSearchSession.created_at))
      .limit(50); // Limit to last 50 searches

    return NextResponse.json({ searches: searchHistory });
  } catch (error: any) {
    console.error('Failed to fetch search history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch search history' },
      { status: 500 }
    );
  }
}
