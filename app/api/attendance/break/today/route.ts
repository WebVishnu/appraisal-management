/**
 * Get Today's Break Summary
 * GET /api/attendance/break/today
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../auth/[...nextauth]/route';
import { getUserSession } from '@/lib/auth-helper';
import { breakService } from '@/lib/services/break-service';

export async function GET(req: NextRequest) {
  try {
    const session = await getUserSession(req, auth);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.user.employeeId) {
      return NextResponse.json(
        { error: 'Employee ID not found' },
        { status: 400 }
      );
    }

    const summary = await breakService.getTodayBreakSummary(
      session.user.employeeId as any
    );

    if (!summary) {
      return NextResponse.json({
        success: true,
        data: {
          activeBreak: null,
          completedBreaks: [],
          totalBreakTime: 0,
          remainingBreaks: 0,
          remainingBreakTime: 0,
          policy: null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    console.error('Get break summary error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

