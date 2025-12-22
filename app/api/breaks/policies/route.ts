/**
 * Break Policy Management Endpoints
 * GET /api/breaks/policies - Get all policies
 * POST /api/breaks/policies - Create policy
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import { getUserSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import BreakPolicy from '@/lib/models/BreakPolicy';
import mongoose from 'mongoose';

// GET - Get all break policies
export async function GET(req: NextRequest) {
  try {
    const session = await getUserSession(req, auth);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only HR and Admin can view policies
    if (session.user.role !== 'hr' && session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope');
    const isActive = searchParams.get('isActive');

    let query: any = {};

    if (scope) {
      query.scope = scope;
    }

    if (isActive !== null) {
      query.isActive = isActive === 'true';
    }

    const policies = await BreakPolicy.find(query)
      .populate('createdBy', 'email')
      .sort({ effectiveFrom: -1, createdAt: -1 });

    return NextResponse.json(policies);
  } catch (error: any) {
    console.error('Error fetching break policies:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create break policy
export async function POST(req: NextRequest) {
  try {
    const session = await getUserSession(req, auth);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only HR and Admin can create policies
    if (session.user.role !== 'hr' && session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectDB();

    const body = await req.json();
    const {
      name,
      description,
      scope,
      scopeIds,
      allowBreaks,
      maxBreaksPerDay,
      maxTotalBreakDuration,
      maxDurationPerBreak,
      allowedBreakTypes,
      mandatoryBreaks,
      minWorkingHoursBeforeFirstBreak,
      gracePeriod,
      paidBreaks,
      deductBreakTime,
      autoFlagExcessiveBreaks,
      allowBreakOverrun,
      effectiveFrom,
      effectiveTo,
      isActive,
    } = body;

    if (!name || !scope) {
      return NextResponse.json(
        { error: 'Name and scope are required' },
        { status: 400 }
      );
    }

    const policy = await BreakPolicy.create({
      name,
      description,
      scope,
      scopeIds: scopeIds?.map((id: string) => new mongoose.Types.ObjectId(id)) || [],
      allowBreaks: allowBreaks ?? true,
      maxBreaksPerDay,
      maxTotalBreakDuration,
      maxDurationPerBreak,
      allowedBreakTypes: allowedBreakTypes || ['lunch', 'tea', 'personal'],
      mandatoryBreaks: mandatoryBreaks || [],
      minWorkingHoursBeforeFirstBreak,
      gracePeriod: gracePeriod || 5,
      paidBreaks: paidBreaks || ['lunch'],
      deductBreakTime: deductBreakTime ?? true,
      autoFlagExcessiveBreaks: autoFlagExcessiveBreaks ?? true,
      allowBreakOverrun: allowBreakOverrun ?? false,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
      effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      isActive: isActive ?? true,
      createdBy: new mongoose.Types.ObjectId(session.user.id),
    });

    const populatedPolicy = await BreakPolicy.findById(policy._id).populate(
      'createdBy',
      'email'
    );

    return NextResponse.json({
      message: 'Break policy created successfully',
      policy: populatedPolicy,
    });
  } catch (error: any) {
    console.error('Error creating break policy:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

