import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import SalaryStructure from '@/lib/models/SalaryStructure';
import PayrollAudit from '@/lib/models/PayrollAudit';
import Employee from '@/lib/models/Employee';
import { z } from 'zod';
import mongoose from 'mongoose';

const createSalaryStructureSchema = z.object({
  employeeId: z.string().optional(),
  role: z.string().optional(),
  grossMonthlySalary: z.number().min(0, 'Gross monthly salary must be greater than 0'),
  workingDaysRule: z.enum(['shift_based', 'calendar_days', 'fixed_days']),
  fixedWorkingDays: z.number().min(1).max(31).optional(),
  paidLeaveTypes: z.array(z.string()).default(['paid']),
  unpaidLeaveTypes: z.array(z.string()).default(['unpaid']),
  halfDayDeductionRule: z.enum(['half_day', 'proportional']).default('half_day'),
  effectiveFrom: z.string().min(1, 'Effective from date is required'),
}).refine((data) => {
  // If workingDaysRule is 'fixed_days', fixedWorkingDays is required
  if (data.workingDaysRule === 'fixed_days') {
    return data.fixedWorkingDays !== undefined && data.fixedWorkingDays >= 1 && data.fixedWorkingDays <= 31;
  }
  return true;
}, {
  message: 'Fixed working days is required and must be between 1 and 31 when working days rule is "fixed_days"',
  path: ['fixedWorkingDays'],
});

const updateSalaryStructureSchema = createSalaryStructureSchema.partial().extend({
  effectiveTo: z.string().optional(),
  isActive: z.boolean().optional(),
});

// GET - List salary structures
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const role = searchParams.get('role');
    const isActive = searchParams.get('isActive');

    const query: any = {};
    if (employeeId) query.employeeId = new mongoose.Types.ObjectId(employeeId);
    if (role) query.role = role;
    if (isActive !== null) query.isActive = isActive === 'true';

    const structures = await SalaryStructure.find(query)
      .populate('employeeId', 'name employeeId email role')
      .populate('createdBy', 'email name')
      .sort({ effectiveFrom: -1 });

    return NextResponse.json(structures);
  } catch (error) {
    console.error('Error fetching salary structures:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create salary structure
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();
    const validatedData = createSalaryStructureSchema.parse(body);

    // Validate: either employeeId or role must be provided
    if (!validatedData.employeeId && !validatedData.role) {
      return NextResponse.json(
        { error: 'Either employeeId or role must be provided' },
        { status: 400 }
      );
    }

    if (validatedData.employeeId && validatedData.role) {
      return NextResponse.json(
        { error: 'Cannot specify both employeeId and role' },
        { status: 400 }
      );
    }

    // Get User ID for createdBy
    let createdByUserId: mongoose.Types.ObjectId;
    if (session.user.id) {
      createdByUserId = new mongoose.Types.ObjectId(session.user.id);
    } else {
      const { default: User } = await import('@/lib/models/User');
      const user = await User.findOne({ email: session.user.email });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      createdByUserId = user._id;
    }

    // If employee-specific, verify employee exists
    if (validatedData.employeeId) {
      const employee = await Employee.findById(validatedData.employeeId);
      if (!employee) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }
    }

    // Deactivate previous structure if creating new one for same employee/role
    const previousStructure = await SalaryStructure.findOne({
      $or: [
        { employeeId: validatedData.employeeId || null },
        { role: validatedData.role || null },
      ],
      isActive: true,
    }).sort({ effectiveFrom: -1 });

    let version = 1;
    let previousVersionId = null;

    if (previousStructure) {
      version = previousStructure.version + 1;
      previousVersionId = previousStructure._id;
      
      // Set effectiveTo date for previous structure
      previousStructure.effectiveTo = new Date(validatedData.effectiveFrom);
      previousStructure.isActive = false;
      await previousStructure.save();
    }

    const structure = new SalaryStructure({
      employeeId: validatedData.employeeId ? new mongoose.Types.ObjectId(validatedData.employeeId) : null,
      role: validatedData.role || null,
      grossMonthlySalary: validatedData.grossMonthlySalary,
      workingDaysRule: validatedData.workingDaysRule,
      fixedWorkingDays: validatedData.fixedWorkingDays,
      paidLeaveTypes: validatedData.paidLeaveTypes,
      unpaidLeaveTypes: validatedData.unpaidLeaveTypes,
      halfDayDeductionRule: validatedData.halfDayDeductionRule,
      effectiveFrom: new Date(validatedData.effectiveFrom),
      version,
      previousVersionId,
      createdBy: createdByUserId,
    });

    await structure.save();

    // Create audit log
    await PayrollAudit.create({
      action: 'salary_structure_created',
      salaryStructureId: structure._id,
      employeeId: validatedData.employeeId ? new mongoose.Types.ObjectId(validatedData.employeeId) : undefined,
      description: `Salary structure created: ${validatedData.grossMonthlySalary} for ${validatedData.employeeId ? 'employee' : 'role: ' + validatedData.role}`,
      performedBy: createdByUserId,
      performedAt: new Date(),
    });

    await structure.populate('employeeId', 'name employeeId email');
    await structure.populate('createdBy', 'email name');

    return NextResponse.json(structure, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format Zod errors into a readable message
      const errorMessages = error.issues.map((issue) => {
        const path = issue.path.join('.');
        return `${path}: ${issue.message}`;
      });
      return NextResponse.json({ 
        error: errorMessages.join(', '),
        issues: error.issues 
      }, { status: 400 });
    }
    console.error('Error creating salary structure:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

