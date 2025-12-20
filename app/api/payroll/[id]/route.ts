import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Payroll from '@/lib/models/Payroll';
import PayrollAudit from '@/lib/models/PayrollAudit';
import { z } from 'zod';
import mongoose from 'mongoose';

const lockPayrollSchema = z.object({
  action: z.enum(['lock', 'unlock']),
});

// GET - Get single payroll record
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    const payroll = await Payroll.findById(id)
      .populate('employeeId', 'name employeeId email role')
      .populate('salaryStructureId')
      .populate('processedBy', 'email name')
      .populate('lockedBy', 'email name');

    if (!payroll) {
      return NextResponse.json({ error: 'Payroll not found' }, { status: 404 });
    }

    // Role-based access control
    if (session.user.role === 'employee') {
      const employee = await (await import('@/lib/models/Employee')).default.findOne({
        email: session.user.email,
      });
      if (!employee || payroll.employeeId.toString() !== employee._id.toString()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    return NextResponse.json(payroll);
  } catch (error) {
    console.error('Error fetching payroll:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Lock or unlock payroll
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    const payroll = await Payroll.findById(id);
    if (!payroll) {
      return NextResponse.json({ error: 'Payroll not found' }, { status: 404 });
    }

    const body = await req.json();
    const validatedData = lockPayrollSchema.parse(body);

    // Get User ID
    let actionByUserId: mongoose.Types.ObjectId;
    if (session.user.id) {
      actionByUserId = new mongoose.Types.ObjectId(session.user.id);
    } else {
      const { default: User } = await import('@/lib/models/User');
      const user = await User.findOne({ email: session.user.email });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      actionByUserId = user._id;
    }

    if (validatedData.action === 'lock') {
      if (payroll.status === 'locked') {
        return NextResponse.json({ error: 'Payroll is already locked' }, { status: 400 });
      }
      payroll.status = 'locked';
      payroll.lockedAt = new Date();
      payroll.lockedBy = actionByUserId;

      await PayrollAudit.create({
        action: 'payroll_locked',
        payrollId: payroll._id,
        employeeId: payroll.employeeId,
        description: 'Payroll locked',
        performedBy: actionByUserId,
        performedAt: new Date(),
      });
    } else {
      if (payroll.status !== 'locked') {
        return NextResponse.json({ error: 'Payroll is not locked' }, { status: 400 });
      }
      payroll.status = 'processed';
      payroll.lockedAt = undefined;
      payroll.lockedBy = undefined;

      await PayrollAudit.create({
        action: 'payroll_unlocked',
        payrollId: payroll._id,
        employeeId: payroll.employeeId,
        description: 'Payroll unlocked',
        performedBy: actionByUserId,
        performedAt: new Date(),
      });
    }

    await payroll.save();

    return NextResponse.json(payroll);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error updating payroll:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

