import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Attendance from '@/lib/models/Attendance';
import Employee from '@/lib/models/Employee';
import {
  calculateWorkingHours,
  isEarlyCheckOut,
  determineAttendanceStatus,
  getStartOfDay,
  getEndOfDay,
} from '@/lib/utils/attendance';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only employees can check out
    if (session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Only employees can check out' }, { status: 403 });
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

    // Find today's attendance record
    const attendance = await Attendance.findOne({
      employeeId: session.user.employeeId,
      date: {
        $gte: today,
        $lte: getEndOfDay(now),
      },
    });

    if (!attendance) {
      return NextResponse.json(
        { error: 'No check-in found for today' },
        { status: 400 }
      );
    }

    if (attendance.checkOut) {
      return NextResponse.json(
        { error: 'Already checked out today' },
        { status: 400 }
      );
    }

    // Calculate working hours
    const workingHours = calculateWorkingHours(attendance.checkIn, now);
    const earlyExit = isEarlyCheckOut(now, attendance.checkIn);
    const status = determineAttendanceStatus(attendance.checkIn, now, workingHours);

    // Update attendance record
    attendance.checkOut = now;
    attendance.workingHours = workingHours;
    attendance.isEarlyExit = earlyExit;
    attendance.status = status;
    await attendance.save();

    return NextResponse.json({
      message: 'Checked out successfully',
      attendance: {
        id: attendance._id,
        checkIn: attendance.checkIn,
        checkOut: attendance.checkOut,
        workingHours,
        isEarlyExit: attendance.isEarlyExit,
        status: attendance.status,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

