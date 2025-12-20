import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import mongoose from 'mongoose';

const changePasswordSchema = z.object({
  userId: z.string().optional(), // Optional - if not provided, change own password
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  currentPassword: z.string().optional(), // Required only when changing own password
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = changePasswordSchema.parse(body);

    await connectDB();

    // Determine target user ID
    let targetUserId: string;
    let targetEmployeeId: mongoose.Types.ObjectId | null = null;

    if (validatedData.userId) {
      // Changing someone else's password - need authorization
      targetUserId = validatedData.userId;

      // Get target user
      const targetUser = await User.findById(targetUserId).select('+password');
      if (!targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Get target employee
      if (targetUser.employeeId) {
        targetEmployeeId = targetUser.employeeId;
      }

      // Authorization checks
      if (session.user.role === 'employee') {
        // Employee can only change their own password
        if (targetUserId !== session.user.id) {
          return NextResponse.json(
            { error: 'You can only change your own password' },
            { status: 403 }
          );
        }
      } else if (session.user.role === 'manager') {
        // Manager can change their own password or team members' passwords
        if (targetUserId === session.user.id) {
          // Manager changing their own password - verify current password
          if (!validatedData.currentPassword) {
            return NextResponse.json(
              { error: 'Current password is required to change your password' },
              { status: 400 }
            );
          }
          const isPasswordValid = await bcrypt.compare(
            validatedData.currentPassword,
            targetUser.password
          );
          if (!isPasswordValid) {
            return NextResponse.json(
              { error: 'Current password is incorrect' },
              { status: 400 }
            );
          }
        } else {
          // Changing team member's password
          if (!targetEmployeeId) {
            return NextResponse.json(
              { error: 'Target user does not have an employee record' },
              { status: 400 }
            );
          }

          // Get manager's employee record
          const managerEmployee = await Employee.findOne({
            email: session.user.email,
          });

          if (!managerEmployee) {
            return NextResponse.json(
              { error: 'Manager employee record not found' },
              { status: 404 }
            );
          }

          // Get target employee
          const targetEmployee = await Employee.findById(targetEmployeeId);
          if (!targetEmployee) {
            return NextResponse.json(
              { error: 'Target employee not found' },
              { status: 404 }
            );
          }

          // Check if target employee reports to this manager
          if (
            !targetEmployee.managerId ||
            targetEmployee.managerId.toString() !== managerEmployee._id.toString()
          ) {
            return NextResponse.json(
              { error: 'You can only change passwords for your team members' },
              { status: 403 }
            );
          }
        }
      } else if (session.user.role === 'hr') {
        // HR can change any employee's password (including managers)
        // No additional checks needed
      } else if (session.user.role === 'super_admin') {
        // Super admin can change anyone's password
        // No additional checks needed
      } else {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    } else {
      // Changing own password
      targetUserId = session.user.id!;

      // Get current user
      const currentUser = await User.findById(targetUserId).select('+password');
      if (!currentUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Verify current password
      if (!validatedData.currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required to change your password' },
          { status: 400 }
        );
      }

      const isPasswordValid = await bcrypt.compare(
        validatedData.currentPassword,
        currentUser.password
      );

      if (!isPasswordValid) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 400 }
        );
      }
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(validatedData.newPassword, 10);

    // Update password
    await User.findByIdAndUpdate(targetUserId, {
      password: hashedPassword,
    });

    return NextResponse.json(
      { message: 'Password changed successfully' },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error('Error changing password:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

