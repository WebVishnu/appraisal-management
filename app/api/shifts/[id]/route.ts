import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Shift from '@/lib/models/Shift';
import ShiftAssignment from '@/lib/models/ShiftAssignment';
import { z } from 'zod';
import { validateShiftTimes } from '@/lib/utils/shift';

const updateShiftSchema = z.object({
  name: z.string().min(1).optional(),
  shiftType: z.enum(['fixed', 'rotational', 'flexible']).optional(),
  startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  gracePeriod: z.number().min(0).optional(),
  earlyExitGracePeriod: z.number().min(0).optional(),
  minimumWorkingHours: z.number().min(0).optional(),
  breakDuration: z.number().min(0).optional(),
  isBreakPaid: z.boolean().optional(),
  workingDays: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])).optional(),
  isNightShift: z.boolean().optional(),
  isActive: z.boolean().optional(),
  description: z.string().optional(),
});

// GET - Get single shift
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

    const shift = await Shift.findById(id).populate('createdBy', 'email name');

    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    return NextResponse.json(shift);
  } catch (error) {
    console.error('Error fetching shift:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update shift
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

    const shift = await Shift.findById(id);
    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    const body = await req.json();
    const validatedData = updateShiftSchema.parse(body);

    // Validate shift times if they're being updated
    if (validatedData.startTime || validatedData.endTime || validatedData.isNightShift !== undefined) {
      const startTime = validatedData.startTime || shift.startTime;
      const endTime = validatedData.endTime || shift.endTime;
      const isNightShift = validatedData.isNightShift !== undefined ? validatedData.isNightShift : shift.isNightShift;

      const timeValidation = validateShiftTimes(startTime, endTime, isNightShift);
      if (!timeValidation.valid) {
        return NextResponse.json({ error: timeValidation.error }, { status: 400 });
      }
    }

    // Check name uniqueness if name is being updated
    if (validatedData.name && validatedData.name !== shift.name) {
      const existingShift = await Shift.findOne({ name: validatedData.name });
      if (existingShift) {
        return NextResponse.json({ error: 'Shift with this name already exists' }, { status: 400 });
      }
    }

    Object.assign(shift, validatedData);
    await shift.save();
    await shift.populate('createdBy', 'email name');

    return NextResponse.json(shift);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error updating shift:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete shift (soft delete by archiving)
export async function DELETE(
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

    const shift = await Shift.findById(id);
    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    // Check if shift has active assignments
    const activeAssignments = await ShiftAssignment.countDocuments({
      shiftId: id,
      isActive: true,
    });

    if (activeAssignments > 0) {
      return NextResponse.json(
        { error: 'Cannot delete shift with active assignments. Archive it instead.' },
        { status: 400 }
      );
    }

    // Soft delete by archiving
    shift.isActive = false;
    await shift.save();

    return NextResponse.json({ message: 'Shift archived successfully' });
  } catch (error) {
    console.error('Error deleting shift:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

