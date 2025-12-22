/**
 * Start Break Endpoint
 * POST /api/attendance/break/start
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../auth/[...nextauth]/route';
import { getUserSession } from '@/lib/auth-helper';
import { breakService } from '@/lib/services/break-service';
import { getDeviceInfo } from '@/lib/utils/device-info';

export async function POST(req: NextRequest) {
  try {
    const session = await getUserSession(req, auth);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only employees can start breaks
    if (session.user.role !== 'employee') {
      return NextResponse.json(
        { error: 'Only employees can take breaks' },
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
    const { breakType, notes } = body;

    if (!breakType) {
      return NextResponse.json(
        { error: 'Break type is required' },
        { status: 400 }
      );
    }

    const result = await breakService.startBreak(
      session.user.employeeId as any,
      breakType,
      notes
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          code: 'BREAK_START_FAILED',
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
        remainingBreaks: summary?.remainingBreaks,
        remainingBreakTime: summary?.remainingBreakTime,
      },
    });
  } catch (error: any) {
    console.error('Start break error:', error);
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

