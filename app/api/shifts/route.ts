import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Shift from '@/lib/models/Shift';
import { z } from 'zod';
import mongoose from 'mongoose';
import { validateShiftTimes } from '@/lib/utils/shift';

const createShiftSchema = z.object({
  name: z.string().min(1),
  shiftType: z.enum(['fixed', 'rotational', 'flexible']),
  startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  gracePeriod: z.number().min(0).default(15),
  earlyExitGracePeriod: z.number().min(0).default(15),
  minimumWorkingHours: z.number().min(0),
  breakDuration: z.number().min(0).default(60),
  isBreakPaid: z.boolean().default(false),
  workingDays: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])).min(1),
  isNightShift: z.boolean().default(false),
  description: z.string().optional(),
});

const updateShiftSchema = createShiftSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// GET - List all shifts
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin' && session.user.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const isActive = searchParams.get('isActive');

    const query: any = {};
    if (isActive === 'true') {
      query.isActive = true;
    }

    const shifts = await Shift.find(query)
      .sort({ name: 1 });

    return NextResponse.json(shifts);
  } catch (error) {
    console.error('Error fetching shifts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new shift
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();
    const validatedData = createShiftSchema.parse(body);

    // Validate shift times
    const timeValidation = validateShiftTimes(
      validatedData.startTime,
      validatedData.endTime,
      validatedData.isNightShift
    );

    if (!timeValidation.valid) {
      return NextResponse.json({ error: timeValidation.error }, { status: 400 });
    }

    // Check if shift name already exists
    const existingShift = await Shift.findOne({ name: validatedData.name });
    if (existingShift) {
      return NextResponse.json({ error: 'Shift with this name already exists' }, { status: 400 });
    }

    // Get User ID
    if (!session.user.id && !session.user.email) {
      return NextResponse.json({ error: 'User ID not found in session' }, { status: 400 });
    }

    let createdByUserId: mongoose.Types.ObjectId;
    if (session.user.id) {
      createdByUserId = new mongoose.Types.ObjectId(session.user.id);
    } else {
      // Fallback: find User by email
      const { default: User } = await import('@/lib/models/User');
      const user = await User.findOne({ email: session.user.email });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      createdByUserId = user._id;
    }

    const shift = new Shift({
      ...validatedData,
      createdBy: createdByUserId,
    });

    await shift.save();
    await shift.populate('createdBy', 'email name');

    return NextResponse.json(shift, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error creating shift:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

