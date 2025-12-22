/**
 * Get Employee Break Records
 * GET /api/breaks/employee/:employeeId
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../auth/[...nextauth]/route';
import { getUserSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import BreakSession from '@/lib/models/BreakSession';
import Attendance from '@/lib/models/Attendance';
import mongoose from 'mongoose';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const session = await getUserSession(req, auth);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { employeeId } = await params;

    // HR, Admin, and Managers can view employee breaks
    // Employees can only view their own breaks
    const isHR = session.user.role === 'hr' || session.user.role === 'super_admin';
    const isManager = session.user.role === 'manager';
    const isEmployee = session.user.role === 'employee';

    if (!isHR && !isManager && !isEmployee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Employees can only view their own breaks
    if (isEmployee && session.user.employeeId !== employeeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Get attendance records for date range
    let attendanceQuery: any = {
      employeeId: new mongoose.Types.ObjectId(employeeId),
    };

    if (startDate && endDate) {
      attendanceQuery.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const attendances = await Attendance.find(attendanceQuery).select('_id date');

    const attendanceIds = attendances.map((a) => a._id);

    // Get all breaks for these attendances
    const breaks = await BreakSession.find({
      attendanceId: { $in: attendanceIds },
    })
      .sort({ startTime: -1 })
      .populate('attendanceId', 'date');

    // Group by date
    const breaksByDate = breaks.reduce((acc: any, breakItem: any) => {
      const date = breakItem.attendanceId?.date
        ? new Date(breakItem.attendanceId.date).toISOString().split('T')[0]
        : 'unknown';
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push({
        id: breakItem._id,
        breakType: breakItem.breakType,
        startTime: breakItem.startTime,
        endTime: breakItem.endTime,
        duration: breakItem.duration,
        status: breakItem.status,
        isPaid: breakItem.isPaid,
        violationFlags: breakItem.violationFlags,
      });
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      data: {
        breaks: breaksByDate,
        totalBreaks: breaks.length,
        totalBreakTime: breaks.reduce((sum, b) => sum + (b.duration || 0), 0),
      },
    });
  } catch (error: any) {
    console.error('Error fetching employee breaks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

