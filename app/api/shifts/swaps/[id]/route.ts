import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import ShiftSwap from '@/lib/models/ShiftSwap';
import Roster from '@/lib/models/Roster';
import Employee from '@/lib/models/Employee';
import { z } from 'zod';
import mongoose from 'mongoose';

const reviewSwapSchema = z.object({
  status: z.enum(['approved', 'rejected', 'cancelled']),
  rejectionReason: z.string().optional(),
});

// PUT - Review shift swap (approve/reject/cancel)
export async function PUT(
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

    const swap = await ShiftSwap.findById(id)
      .populate('requesterId', 'name employeeId email')
      .populate('requesteeId', 'name employeeId email');

    if (!swap) {
      return NextResponse.json({ error: 'Swap request not found' }, { status: 404 });
    }

    const body = await req.json();
    const validatedData = reviewSwapSchema.parse(body);

    // Check permissions
    const employee = await Employee.findOne({ email: session.user.email });
    if (!employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
    }

    // Only requester can cancel
    if (validatedData.status === 'cancelled') {
      if (swap.requesterId.toString() !== employee._id.toString()) {
        return NextResponse.json({ error: 'Only requester can cancel swap request' }, { status: 403 });
      }
    } else {
      // Only manager or requestee can approve/reject
      if (session.user.role !== 'manager' && session.user.role !== 'hr' && session.user.role !== 'super_admin') {
        if (swap.requesteeId.toString() !== employee._id.toString()) {
          return NextResponse.json({ error: 'Unauthorized to review this swap' }, { status: 403 });
        }
      }
    }

    if (swap.status !== 'pending') {
      return NextResponse.json({ error: 'Swap request is not pending' }, { status: 400 });
    }

    swap.status = validatedData.status;
    
    // Get User ID for reviewedBy
    let reviewedByUserId: mongoose.Types.ObjectId;
    if (session.user.id) {
      reviewedByUserId = new mongoose.Types.ObjectId(session.user.id);
    } else {
      const { default: User } = await import('@/lib/models/User');
      const user = await User.findOne({ email: session.user.email });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      reviewedByUserId = user._id;
    }
    
    swap.reviewedBy = reviewedByUserId;
    swap.reviewedAt = new Date();
    if (validatedData.rejectionReason) {
      swap.rejectionReason = validatedData.rejectionReason;
    }

    // If approved, update rosters
    if (validatedData.status === 'approved') {
      // Update requester's roster
      const requesterRoster = await Roster.findOne({
        employeeId: swap.requesterId,
        date: swap.requesterDate,
      });

      if (requesterRoster) {
        requesterRoster.shiftId = swap.requesteeShiftId;
        await requesterRoster.save();
      } else {
        // Create roster entry if doesn't exist
        const newRequesterRoster = new Roster({
          employeeId: swap.requesterId,
          shiftId: swap.requesteeShiftId,
          date: swap.requesterDate,
          year: swap.requesterDate.getFullYear(),
          month: swap.requesterDate.getMonth() + 1,
          createdBy: reviewedByUserId,
        });
        await newRequesterRoster.save();
      }

      // Update requestee's roster
      const requesteeRoster = await Roster.findOne({
        employeeId: swap.requesteeId,
        date: swap.requesteeDate,
      });

      if (requesteeRoster) {
        requesteeRoster.shiftId = swap.requesterShiftId;
        await requesteeRoster.save();
      } else {
        // Create roster entry if doesn't exist
        const newRequesteeRoster = new Roster({
          employeeId: swap.requesteeId,
          shiftId: swap.requesterShiftId,
          date: swap.requesteeDate,
          year: swap.requesteeDate.getFullYear(),
          month: swap.requesteeDate.getMonth() + 1,
          createdBy: reviewedByUserId,
        });
        await newRequesteeRoster.save();
      }
    }

    await swap.save();
    await swap.populate('requesterId', 'name employeeId email');
    await swap.populate('requesteeId', 'name employeeId email');
    await swap.populate('requesterShiftId');
    await swap.populate('requesteeShiftId');
    await swap.populate('reviewedBy', 'email name');

    return NextResponse.json(swap);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error reviewing swap:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

