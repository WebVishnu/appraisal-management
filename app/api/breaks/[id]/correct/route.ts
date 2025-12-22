/**
 * Correct Break Entry
 * POST /api/breaks/:id/correct
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../auth/[...nextauth]/route';
import { getUserSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import BreakSession from '@/lib/models/BreakSession';
import { breakService } from '@/lib/services/break-service';
import mongoose from 'mongoose';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getUserSession(req, auth);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only HR and Admin can correct breaks
    if (session.user.role !== 'hr' && session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectDB();

    const { id } = await params;
    const body = await req.json();
    const { reason, duration, isPaid, clearViolations } = body;

    if (!reason) {
      return NextResponse.json(
        { error: 'Correction reason is required' },
        { status: 400 }
      );
    }

    const breakSession = await BreakSession.findById(id);
    if (!breakSession) {
      return NextResponse.json(
        { error: 'Break session not found' },
        { status: 404 }
      );
    }

    // Update break session
    if (duration !== undefined) {
      breakSession.duration = duration;
      if (breakSession.startTime) {
        breakSession.endTime = new Date(
          breakSession.startTime.getTime() + duration * 60 * 1000
        );
      }
    }

    if (isPaid !== undefined) {
      breakSession.isPaid = isPaid;
    }

    if (clearViolations) {
      breakSession.violationFlags = {
        exceededDuration: false,
        exceededDailyLimit: false,
        policyViolation: false,
      };
    }

    breakSession.correctedBy = new mongoose.Types.ObjectId(session.user.id);
    breakSession.correctedAt = new Date();
    breakSession.correctionReason = reason;

    await breakSession.save();

    // Recalculate attendance totals
    await breakService.updateAttendanceBreakTotals(breakSession.attendanceId as any);

    return NextResponse.json({
      success: true,
      message: 'Break corrected successfully',
      data: breakSession,
    });
  } catch (error: any) {
    console.error('Error correcting break:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

