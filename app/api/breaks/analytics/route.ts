/**
 * Break Analytics Endpoint
 * GET /api/breaks/analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import { getUserSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import BreakSession from '@/lib/models/BreakSession';
import Attendance from '@/lib/models/Attendance';
import Employee from '@/lib/models/Employee';
import mongoose from 'mongoose';

export async function GET(req: NextRequest) {
  try {
    const session = await getUserSession(req, auth);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only HR and Admin can view analytics
    if (session.user.role !== 'hr' && session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const departmentId = searchParams.get('departmentId');

    // Get date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Get attendances in date range
    let attendanceQuery: any = {
      date: { $gte: start, $lte: end },
    };

    if (departmentId) {
      const employees = await Employee.find({ departmentId }).select('_id');
      const employeeIds = employees.map((e) => e._id);
      attendanceQuery.employeeId = { $in: employeeIds };
    }

    const attendances = await Attendance.find(attendanceQuery).select('_id employeeId date');

    const attendanceIds = attendances.map((a) => a._id);

    // Get all breaks
    const breaks = await BreakSession.find({
      attendanceId: { $in: attendanceIds },
      status: { $in: ['completed', 'auto_completed'] },
    })
      .populate('attendanceId', 'employeeId date')
      .populate('employeeId', 'name email departmentId');

    // Calculate analytics
    const totalBreaks = breaks.length;
    const totalBreakTime = breaks.reduce((sum, b) => sum + (b.duration || 0), 0);
    const avgBreakDuration = totalBreaks > 0 ? totalBreakTime / totalBreaks : 0;

    // Group by break type
    const breaksByType = breaks.reduce((acc: any, b: any) => {
      acc[b.breakType] = (acc[b.breakType] || 0) + 1;
      return acc;
    }, {});

    // Group by department
    const breaksByDepartment = breaks.reduce((acc: any, b: any) => {
      const deptId = b.employeeId?.departmentId?.toString() || 'unknown';
      if (!acc[deptId]) {
        acc[deptId] = { count: 0, totalTime: 0 };
      }
      acc[deptId].count += 1;
      acc[deptId].totalTime += b.duration || 0;
      return acc;
    }, {});

    // Violations
    const violations = breaks.filter((b) => b.violationFlags?.policyViolation);

    // Daily breakdown
    const dailyBreakdown = breaks.reduce((acc: any, b: any) => {
      const date = b.attendanceId?.date
        ? new Date(b.attendanceId.date).toISOString().split('T')[0]
        : 'unknown';
      if (!acc[date]) {
        acc[date] = { count: 0, totalTime: 0 };
      }
      acc[date].count += 1;
      acc[date].totalTime += b.duration || 0;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalBreaks,
          totalBreakTime,
          avgBreakDuration: Math.round(avgBreakDuration),
          violations: violations.length,
        },
        breaksByType,
        breaksByDepartment,
        dailyBreakdown,
        violations: violations.map((v: any) => ({
          id: v._id,
          employee: v.employeeId?.name || 'Unknown',
          breakType: v.breakType,
          duration: v.duration,
          violationFlags: v.violationFlags,
          date: v.attendanceId?.date,
        })),
      },
    });
  } catch (error: any) {
    console.error('Error fetching break analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

