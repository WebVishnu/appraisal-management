import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import SalaryStructure from '@/lib/models/SalaryStructure';
import PayrollAudit from '@/lib/models/PayrollAudit';
import { z } from 'zod';
import mongoose from 'mongoose';

const updateSalaryStructureSchema = z.object({
  grossMonthlySalary: z.number().min(0).optional(),
  workingDaysRule: z.enum(['shift_based', 'calendar_days', 'fixed_days']).optional(),
  fixedWorkingDays: z.number().min(1).max(31).optional(),
  paidLeaveTypes: z.array(z.string()).optional(),
  unpaidLeaveTypes: z.array(z.string()).optional(),
  halfDayDeductionRule: z.enum(['half_day', 'proportional']).optional(),
  effectiveTo: z.string().optional(),
  isActive: z.boolean().optional(),
});

// GET - Get single salary structure
export async function GET(
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

    const structure = await SalaryStructure.findById(id)
      .populate('employeeId', 'name employeeId email role')
      .populate('createdBy', 'email name')
      .populate('previousVersionId');

    if (!structure) {
      return NextResponse.json({ error: 'Salary structure not found' }, { status: 404 });
    }

    return NextResponse.json(structure);
  } catch (error) {
    console.error('Error fetching salary structure:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update salary structure (creates new version)
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

    const existingStructure = await SalaryStructure.findById(id);
    if (!existingStructure) {
      return NextResponse.json({ error: 'Salary structure not found' }, { status: 404 });
    }

    const body = await req.json();
    const validatedData = updateSalaryStructureSchema.parse(body);

    // Get User ID for createdBy
    let updatedByUserId: mongoose.Types.ObjectId;
    if (session.user.id) {
      updatedByUserId = new mongoose.Types.ObjectId(session.user.id);
    } else {
      const { default: User } = await import('@/lib/models/User');
      const user = await User.findOne({ email: session.user.email });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      updatedByUserId = user._id;
    }

    // Create new version instead of updating existing
    const newStructure = new SalaryStructure({
      employeeId: existingStructure.employeeId,
      role: existingStructure.role,
      grossMonthlySalary: validatedData.grossMonthlySalary ?? existingStructure.grossMonthlySalary,
      workingDaysRule: validatedData.workingDaysRule ?? existingStructure.workingDaysRule,
      fixedWorkingDays: validatedData.fixedWorkingDays ?? existingStructure.fixedWorkingDays,
      paidLeaveTypes: validatedData.paidLeaveTypes ?? existingStructure.paidLeaveTypes,
      unpaidLeaveTypes: validatedData.unpaidLeaveTypes ?? existingStructure.unpaidLeaveTypes,
      halfDayDeductionRule: validatedData.halfDayDeductionRule ?? existingStructure.halfDayDeductionRule,
      effectiveFrom: validatedData.effectiveTo 
        ? new Date(validatedData.effectiveTo) 
        : existingStructure.effectiveFrom,
      version: existingStructure.version + 1,
      previousVersionId: existingStructure._id,
      createdBy: updatedByUserId,
    });

    // Deactivate old structure
    existingStructure.isActive = false;
    if (validatedData.effectiveTo) {
      existingStructure.effectiveTo = new Date(validatedData.effectiveTo);
    }
    await existingStructure.save();

    await newStructure.save();

    // Create audit log
    await PayrollAudit.create({
      action: 'salary_structure_updated',
      salaryStructureId: newStructure._id,
      employeeId: existingStructure.employeeId,
      description: `Salary structure updated: Version ${newStructure.version}`,
      changes: {
        before: existingStructure.toObject(),
        after: newStructure.toObject(),
      },
      performedBy: updatedByUserId,
      performedAt: new Date(),
    });

    await newStructure.populate('employeeId', 'name employeeId email');
    await newStructure.populate('createdBy', 'email name');

    return NextResponse.json(newStructure);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error updating salary structure:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Deactivate salary structure
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

    const structure = await SalaryStructure.findById(id);
    if (!structure) {
      return NextResponse.json({ error: 'Salary structure not found' }, { status: 404 });
    }

    // Get User ID
    let deactivatedByUserId: mongoose.Types.ObjectId;
    if (session.user.id) {
      deactivatedByUserId = new mongoose.Types.ObjectId(session.user.id);
    } else {
      const { default: User } = await import('@/lib/models/User');
      const user = await User.findOne({ email: session.user.email });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      deactivatedByUserId = user._id;
    }

    structure.isActive = false;
    structure.effectiveTo = new Date();
    await structure.save();

    // Create audit log
    await PayrollAudit.create({
      action: 'salary_structure_deactivated',
      salaryStructureId: structure._id,
      employeeId: structure.employeeId,
      description: 'Salary structure deactivated',
      performedBy: deactivatedByUserId,
      performedAt: new Date(),
    });

    return NextResponse.json({ message: 'Salary structure deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating salary structure:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

