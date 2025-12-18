import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Employee from '@/lib/models/Employee';
import User from '@/lib/models/User';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const createEmployeeSchema = z.object({
  employeeId: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.string().min(1),
  managerId: z.string().optional(),
  password: z.string().min(6).optional(),
});

const updateEmployeeSchema = z.object({
  employeeId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.string().min(1).optional(),
  managerId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// GET - List all employees
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const employees = await Employee.find()
      .populate('managerId', 'name employeeId email')
      .sort({ createdAt: -1 });

    return NextResponse.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new employee
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createEmployeeSchema.parse(body);

    await connectDB();

    // Check if employee ID already exists
    const existingEmployee = await Employee.findOne({
      employeeId: validatedData.employeeId,
    });
    if (existingEmployee) {
      return NextResponse.json(
        { error: 'Employee with this ID already exists' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingEmail = await Employee.findOne({
      email: validatedData.email.toLowerCase(),
    });
    if (existingEmail) {
      return NextResponse.json(
        { error: 'Employee with this email already exists' },
        { status: 400 }
      );
    }

    // Validate manager if provided
    if (validatedData.managerId) {
      const manager = await Employee.findById(validatedData.managerId);
      if (!manager) {
        return NextResponse.json({ error: 'Manager not found' }, { status: 400 });
      }
    }

    const employee = await Employee.create({
      employeeId: validatedData.employeeId,
      name: validatedData.name,
      email: validatedData.email.toLowerCase(),
      role: validatedData.role,
      managerId: validatedData.managerId || null,
      isActive: true,
    });

    // Create User account for the employee
    // Generate default password if not provided: employeeId@123
    const defaultPassword = validatedData.password || `${validatedData.employeeId}@123`;
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Determine user role based on employee role
    let userRole: 'employee' | 'manager' | 'hr' | 'super_admin' = 'employee';
    const roleLower = validatedData.role.toLowerCase();
    if (roleLower.includes('admin') || roleLower.includes('super')) {
      userRole = 'super_admin';
    } else if (roleLower.includes('hr') || roleLower.includes('human resource')) {
      userRole = 'hr';
    } else if (roleLower.includes('manager') || roleLower.includes('mgr')) {
      userRole = 'manager';
    }

    await User.create({
      email: validatedData.email.toLowerCase(),
      password: hashedPassword,
      role: userRole,
      employeeId: employee._id,
      isActive: true,
    });

    const populatedEmployee = await Employee.findById(employee._id).populate(
      'managerId',
      'name employeeId email'
    );

    return NextResponse.json({
      ...populatedEmployee.toObject(),
      defaultPassword: validatedData.password ? undefined : defaultPassword,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error creating employee:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update employee
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }

    const validatedData = updateEmployeeSchema.parse(updateData);

    await connectDB();

    // If employeeId is being updated, check for duplicates
    if (validatedData.employeeId) {
      const existing = await Employee.findOne({
        employeeId: validatedData.employeeId,
        _id: { $ne: id },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'Employee ID already exists' },
          { status: 400 }
        );
      }
    }

    // If email is being updated, check for duplicates
    if (validatedData.email) {
      const existing = await Employee.findOne({
        email: validatedData.email.toLowerCase(),
        _id: { $ne: id },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 400 }
        );
      }
      validatedData.email = validatedData.email.toLowerCase();
    }

    // Validate manager if provided
    if (validatedData.managerId !== undefined) {
      if (validatedData.managerId) {
        const manager = await Employee.findById(validatedData.managerId);
        if (!manager) {
          return NextResponse.json({ error: 'Manager not found' }, { status: 400 });
        }
      }
    }

    const employee = await Employee.findByIdAndUpdate(id, validatedData, { new: true })
      .populate('managerId', 'name employeeId email');

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // If employee is deactivated, deactivate their user account
    if (validatedData.isActive === false) {
      await User.updateMany({ employeeId: id }, { isActive: false });
    } else if (validatedData.isActive === true) {
      await User.updateMany({ employeeId: id }, { isActive: true });
    }

    return NextResponse.json(employee);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error updating employee:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete employee
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }

    await connectDB();

    const employee = await Employee.findByIdAndDelete(id);

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Also delete associated user account
    await User.deleteMany({ employeeId: id });

    return NextResponse.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

