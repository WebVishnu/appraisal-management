import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import ShiftAssignment from '@/lib/models/ShiftAssignment';
import Shift from '@/lib/models/Shift';
import Employee from '@/lib/models/Employee';
import { z } from 'zod';
import mongoose from 'mongoose';
import { checkShiftConflicts, getTeamEmployees, getDepartmentEmployees } from '@/lib/utils/shift';

const createAssignmentSchema = z.object({
  shiftId: z.string(),
  assignmentType: z.enum(['permanent', 'temporary']),
  assignmentScope: z.enum(['employee', 'team', 'department']),
  employeeId: z.string().optional(),
  teamManagerId: z.string().optional(),
  departmentRole: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  effectiveDate: z.string().optional(),
  reason: z.string().optional(),
});

// GET - List all shift assignments
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin' && session.user.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const shiftId = searchParams.get('shiftId');
    const isActive = searchParams.get('isActive');

    const query: any = {};
    if (employeeId) query.employeeId = employeeId;
    if (shiftId) query.shiftId = shiftId;
    if (isActive !== null) query.isActive = isActive === 'true';

    const assignments = await ShiftAssignment.find(query)
      .populate('shiftId')
      .populate('employeeId', 'name employeeId email')
      .populate('teamManagerId', 'name employeeId email')
      .populate('assignedBy', 'email name')
      .sort({ createdAt: -1 });

    return NextResponse.json(assignments);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create shift assignment
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();
    const validatedData = createAssignmentSchema.parse(body);

    // Verify shift exists
    const shift = await Shift.findById(validatedData.shiftId);
    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    // Validate assignment scope
    if (validatedData.assignmentScope === 'employee' && !validatedData.employeeId) {
      return NextResponse.json({ error: 'employeeId is required for employee assignment' }, { status: 400 });
    }
    if (validatedData.assignmentScope === 'team' && !validatedData.teamManagerId) {
      return NextResponse.json({ error: 'teamManagerId is required for team assignment' }, { status: 400 });
    }
    if (validatedData.assignmentScope === 'department' && !validatedData.departmentRole) {
      return NextResponse.json({ error: 'departmentRole is required for department assignment' }, { status: 400 });
    }

    // Validate temporary assignment dates
    if (validatedData.assignmentType === 'temporary') {
      if (!validatedData.startDate || !validatedData.endDate) {
        return NextResponse.json(
          { error: 'startDate and endDate are required for temporary assignments' },
          { status: 400 }
        );
      }
      const startDate = new Date(validatedData.startDate);
      const endDate = new Date(validatedData.endDate);
      if (startDate >= endDate) {
        return NextResponse.json({ error: 'endDate must be after startDate' }, { status: 400 });
      }
    }

    // Check conflicts for employee assignments
    if (validatedData.assignmentScope === 'employee' && validatedData.employeeId) {
      const checkDate = validatedData.startDate ? new Date(validatedData.startDate) : new Date();
      const conflicts = await checkShiftConflicts(
        validatedData.employeeId,
        checkDate,
        validatedData.shiftId
      );

      if (conflicts.hasConflict && conflicts.conflicts.length > 0) {
        return NextResponse.json(
          { error: 'Shift assignment conflicts detected', conflicts: conflicts.conflicts },
          { status: 400 }
        );
      }
    }

    // Get User ID - need to find User by email since session.user.id might not be available
    if (!session.user.id && !session.user.email) {
      return NextResponse.json({ error: 'User ID not found in session' }, { status: 400 });
    }

    let assignedByUserId: mongoose.Types.ObjectId;
    if (session.user.id) {
      assignedByUserId = new mongoose.Types.ObjectId(session.user.id);
    } else {
      // Fallback: find User by email
      const { default: User } = await import('@/lib/models/User');
      const user = await User.findOne({ email: session.user.email });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      assignedByUserId = user._id;
    }

    // Build assignment object based on scope
    const assignmentData: any = {
      shiftId: new mongoose.Types.ObjectId(validatedData.shiftId),
      assignmentType: validatedData.assignmentType,
      assignmentScope: validatedData.assignmentScope,
      effectiveDate: validatedData.effectiveDate ? new Date(validatedData.effectiveDate) : new Date(),
      assignedBy: assignedByUserId,
      isActive: true,
    };

    // Add scope-specific fields
    if (validatedData.assignmentScope === 'employee') {
      assignmentData.employeeId = new mongoose.Types.ObjectId(validatedData.employeeId!);
    } else if (validatedData.assignmentScope === 'team') {
      assignmentData.teamManagerId = new mongoose.Types.ObjectId(validatedData.teamManagerId!);
    } else if (validatedData.assignmentScope === 'department') {
      assignmentData.departmentRole = validatedData.departmentRole;
    }

    // Add temporary assignment dates
    if (validatedData.assignmentType === 'temporary') {
      assignmentData.startDate = new Date(validatedData.startDate!);
      assignmentData.endDate = new Date(validatedData.endDate!);
    }

    // Add optional fields
    if (validatedData.reason) {
      assignmentData.reason = validatedData.reason;
    }

    const assignment = new ShiftAssignment(assignmentData);

    await assignment.save();
    await assignment.populate('shiftId');
    await assignment.populate('employeeId', 'name employeeId email');
    await assignment.populate('teamManagerId', 'name employeeId email');
    await assignment.populate('assignedBy', 'email name');

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error creating assignment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}

