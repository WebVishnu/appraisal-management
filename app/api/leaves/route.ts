import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Leave from '@/lib/models/Leave';
import Employee from '@/lib/models/Employee';
import {
  calculateWorkingDays,
  hasOverlappingLeaves,
  hasSufficientBalance,
  validateLeaveDates,
  requiresBalance,
  updateLeaveBalance,
} from '@/lib/utils/leave';
import mongoose from 'mongoose';

// GET - Get leaves based on role
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const role = session.user.role;

    let query: any = {};

    // Role-based access control
    if (role === 'employee') {
      // Employees can only see their own leaves
      if (!session.user.email) {
        return NextResponse.json({ error: 'Employee email not found' }, { status: 400 });
      }
      // Get employee's MongoDB _id from their email
      const employee = await Employee.findOne({ email: session.user.email });
      if (!employee || !employee.isActive) {
        return NextResponse.json({ error: 'Employee not found or inactive' }, { status: 404 });
      }
      query.employeeId = employee._id;
    } else if (role === 'manager') {
      // Managers can see their team's leaves
      if (!session.user.email) {
        return NextResponse.json({ error: 'Manager email not found' }, { status: 400 });
      }

      // Get manager's MongoDB _id from their email
      const managerEmployee = await Employee.findOne({ email: session.user.email });
      if (!managerEmployee) {
        return NextResponse.json({ error: 'Manager record not found' }, { status: 404 });
      }

      const teamEmployees = await Employee.find({
        managerId: managerEmployee._id,
        isActive: true,
      }).select('_id');

      const teamEmployeeIds = teamEmployees.map((emp) => emp._id);
      query.employeeId = { $in: teamEmployeeIds };
    } else if (role === 'hr' || role === 'super_admin') {
      // HR/Admin can see all leaves
      if (employeeId && employeeId !== 'all') {
        if (mongoose.Types.ObjectId.isValid(employeeId)) {
          query.employeeId = new mongoose.Types.ObjectId(employeeId);
        }
      }
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Date range filter
    if (startDate && endDate) {
      query.$or = [
        {
          startDate: { $lte: new Date(endDate) },
          endDate: { $gte: new Date(startDate) },
        },
      ];
    }

    const leaves = await Leave.find(query)
      .populate('employeeId', 'name employeeId email')
      .populate('appliedBy', 'email')
      .populate('approvedBy', 'email')
      .sort({ startDate: -1, createdAt: -1 })
      .limit(1000);

    return NextResponse.json(leaves);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Apply for leave (Employee only)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only employees can apply for leave
    if (session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Only employees can apply for leave' }, { status: 403 });
    }

    if (!session.user.email) {
      return NextResponse.json({ error: 'Employee email not found' }, { status: 400 });
    }

    const body = await req.json();
    const { leaveType, startDate, endDate, reason } = body;

    if (!leaveType || !startDate || !endDate || !reason) {
      return NextResponse.json(
        { error: 'Leave type, start date, end date, and reason are required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Verify employee exists and is active - get MongoDB _id from email
    const employee = await Employee.findOne({ email: session.user.email });
    if (!employee || !employee.isActive) {
      return NextResponse.json({ error: 'Employee not found or inactive' }, { status: 404 });
    }

    const employeeMongoId = employee._id.toString();

    // Validate dates
    const dateValidation = validateLeaveDates(new Date(startDate), new Date(endDate));
    if (!dateValidation.valid) {
      return NextResponse.json({ error: dateValidation.error }, { status: 400 });
    }

    // Check for overlapping leaves - use MongoDB _id
    const hasOverlap = await hasOverlappingLeaves(
      employeeMongoId,
      new Date(startDate),
      new Date(endDate)
    );
    if (hasOverlap) {
      return NextResponse.json(
        { error: 'Leave dates overlap with an existing approved or pending leave' },
        { status: 400 }
      );
    }

    // Calculate number of days
    const numberOfDays = calculateWorkingDays(new Date(startDate), new Date(endDate));

    // Check balance if required - use employee's MongoDB _id
    if (requiresBalance(leaveType)) {
      const balanceCheck = await hasSufficientBalance(
        employeeMongoId,
        leaveType,
        numberOfDays
      );
      if (!balanceCheck.hasBalance) {
        return NextResponse.json(
          {
            error: `Insufficient leave balance. Available: ${balanceCheck.available} days, Required: ${numberOfDays} days`,
          },
          { status: 400 }
        );
      }
    }

    // Create leave application - use MongoDB _id
    const leave = await Leave.create({
      employeeId: employeeMongoId,
      leaveType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      numberOfDays,
      reason,
      status: 'pending',
      appliedBy: session.user.id,
    });

    const populatedLeave = await Leave.findById(leave._id)
      .populate('employeeId', 'name employeeId email')
      .populate('appliedBy', 'email');

    return NextResponse.json({
      message: 'Leave application submitted successfully',
      leave: populatedLeave,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

