import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import AppraisalCycle from '@/lib/models/AppraisalCycle';
import { z } from 'zod';
import { notifyCycleStatusChange } from '@/lib/utils/notifications';

const competencySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['rating', 'text']),
  maxRating: z.number().optional(),
});

const createCycleSchema = z.object({
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  competencies: z.array(competencySchema).min(1),
});

const updateCycleSchema = z.object({
  name: z.string().min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['draft', 'open_self_review', 'open_manager_review', 'closed']).optional(),
  competencies: z.array(competencySchema).min(1).optional(),
});

// GET - List all cycles
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const cycles = await AppraisalCycle.find()
      .populate('createdBy', 'email')
      .sort({ createdAt: -1 });

    return NextResponse.json(cycles);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new cycle
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createCycleSchema.parse(body);

    await connectDB();

    const cycle = await AppraisalCycle.create({
      name: validatedData.name,
      startDate: new Date(validatedData.startDate),
      endDate: new Date(validatedData.endDate),
      competencies: validatedData.competencies.map((comp) => ({
        ...comp,
        maxRating: comp.type === 'rating' ? (comp.maxRating || 5) : undefined,
      })),
      status: 'draft',
      createdBy: session.user.id,
    });

    const populatedCycle = await AppraisalCycle.findById(cycle._id).populate('createdBy', 'email');

    return NextResponse.json(populatedCycle, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error creating cycle:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update cycle
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Cycle ID is required' }, { status: 400 });
    }

    const validatedData = updateCycleSchema.parse(updateData);

    await connectDB();

    const updateObj: any = {};

    if (validatedData.name) updateObj.name = validatedData.name;
    if (validatedData.startDate) updateObj.startDate = new Date(validatedData.startDate);
    if (validatedData.endDate) updateObj.endDate = new Date(validatedData.endDate);
    if (validatedData.status) updateObj.status = validatedData.status;
    if (validatedData.competencies) {
      updateObj.competencies = validatedData.competencies.map((comp) => ({
        ...comp,
        maxRating: comp.type === 'rating' ? (comp.maxRating || 5) : undefined,
      }));
    }

    const cycle = await AppraisalCycle.findByIdAndUpdate(id, updateObj, { new: true }).populate(
      'createdBy',
      'email'
    );

    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    // Send notifications if status changed
    if (validatedData.status) {
      await notifyCycleStatusChange(cycle._id.toString(), validatedData.status);
    }

    return NextResponse.json(cycle);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error updating cycle:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete cycle
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Cycle ID is required' }, { status: 400 });
    }

    await connectDB();

    const cycle = await AppraisalCycle.findByIdAndDelete(id);

    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Cycle deleted successfully' });
  } catch (error) {
    console.error('Error deleting cycle:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

