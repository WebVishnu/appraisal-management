import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Attendance from '@/lib/models/Attendance';
import Employee from '@/lib/models/Employee';
import { isLateCheckIn, getStartOfDay, getEndOfDay, hasCheckedInToday } from '@/lib/utils/attendance';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only employees can check in
    if (session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Only employees can check in' }, { status: 403 });
    }

    if (!session.user.employeeId) {
      return NextResponse.json({ error: 'Employee ID not found' }, { status: 400 });
    }

    await connectDB();

    // Verify employee exists and is active
    const employee = await Employee.findById(session.user.employeeId);
    if (!employee || !employee.isActive) {
      return NextResponse.json({ error: 'Employee not found or inactive' }, { status: 404 });
    }

    const now = new Date();
    const today = getStartOfDay(now);

    // Check if already checked in today
    const existingAttendance = await Attendance.findOne({
      employeeId: session.user.employeeId,
      date: {
        $gte: today,
        $lte: getEndOfDay(now),
      },
    });

    if (existingAttendance) {
      return NextResponse.json(
        { error: 'Already checked in today' },
        { status: 400 }
      );
    }

    // Check if late
    const late = isLateCheckIn(now);

    // Create attendance record
    const attendance = await Attendance.create({
      employeeId: session.user.employeeId,
      date: today,
      checkIn: now,
      isLate: late,
      status: 'present',
    });

    return NextResponse.json({
      message: 'Checked in successfully',
      attendance: {
        id: attendance._id,
        checkIn: attendance.checkIn,
        isLate: attendance.isLate,
        date: attendance.date,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

