/**
 * Get Employee Current Status
 * GET /api/employees/:id/status
 * Returns today's attendance and break status for a specific employee
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../auth/[...nextauth]/route';
import { getUserSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import Attendance from '@/lib/models/Attendance';
import BreakSession from '@/lib/models/BreakSession';
import Employee from '@/lib/models/Employee';
import { getStartOfDay, getEndOfDay } from '@/lib/utils/attendance';
import mongoose from 'mongoose';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getUserSession(req, auth);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions: HR, Admin, Managers can view any employee status
    // Employees can only view their own status
    const isHR = session.user.role === 'hr' || session.user.role === 'super_admin';
    const isManager = session.user.role === 'manager';
    const isEmployee = session.user.role === 'employee';

    if (!isHR && !isManager && !isEmployee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Employees can only view their own status
    if (isEmployee && session.user.employeeId !== id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Managers can only view their team members
    if (isManager && session.user.employeeId !== id) {
      const managerEmployee = await Employee.findOne({
        email: session.user.email,
      });
      
      if (managerEmployee) {
        const targetEmployee = await Employee.findById(id);
        if (!targetEmployee || targetEmployee.managerId?.toString() !== managerEmployee._id.toString()) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
      }
    }

    await connectDB();

    const today = getStartOfDay(new Date());
    const todayEnd = getEndOfDay(new Date());

    // Get today's attendance
    const attendance = await Attendance.findOne({
      employeeId: new mongoose.Types.ObjectId(id),
      date: {
        $gte: today,
        $lte: todayEnd,
      },
    });

    let breakSummary = null;
    let activeBreak = null;

    if (attendance) {
      // Get active break if any
      activeBreak = await BreakSession.findOne({
        attendanceId: attendance._id,
        status: 'active',
      });

      // Get today's completed breaks
      const completedBreaks = await BreakSession.find({
        attendanceId: attendance._id,
        status: { $in: ['completed', 'auto_completed'] },
      });

      const totalBreakTime = completedBreaks.reduce((sum, b) => sum + (b.duration || 0), 0);

      breakSummary = {
        activeBreak: activeBreak
          ? {
              id: activeBreak._id.toString(),
              breakType: activeBreak.breakType,
              startTime: activeBreak.startTime.toISOString(),
              duration: activeBreak.duration || Math.floor((Date.now() - activeBreak.startTime.getTime()) / (1000 * 60)),
            }
          : null,
        completedBreaks: completedBreaks.length,
        totalBreakTime,
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        attendance: attendance
          ? {
              id: attendance._id.toString(),
              checkIn: attendance.checkIn?.toISOString() || null,
              checkOut: attendance.checkOut?.toISOString() || null,
              workingHours: attendance.workingHours || null,
              isLate: attendance.isLate || false,
              isEarlyExit: attendance.isEarlyExit || false,
              status: attendance.status || 'present',
            }
          : null,
        breakSummary,
      },
    });
  } catch (error: any) {
    console.error('Error fetching employee status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

