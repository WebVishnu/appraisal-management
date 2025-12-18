import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import ShiftSwap from '@/lib/models/ShiftSwap';
import Roster from '@/lib/models/Roster';
import Employee from '@/lib/models/Employee';
import { z } from 'zod';
import { getAssignedShift } from '@/lib/utils/shift';

const createSwapSchema = z.object({
  requesteeId: z.string(),
  requesterDate: z.string(),
  requesteeDate: z.string(),
  reason: z.string().min(1),
});

// GET - Get shift swap requests
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const employeeId = searchParams.get('employeeId');

    const query: any = {};

    // Role-based filtering
    if (session.user.role === 'employee') {
      const employee = await Employee.findOne({ email: session.user.email });
      if (employee) {
        query.$or = [
          { requesterId: employee._id },
          { requesteeId: employee._id },
        ];
      }
    } else if (session.user.role === 'manager') {
      const manager = await Employee.findOne({ email: session.user.email });
      if (manager) {
        const teamEmployees = await Employee.find({ managerId: manager._id, isActive: true }).select('_id');
        query.$or = [
          { requesterId: { $in: teamEmployees.map((e) => e._id) } },
          { requesteeId: { $in: teamEmployees.map((e) => e._id) } },
        ];
      }
    }

    if (status) query.status = status;
    if (employeeId) {
      query.$or = [
        { requesterId: employeeId },
        { requesteeId: employeeId },
      ];
    }

    const swaps = await ShiftSwap.find(query)
      .populate('requesterId', 'name employeeId email')
      .populate('requesteeId', 'name employeeId email')
      .populate('requesterShiftId')
      .populate('requesteeShiftId')
      .populate('reviewedBy', 'email name')
      .sort({ createdAt: -1 });

    return NextResponse.json(swaps);
  } catch (error) {
    console.error('Error fetching shift swaps:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create shift swap request
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const employee = await Employee.findOne({ email: session.user.email });
    if (!employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
    }

    const body = await req.json();
    const validatedData = createSwapSchema.parse(body);

    const requesterDate = new Date(validatedData.requesterDate);
    const requesteeDate = new Date(validatedData.requesteeDate);

    // Get assigned shifts for both dates
    const requesterShift = await getAssignedShift(employee._id, requesterDate);
    const requesteeShift = await getAssignedShift(validatedData.requesteeId, requesteeDate);

    if (!requesterShift) {
      return NextResponse.json({ error: 'No shift assigned for requester date' }, { status: 400 });
    }

    if (!requesteeShift) {
      return NextResponse.json({ error: 'No shift assigned for requestee date' }, { status: 400 });
    }

    // Verify requestee exists
    const requestee = await Employee.findById(validatedData.requesteeId);
    if (!requestee) {
      return NextResponse.json({ error: 'Requestee not found' }, { status: 404 });
    }

    // Check if requestee has shift on requester date
    const requesteeShiftOnRequesterDate = await getAssignedShift(validatedData.requesteeId, requesterDate);
    if (!requesteeShiftOnRequesterDate) {
      return NextResponse.json(
        { error: 'Requestee does not have a shift on the requested date' },
        { status: 400 }
      );
    }

    // Check if requester has shift on requestee date
    const requesterShiftOnRequesteeDate = await getAssignedShift(employee._id, requesteeDate);
    if (!requesterShiftOnRequesteeDate) {
      return NextResponse.json(
        { error: 'You do not have a shift on the requestee date' },
        { status: 400 }
      );
    }

    // Check for existing pending swap
    const existingSwap = await ShiftSwap.findOne({
      requesterId: employee._id,
      requesteeId: validatedData.requesteeId,
      requesterDate: requesterDate,
      requesteeDate: requesteeDate,
      status: 'pending',
    });

    if (existingSwap) {
      return NextResponse.json({ error: 'Swap request already exists' }, { status: 400 });
    }

    const swap = new ShiftSwap({
      requesterId: employee._id,
      requesteeId: validatedData.requesteeId,
      requesterDate: requesterDate,
      requesteeDate: requesteeDate,
      requesterShiftId: requesterShift.shiftId,
      requesteeShiftId: requesteeShift.shiftId,
      reason: validatedData.reason,
      status: 'pending',
    });

    await swap.save();
    await swap.populate('requesterId', 'name employeeId email');
    await swap.populate('requesteeId', 'name employeeId email');
    await swap.populate('requesterShiftId');
    await swap.populate('requesteeShiftId');

    return NextResponse.json(swap, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error creating swap request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

