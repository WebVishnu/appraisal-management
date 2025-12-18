import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Roster from '@/lib/models/Roster';
import { z } from 'zod';
import mongoose from 'mongoose';

const updateRosterSchema = z.object({
  shiftId: z.string().optional(),
  isWeeklyOff: z.boolean().optional(),
  notes: z.string().optional(),
});

// PUT - Update roster entry
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin' && session.user.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    const roster = await Roster.findById(id);
    if (!roster) {
      return NextResponse.json({ error: 'Roster entry not found' }, { status: 404 });
    }

    const body = await req.json();
    const validatedData = updateRosterSchema.parse(body);

    if (validatedData.shiftId) {
      roster.shiftId = new mongoose.Types.ObjectId(validatedData.shiftId);
    }
    if (validatedData.isWeeklyOff !== undefined) {
      roster.isWeeklyOff = validatedData.isWeeklyOff;
    }
    if (validatedData.notes !== undefined) {
      roster.notes = validatedData.notes;
    }

    await roster.save();
    await roster.populate('employeeId', 'name employeeId email');
    await roster.populate('shiftId');

    return NextResponse.json(roster);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error updating roster:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete roster entry
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin' && session.user.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    const roster = await Roster.findById(id);
    if (!roster) {
      return NextResponse.json({ error: 'Roster entry not found' }, { status: 404 });
    }

    await roster.deleteOne();

    return NextResponse.json({ message: 'Roster entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting roster:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

