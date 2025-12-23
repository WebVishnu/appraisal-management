import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import { getUserSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import AttendanceOverride from '@/lib/models/AttendanceOverride';
import Employee from '@/lib/models/Employee';
import { z } from 'zod';

const createOverrideSchema = z.object({
  employeeId: z.string().optional(), // Optional for employees (uses their own ID)
  overrideType: z.enum(['temporary', 'permanent', 'emergency']),
  reason: z.string().min(1, 'Reason is required'),
  description: z.string().optional(),
  validFrom: z.string(),
  validTo: z.string(),
  policyId: z.string().optional(),
  allowRemoteAttendance: z.boolean().default(true),
});

const updateOverrideSchema = z.object({
  status: z.enum(['approved', 'rejected']).optional(),
  rejectionReason: z.string().optional(),
});

// GET - List attendance overrides
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');
    const overrideType = searchParams.get('overrideType');

    let query: any = {};

    // HR/Admin can see all, employees see only their own
    if (session.user.role === 'employee') {
      const employee = await Employee.findOne({ email: session.user.email });
      if (employee) {
        query.employeeId = employee._id;
      } else {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }
    } else if (employeeId) {
      query.employeeId = employeeId;
    }

    if (status) {
      query.status = status;
    }

    if (overrideType) {
      query.overrideType = overrideType;
    }

    const overrides = await AttendanceOverride.find(query)
      .populate('employeeId', 'name email employeeId')
      .populate('requestedBy', 'email')
      .populate('approvedBy', 'email')
      .populate('rejectedBy', 'email')
      .populate('policyId', 'name')
      .sort({ createdAt: -1 })
      .limit(200);

    return NextResponse.json(overrides);
  } catch (error) {
    console.error('Error fetching overrides:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Request/create attendance override
export async function POST(req: NextRequest) {
  try {
    const session = await getUserSession(req, auth);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createOverrideSchema.parse(body);

    await connectDB();

    // Determine employee ID
    let employeeId;
    if (validatedData.employeeId && (session.user.role === 'hr' || session.user.role === 'super_admin')) {
      // HR/Admin can create overrides for any employee
      employeeId = validatedData.employeeId;
    } else {
      // Employees can only create for themselves
      const employee = await Employee.findOne({ email: session.user.email });
      if (!employee) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }
      employeeId = employee._id.toString();
    }

    // Verify employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Convert dates
    const validFrom = new Date(validatedData.validFrom);
    const validTo = new Date(validatedData.validTo);

    if (validTo <= validFrom) {
      return NextResponse.json(
        { error: 'Valid to date must be after valid from date' },
        { status: 400 }
      );
    }

    // Create override
    const mongoose = (await import('mongoose')).default;
    const override = await AttendanceOverride.create({
      employeeId: new mongoose.Types.ObjectId(employeeId),
      overrideType: validatedData.overrideType,
      reason: validatedData.reason,
      description: validatedData.description,
      validFrom,
      validTo,
      requestedBy: session.user.id,
      policyId: validatedData.policyId
        ? new mongoose.Types.ObjectId(validatedData.policyId)
        : undefined,
      allowRemoteAttendance: validatedData.allowRemoteAttendance,
      status: 'pending',
    });

    const populated = await AttendanceOverride.findById(override._id)
      .populate('employeeId', 'name email employeeId')
      .populate('requestedBy', 'email')
      .populate('policyId', 'name');

    return NextResponse.json(populated, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error creating override:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Approve/reject override (HR/Admin only)
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Override ID is required' }, { status: 400 });
    }

    const validatedData = updateOverrideSchema.parse(updateData);

    await connectDB();

    const override = await AttendanceOverride.findById(id);
    if (!override) {
      return NextResponse.json({ error: 'Override not found' }, { status: 404 });
    }

    if (override.status !== 'pending') {
      return NextResponse.json(
        { error: 'Override is not pending approval' },
        { status: 400 }
      );
    }

    // Update override
    if (validatedData.status === 'approved') {
      override.status = 'approved';
      override.approvedBy = session.user.id;
      override.approvedAt = new Date();
    } else if (validatedData.status === 'rejected') {
      override.status = 'rejected';
      override.rejectedBy = session.user.id;
      override.rejectedAt = new Date();
      override.rejectionReason = validatedData.rejectionReason || 'No reason provided';
    }

    await override.save();

    const populated = await AttendanceOverride.findById(override._id)
      .populate('employeeId', 'name email employeeId')
      .populate('requestedBy', 'email')
      .populate('approvedBy', 'email')
      .populate('rejectedBy', 'email')
      .populate('policyId', 'name');

    return NextResponse.json(populated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error updating override:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

