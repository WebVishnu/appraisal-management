/**
 * End Break Endpoint
 * POST /api/attendance/break/end
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../auth/[...nextauth]/route';
import { getUserSession } from '@/lib/auth-helper';
import { breakService } from '@/lib/services/break-service';

export async function POST(req: NextRequest) {
  try {
    const session = await getUserSession(req, auth);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only employees can end breaks
    if (session.user.role !== 'employee') {
      return NextResponse.json(
        { error: 'Only employees can end breaks' },
        { status: 403 }
      );
    }

    if (!session.user.employeeId) {
      return NextResponse.json(
        { error: 'Employee ID not found' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { breakSessionId } = body;

    const result = await breakService.endBreak(
      session.user.employeeId as any,
      breakSessionId ? (breakSessionId as any) : undefined
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          code: 'BREAK_END_FAILED',
        },
        { status: 400 }
      );
    }

    // Get updated break summary
    const summary = await breakService.getTodayBreakSummary(
      session.user.employeeId as any
    );

    return NextResponse.json({
      success: true,
      data: {
        breakSession: result.breakSession,
        totalBreakTime: summary?.totalBreakTime,
        remainingBreakTime: summary?.remainingBreakTime,
      },
    });
  } catch (error: any) {
    console.error('End break error:', error);
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

