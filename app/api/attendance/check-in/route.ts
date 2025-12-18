import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Attendance from '@/lib/models/Attendance';
import Employee from '@/lib/models/Employee';
import { getStartOfDay, getEndOfDay } from '@/lib/utils/attendance';
import { getAssignedShift, isLateCheckIn } from '@/lib/utils/shift';

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
    const employee = await Employee.findOne({ email: session.user.email });
    if (!employee || !employee.isActive) {
      return NextResponse.json({ error: 'Employee not found or inactive' }, { status: 404 });
    }

    const now = new Date();
    const today = getStartOfDay(now);

    // Check if already checked in today
    const existingAttendance = await Attendance.findOne({
      employeeId: employee._id,
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

    // Get assigned shift for today
    const assignedShift = await getAssignedShift(employee._id, today);
    let late = false;
    let shiftId = null;

    if (assignedShift && assignedShift.shift) {
      shiftId = assignedShift.shiftId;
      // Check if late based on shift rules
      late = isLateCheckIn(now, assignedShift.shift.startTime, assignedShift.shift.gracePeriod);
    } else {
      // Fallback to default check if no shift assigned
      const defaultStartTime = '09:00';
      const defaultGracePeriod = 15;
      late = isLateCheckIn(now, defaultStartTime, defaultGracePeriod);
    }

    // Create attendance record
    const attendance = await Attendance.create({
      employeeId: employee._id,
      date: today,
      checkIn: now,
      isLate: late,
      status: 'present',
      shiftId: shiftId,
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

