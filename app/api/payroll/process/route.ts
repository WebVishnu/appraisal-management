import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Payroll from '@/lib/models/Payroll';
import PayrollAudit from '@/lib/models/PayrollAudit';
import Employee from '@/lib/models/Employee';
import { calculatePayroll, getActiveSalaryStructure } from '@/lib/utils/payroll';
import { z } from 'zod';
import mongoose from 'mongoose';

const processPayrollSchema = z.object({
  month: z.number().min(1).max(12),
  year: z.number().min(2000).max(2100),
  employeeIds: z.array(z.string()).optional(), // If not provided, process for all active employees
});

// POST - Process payroll for a month
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();
    const validatedData = processPayrollSchema.parse(body);

    // Get User ID
    let processedByUserId: mongoose.Types.ObjectId;
    if (session.user.id) {
      processedByUserId = new mongoose.Types.ObjectId(session.user.id);
    } else {
      const { default: User } = await import('@/lib/models/User');
      const user = await User.findOne({ email: session.user.email });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      processedByUserId = user._id;
    }

    // Get employees to process
    let employees: any[];
    if (validatedData.employeeIds && validatedData.employeeIds.length > 0) {
      employees = await Employee.find({
        _id: { $in: validatedData.employeeIds.map(id => new mongoose.Types.ObjectId(id)) },
        isActive: true,
      });
    } else {
      employees = await Employee.find({ isActive: true });
    }

    const payrollDate = new Date(validatedData.year, validatedData.month - 1, 1);
    const results = [];
    const errors = [];

    for (const employee of employees) {
      try {
        // Check if payroll already exists
        const existingPayroll = await Payroll.findOne({
          employeeId: employee._id,
          payrollYear: validatedData.year,
          payrollMonth: validatedData.month,
        });

        if (existingPayroll && existingPayroll.status === 'locked') {
          errors.push({
            employeeId: employee._id.toString(),
            employeeName: employee.name,
            error: 'Payroll already locked for this period',
          });
          continue;
        }

        // Get active salary structure
        const salaryStructure = await getActiveSalaryStructure(
          employee._id,
          employee.role,
          payrollDate
        );

        if (!salaryStructure) {
          errors.push({
            employeeId: employee._id.toString(),
            employeeName: employee.name,
            error: 'No active salary structure found',
          });
          continue;
        }

        // Calculate payroll
        const calculation = await calculatePayroll({
          employeeId: employee._id,
          month: validatedData.month,
          year: validatedData.year,
          salaryStructure: {
            grossMonthlySalary: salaryStructure.grossMonthlySalary,
            workingDaysRule: salaryStructure.workingDaysRule,
            fixedWorkingDays: salaryStructure.fixedWorkingDays,
            paidLeaveTypes: salaryStructure.paidLeaveTypes,
            unpaidLeaveTypes: salaryStructure.unpaidLeaveTypes,
            halfDayDeductionRule: salaryStructure.halfDayDeductionRule,
          },
        });

        // Create or update payroll record
        if (existingPayroll) {
          // Update existing draft
          Object.assign(existingPayroll, {
            salaryStructureId: salaryStructure._id,
            grossMonthlySalary: salaryStructure.grossMonthlySalary,
            ...calculation,
            status: 'processed',
            processedAt: new Date(),
            processedBy: processedByUserId,
          });
          await existingPayroll.save();
          results.push(existingPayroll);
        } else {
          // Create new payroll
          const payroll = new Payroll({
            employeeId: employee._id,
            payrollMonth: validatedData.month,
            payrollYear: validatedData.year,
            salaryStructureId: salaryStructure._id,
            grossMonthlySalary: salaryStructure.grossMonthlySalary,
            ...calculation,
            status: 'processed',
            processedAt: new Date(),
            processedBy: processedByUserId,
          });
          await payroll.save();
          results.push(payroll);
        }

        // Create audit log
        await PayrollAudit.create({
          action: 'payroll_processed',
          payrollId: existingPayroll?._id || results[results.length - 1]._id,
          employeeId: employee._id,
          description: `Payroll processed for ${validatedData.month}/${validatedData.year}`,
          performedBy: processedByUserId,
          performedAt: new Date(),
        });
      } catch (error) {
        errors.push({
          employeeId: employee._id.toString(),
          employeeName: employee.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      processed: results.length,
      errors: errors.length > 0 ? errors : undefined,
      payrolls: results,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error processing payroll:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - Get payroll records
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const status = searchParams.get('status');

    const query: any = {};

    // Role-based filtering
    if (session.user.role === 'employee') {
      const employee = await Employee.findOne({ email: session.user.email });
      if (employee) {
        query.employeeId = employee._id;
      } else {
        return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
      }
    } else if (session.user.role === 'manager') {
      // Managers can see their team's payroll
      const manager = await Employee.findOne({ email: session.user.email });
      if (manager) {
        const teamEmployees = await Employee.find({ managerId: manager._id, isActive: true }).select('_id');
        query.employeeId = { $in: teamEmployees.map(e => e._id) };
      }
    }

    if (employeeId && session.user.role !== 'employee') {
      query.employeeId = new mongoose.Types.ObjectId(employeeId);
    }
    if (month) query.payrollMonth = parseInt(month);
    if (year) query.payrollYear = parseInt(year);
    if (status) query.status = status;

    const payrolls = await Payroll.find(query)
      .populate('employeeId', 'name employeeId email role')
      .populate('salaryStructureId')
      .populate('processedBy', 'email name')
      .populate('lockedBy', 'email name')
      .sort({ payrollYear: -1, payrollMonth: -1, createdAt: -1 });

    return NextResponse.json(payrolls);
  } catch (error) {
    console.error('Error fetching payrolls:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

