import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../auth/[...nextauth]/route';
import { getUserSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import Attendance from '@/lib/models/Attendance';
import Employee from '@/lib/models/Employee';
import { getStartOfDay, getEndOfDay } from '@/lib/utils/attendance';
import mongoose from 'mongoose';

// GET - Get attendance records based on role
export async function GET(req: NextRequest) {
  try {
    const session = await getUserSession(req, auth);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const role = session.user.role;

    let query: any = {};

    // Role-based access control
    if (role === 'employee') {
      // Employees can only see their own attendance
      if (!session.user.employeeId) {
        return NextResponse.json({ error: 'Employee ID not found' }, { status: 400 });
      }
      query.employeeId = session.user.employeeId;
    } else if (role === 'manager') {
      // Managers can see their team's attendance
      if (!session.user.employeeId) {
        return NextResponse.json({ error: 'Manager ID not found' }, { status: 400 });
      }
      
      // Get all employees under this manager
      const teamEmployees = await Employee.find({
        managerId: session.user.employeeId,
        isActive: true,
      }).select('_id');
      
      const teamEmployeeIds = teamEmployees.map((emp) => emp._id);
      query.employeeId = { $in: teamEmployeeIds };
    } else if (role === 'hr' || role === 'super_admin') {
      // HR/Admin can see all attendance
      if (employeeId && employeeId !== 'all') {
        if (mongoose.Types.ObjectId.isValid(employeeId)) {
          query.employeeId = new mongoose.Types.ObjectId(employeeId);
        }
      }
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Date range filter
    if (startDate && endDate) {
      query.date = {
        $gte: getStartOfDay(new Date(startDate)),
        $lte: getEndOfDay(new Date(endDate)),
      };
    } else if (startDate) {
      query.date = {
        $gte: getStartOfDay(new Date(startDate)),
      };
    } else if (endDate) {
      query.date = {
        $lte: getEndOfDay(new Date(endDate)),
      };
    }

    const attendance = await Attendance.find(query)
      .populate('employeeId', 'name employeeId email')
      .populate('correctedBy', 'email')
      .sort({ date: -1, checkIn: -1 })
      .limit(1000); // Limit to prevent large queries

    return NextResponse.json(attendance);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Manual correction by HR/Admin
export async function PUT(req: NextRequest) {
  try {
    const session = await getUserSession(req, auth);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only HR and Admin can make manual corrections
    if (session.user.role !== 'hr' && session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { attendanceId, checkIn, checkOut, notes, status } = body;

    if (!attendanceId) {
      return NextResponse.json({ error: 'Attendance ID is required' }, { status: 400 });
    }

    await connectDB();

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
    }

    // Update fields
    if (checkIn) {
      attendance.checkIn = new Date(checkIn);
    }
    if (checkOut) {
      attendance.checkOut = new Date(checkOut);
    }
    if (notes !== undefined) {
      attendance.notes = notes;
    }
    if (status) {
      attendance.status = status;
    }

    // Recalculate working hours if both check-in and check-out are present
    if (attendance.checkIn && attendance.checkOut) {
      const { calculateWorkingHours, determineAttendanceStatus, isLateCheckIn, isEarlyCheckOut } =
        await import('@/lib/utils/attendance');
      
      attendance.workingHours = calculateWorkingHours(attendance.checkIn, attendance.checkOut);
      attendance.isLate = isLateCheckIn(attendance.checkIn);
      attendance.isEarlyExit = isEarlyCheckOut(attendance.checkOut, attendance.checkIn);
      attendance.status = determineAttendanceStatus(
        attendance.checkIn,
        attendance.checkOut,
        attendance.workingHours
      );
    }

    // Mark as corrected
    attendance.correctedBy = new mongoose.Types.ObjectId(session.user.id);
    attendance.correctedAt = new Date();

    await attendance.save();

    return NextResponse.json({
      message: 'Attendance record updated successfully',
      attendance,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create manual attendance record (HR/Admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await getUserSession(req, auth);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only HR and Admin can create manual records
    if (session.user.role !== 'hr' && session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { employeeId, date, checkIn, checkOut, notes, status } = body;

    if (!employeeId || !date || !checkIn) {
      return NextResponse.json(
        { error: 'Employee ID, date, and check-in time are required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Verify employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee || !employee.isActive) {
      return NextResponse.json({ error: 'Employee not found or inactive' }, { status: 404 });
    }

    const attendanceDate = getStartOfDay(new Date(date));

    // Check if attendance already exists for this date
    const existing = await Attendance.findOne({
      employeeId,
      date: {
        $gte: attendanceDate,
        $lte: getEndOfDay(new Date(date)),
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Attendance record already exists for this date' },
        { status: 400 }
      );
    }

    const checkInTime = new Date(checkIn);
    let workingHours = null;
    let isLate = false;
    let isEarlyExit = false;
    let finalStatus = status || 'present';

    if (checkOut) {
      const checkOutTime = new Date(checkOut);
      const { calculateWorkingHours, determineAttendanceStatus, isLateCheckIn, isEarlyCheckOut } =
        await import('@/lib/utils/attendance');
      
      workingHours = calculateWorkingHours(checkInTime, checkOutTime);
      isLate = isLateCheckIn(checkInTime);
      isEarlyExit = isEarlyCheckOut(checkOutTime, checkInTime);
      finalStatus = determineAttendanceStatus(checkInTime, checkOutTime, workingHours);
    } else {
      isLate = (await import('@/lib/utils/attendance')).isLateCheckIn(checkInTime);
      finalStatus = 'missed_checkout';
    }

    const attendance = await Attendance.create({
      employeeId,
      date: attendanceDate,
      checkIn: checkInTime,
      checkOut: checkOut ? new Date(checkOut) : null,
      workingHours,
      isLate,
      isEarlyExit,
      status: finalStatus,
      notes,
      correctedBy: new mongoose.Types.ObjectId(session.user.id),
      correctedAt: new Date(),
    });

    return NextResponse.json({
      message: 'Attendance record created successfully',
      attendance,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

