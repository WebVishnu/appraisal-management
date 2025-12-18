import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import LeaveBalance from '@/lib/models/LeaveBalance';
import Employee from '@/lib/models/Employee';
import { getLeaveBalance } from '@/lib/utils/leave';
import mongoose from 'mongoose';

// GET - Get leave balance
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    let targetEmployeeId: string;

    // Role-based access
    if (session.user.role === 'employee') {
      // Employees can only see their own balance
      if (!session.user.employeeId) {
        return NextResponse.json({ error: 'Employee ID not found' }, { status: 400 });
      }
      // Get employee's MongoDB _id from their employeeId string
      const employee = await Employee.findOne({ employeeId: session.user.employeeId });
      if (!employee) {
        return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
      }
      targetEmployeeId = employee._id.toString();
    } else if (session.user.role === 'manager') {
      // Managers can see their team's balance
      if (employeeId) {
        // Check if employee is in manager's team
        // employeeId might be MongoDB _id or employee's employeeId string
        let employee;
        if (mongoose.Types.ObjectId.isValid(employeeId)) {
          employee = await Employee.findById(employeeId);
        } else {
          employee = await Employee.findOne({ employeeId: employeeId });
        }
        
        // Get manager's employee record to compare managerId
        const managerEmployee = await Employee.findOne({ employeeId: session.user.employeeId });
        if (!employee || !managerEmployee || employee.managerId?.toString() !== managerEmployee._id.toString()) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
        targetEmployeeId = employee._id.toString();
      } else {
        // Manager viewing their own balance
        const managerEmployee = await Employee.findOne({ employeeId: session.user.employeeId });
        if (!managerEmployee) {
          return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
        }
        targetEmployeeId = managerEmployee._id.toString();
      }
    } else if (session.user.role === 'hr' || session.user.role === 'super_admin') {
      // HR/Admin can see any employee's balance
      if (!employeeId) {
        return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
      }
      targetEmployeeId = employeeId;
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const balance = await getLeaveBalance(targetEmployeeId, year);

    return NextResponse.json({ balance, year });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update leave balance (HR/Admin only)
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only HR and Admin can update balances
    if (session.user.role !== 'hr' && session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { employeeId, leaveType, totalDays, notes, year } = body;

    if (!employeeId || !leaveType || totalDays === undefined) {
      return NextResponse.json(
        { error: 'Employee ID, leave type, and total days are required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Verify employee exists and get their MongoDB _id
    // employeeId might be the MongoDB _id or the employee's employeeId string
    let employeeObjectId: mongoose.Types.ObjectId;
    
    if (mongoose.Types.ObjectId.isValid(employeeId)) {
      // It's a valid MongoDB ObjectId
      const employee = await Employee.findById(employeeId);
      if (!employee || !employee.isActive) {
        return NextResponse.json({ error: 'Employee not found or inactive' }, { status: 404 });
      }
      employeeObjectId = employee._id;
    } else {
      // It's the employee's employeeId string (like "EMP002")
      const employee = await Employee.findOne({ employeeId: employeeId });
      if (!employee || !employee.isActive) {
        return NextResponse.json({ error: 'Employee not found or inactive' }, { status: 404 });
      }
      employeeObjectId = employee._id;
    }

    const balanceYear = year || new Date().getFullYear();

    // Update or create balance - use the MongoDB _id
    const balance = await LeaveBalance.findOneAndUpdate(
      { employeeId: employeeObjectId, leaveType, year: balanceYear },
      {
        totalDays,
        lastUpdatedBy: session.user.id,
        lastUpdatedAt: new Date(),
        notes: notes || null,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    // Recalculate available days
    balance.availableDays = balance.totalDays - balance.usedDays;
    await balance.save();

    return NextResponse.json({
      message: 'Leave balance updated successfully',
      balance,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

