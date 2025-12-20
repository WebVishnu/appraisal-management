import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import OnboardingRequest from '@/lib/models/OnboardingRequest';
import OnboardingSubmission from '@/lib/models/OnboardingSubmission';
import OnboardingAudit from '@/lib/models/OnboardingAudit';
import Employee from '@/lib/models/Employee';
import User from '@/lib/models/User';
import SalaryStructure from '@/lib/models/SalaryStructure';
import LeaveBalance from '@/lib/models/LeaveBalance';
import { z } from 'zod';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { generateOnboardingToken, generateOnboardingLink } from '@/lib/utils/onboarding';
import { createNotification } from '@/lib/utils/notifications';
import { formatErrorMessage } from '@/lib/utils/format';

const updateOnboardingRequestSchema = z.object({
  status: z.enum(['invited', 'in_progress', 'submitted', 'changes_requested', 'approved', 'rejected', 'completed']).optional(),
  hrNotes: z.string().optional(),
  rejectionReason: z.string().optional(),
  changeRequestComments: z.string().optional(),
  expiryDays: z.number().min(1).max(90).optional(),
});

// GET - Get single onboarding request
export async function GET(
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

    const request = await OnboardingRequest.findById(id)
      .populate('invitedBy', 'email name')
      .populate('reviewedBy', 'email name')
      .populate('approvedBy', 'email name')
      .populate('reportingManagerId', 'name employeeId email')
      .populate('employeeId', 'name employeeId email')
      .populate('userId', 'email role');

    if (!request) {
      return NextResponse.json({ error: 'Onboarding request not found' }, { status: 404 });
    }

    // Check access permissions
    if (session.user.role !== 'hr' && session.user.role !== 'super_admin') {
      // Check if user is the employee
      const user = await User.findById(session.user.id);
      if (user && user.email === request.email) {
        // Employee viewing their own onboarding - allowed
      } else if (session.user.role === 'manager') {
        // Managers can view onboarding for their team members
        const managerEmployee = await Employee.findOne({ email: session.user.email });
        if (!managerEmployee) {
          return NextResponse.json({ error: 'Manager employee record not found' }, { status: 404 });
        }
        
        // Check if the onboarding request is for a team member
        // Handle both ObjectId and populated object cases
        const reportingManagerId = request.reportingManagerId?._id 
          ? request.reportingManagerId._id.toString() 
          : request.reportingManagerId?.toString();
        
        if (!reportingManagerId || reportingManagerId !== managerEmployee._id.toString()) {
          return NextResponse.json({ error: 'Unauthorized - Not your team member' }, { status: 403 });
        }
        // Manager can view but not edit - this is handled in the frontend
      } else {
        // Other roles cannot access
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    // Get submission if exists
    const submission = await OnboardingSubmission.findOne({
      onboardingRequestId: request._id,
    });

    return NextResponse.json({
      request,
      submission,
    });
  } catch (error) {
    console.error('Error fetching onboarding request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update onboarding request (HR actions: approve, reject, request changes)
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
    const body = await req.json();
    const { action, ...updateData } = body;

    await connectDB();

    const request = await OnboardingRequest.findById(id);
    if (!request) {
      return NextResponse.json({ error: 'Onboarding request not found' }, { status: 404 });
    }

    let createdByUserId: mongoose.Types.ObjectId;
    if (session.user.id) {
      createdByUserId = new mongoose.Types.ObjectId(session.user.id);
    } else {
      const user = await User.findOne({ email: session.user.email });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      createdByUserId = user._id;
    }

    // Handle different actions
    if (action === 'approve') {
      if (request.status !== 'submitted' && request.status !== 'changes_requested') {
        return NextResponse.json(
          { error: 'Can only approve submitted onboarding requests' },
          { status: 400 }
        );
      }

      const submission = await OnboardingSubmission.findOne({
        onboardingRequestId: request._id,
      });

      if (!submission || submission.isDraft) {
        return NextResponse.json(
          { error: 'Onboarding submission not found or not submitted' },
          { status: 400 }
        );
      }

      // Validate all required steps are completed
      const allStepsCompleted = Object.values(submission.stepsCompleted).every((completed) => completed);
      if (!allStepsCompleted) {
        return NextResponse.json(
          { error: 'All onboarding steps must be completed before approval' },
          { status: 400 }
        );
      }

      // Check if employee already exists
      let employee = await Employee.findOne({ email: request.email.toLowerCase() });
      let employeeId: string;
      let isNewEmployee = false;

      if (employee) {
        // Employee already exists - update it
        employeeId = employee.employeeId;
        employee.name = `${submission.personalDetails?.fullName || request.firstName} ${request.lastName}`;
        employee.role = submission.employmentDetails?.designation || request.designation || employee.role;
        employee.managerId = submission.employmentDetails?.reportingManagerId || request.reportingManagerId || employee.managerId;
        employee.isActive = true;
        await employee.save();
      } else {
        // Create new Employee record
        employeeId = await generateEmployeeId();
        employee = await Employee.create({
          employeeId,
          name: `${submission.personalDetails?.fullName || request.firstName} ${request.lastName}`,
          email: request.email.toLowerCase(),
          role: submission.employmentDetails?.designation || request.designation || 'Employee',
          managerId: submission.employmentDetails?.reportingManagerId || request.reportingManagerId || null,
          isActive: true,
        });
        isNewEmployee = true;
      }

      // Check if user already exists
      let user = await User.findOne({ email: request.email.toLowerCase() });
      let defaultPassword: string;

      if (user) {
        // User already exists - update it to link to employee
        user.employeeId = employee._id;
        user.isActive = true;
        
        // Update role if needed
        let userRole: 'employee' | 'manager' | 'hr' | 'super_admin' = user.role;
        const roleLower = (submission.employmentDetails?.designation || '').toLowerCase();
        if (roleLower.includes('admin') || roleLower.includes('super')) {
          userRole = 'super_admin';
        } else if (roleLower.includes('hr') || roleLower.includes('human resource')) {
          userRole = 'hr';
        } else if (roleLower.includes('manager') || roleLower.includes('mgr')) {
          userRole = 'manager';
        }
        user.role = userRole;
        await user.save();
        
        // Don't generate new password if user already exists
        defaultPassword = 'Already set';
      } else {
        // Create User account with random 7-digit password
        defaultPassword = Math.floor(1000000 + Math.random() * 9000000).toString(); // Random 7-digit number
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);

        // Determine user role
        let userRole: 'employee' | 'manager' | 'hr' | 'super_admin' = 'employee';
        const roleLower = (submission.employmentDetails?.designation || '').toLowerCase();
        if (roleLower.includes('admin') || roleLower.includes('super')) {
          userRole = 'super_admin';
        } else if (roleLower.includes('hr') || roleLower.includes('human resource')) {
          userRole = 'hr';
        } else if (roleLower.includes('manager') || roleLower.includes('mgr')) {
          userRole = 'manager';
        }

        user = await User.create({
          email: request.email.toLowerCase(),
          password: hashedPassword,
          role: userRole,
          employeeId: employee._id,
          isActive: true,
        });
      }

      // Create Salary Structure if compensation data exists and employee is new
      // (Don't overwrite existing salary structure)
      if (submission.compensationPayroll && isNewEmployee) {
        // Check if salary structure already exists
        const existingSalaryStructure = await SalaryStructure.findOne({
          employeeId: employee._id,
          isActive: true,
        });

        if (!existingSalaryStructure) {
          const comp = submission.compensationPayroll;
          const monthlySalary = comp.annualCTC / 12;

          await SalaryStructure.create({
            employeeId: employee._id,
            grossMonthlySalary: monthlySalary,
            workingDaysRule: 'shift_based', // Default, can be updated later
            paidLeaveTypes: ['paid', 'sick', 'casual', 'annual'],
            unpaidLeaveTypes: ['unpaid'],
            halfDayDeductionRule: 'half_day',
            effectiveFrom: new Date(request.dateOfJoining),
            version: 1,
            isActive: true,
            createdBy: createdByUserId,
          });
        }
      }

      // Create Leave Balances for current year (only if employee is new)
      if (isNewEmployee) {
        const currentYear = new Date().getFullYear();
        const leaveTypes = ['paid', 'unpaid', 'sick', 'casual', 'annual'];
        const leaveBalances = {
          paid: 12,
          unpaid: 0,
          sick: 10,
          casual: 8,
          annual: 20,
        };

        // Check if leave balances already exist for this year
        const existingBalances = await LeaveBalance.find({
          employeeId: employee._id,
          year: currentYear,
        });

        if (existingBalances.length === 0) {
          for (const leaveType of leaveTypes) {
            await LeaveBalance.create({
              employeeId: employee._id,
              leaveType: leaveType as any,
              totalDays: leaveBalances[leaveType as keyof typeof leaveBalances],
              usedDays: 0,
              availableDays: leaveBalances[leaveType as keyof typeof leaveBalances],
              year: currentYear,
              lastUpdatedBy: createdByUserId,
              lastUpdatedAt: new Date(),
            });
          }
        }
      }

      // Store request ID before deletion (needed for audit and notification)
      const requestId = request._id.toString();

      // Link the submission to the employee before deleting the request
      // This preserves the onboarding data for display on employee details page
      if (submission) {
        // Ensure employeeId is set as ObjectId
        const employeeIdStr = employee._id.toString();
        const employeeObjectId = new mongoose.Types.ObjectId(employeeIdStr);
        
        // Use direct MongoDB collection.updateOne (Mongoose updateOne doesn't work for this field)
        await OnboardingSubmission.collection.updateOne(
          { _id: submission._id },
          { $set: { employeeId: employeeObjectId } }
        );
      } else {
        console.error('Onboarding submission not found for request:', request._id.toString());
      }

      // Create audit log before deletion
      await OnboardingAudit.create({
        onboardingRequestId: request._id,
        action: 'onboarding_approved',
        performedBy: createdByUserId,
        performedAt: new Date(),
        description: `Onboarding approved. Employee ID: ${employeeId} created.`,
        metadata: {
          employeeId: employee._id.toString(),
          userId: user._id.toString(),
          onboardingId: request.onboardingId,
        },
      });

      // Create notification for employee (if user account exists)
      try {
        const notificationMessage = isNewEmployee
          ? `Your onboarding has been approved. Your Employee ID is ${employeeId}. Default password: ${defaultPassword}`
          : `Your onboarding has been approved. Your Employee ID is ${employeeId}.`;
        
        await createNotification(
          user._id.toString(),
          'onboarding_approved',
          'Onboarding Approved',
          notificationMessage,
          '/dashboard/employee',
          requestId
        );
      } catch (error) {
        console.error('Error creating notification:', error);
        // Don't fail the approval if notification fails
      }

      // Delete the onboarding request (automatically after employee is created)
      // Note: We keep the submission linked to employeeId for display purposes
      await OnboardingRequest.findByIdAndDelete(request._id);

      return NextResponse.json({
        message: isNewEmployee
          ? 'Onboarding approved successfully. Employee and user account created.'
          : 'Onboarding approved successfully. Existing employee and user account updated.',
        employeeId,
        defaultPassword: isNewEmployee ? defaultPassword : 'Password already set',
        employee,
        isNewEmployee,
      });
    } else if (action === 'reject') {
      if (request.status !== 'submitted' && request.status !== 'changes_requested') {
        return NextResponse.json(
          { error: 'Can only reject submitted onboarding requests' },
          { status: 400 }
        );
      }

      if (!body.rejectionReason) {
        return NextResponse.json(
          { error: 'Rejection reason is required' },
          { status: 400 }
        );
      }

      request.status = 'rejected';
      request.reviewedBy = createdByUserId;
      request.rejectionReason = body.rejectionReason;
      await request.save();

      await OnboardingAudit.create({
        onboardingRequestId: request._id,
        action: 'onboarding_rejected',
        performedBy: createdByUserId,
        performedAt: new Date(),
        description: `Onboarding rejected: ${body.rejectionReason}`,
        metadata: {
          reason: body.rejectionReason,
        },
      });

      return NextResponse.json({
        message: 'Onboarding rejected successfully',
        request,
      });
    } else if (action === 'request_changes') {
      if (request.status !== 'submitted') {
        return NextResponse.json(
          { error: 'Can only request changes for submitted onboarding requests' },
          { status: 400 }
        );
      }

      if (!body.changeRequestComments) {
        return NextResponse.json(
          { error: 'Change request comments are required' },
          { status: 400 }
        );
      }

      request.status = 'changes_requested';
      request.reviewedBy = createdByUserId;
      request.changeRequestComments = body.changeRequestComments;
      await request.save();

      // Reset submission to draft so employee can edit
      const submission = await OnboardingSubmission.findOne({
        onboardingRequestId: request._id,
      });
      if (submission) {
        submission.isDraft = true;
        submission.submittedAt = undefined;
        await submission.save();
      }

      await OnboardingAudit.create({
        onboardingRequestId: request._id,
        action: 'changes_requested',
        performedBy: createdByUserId,
        performedAt: new Date(),
        description: `Changes requested: ${body.changeRequestComments}`,
        metadata: {
          comments: body.changeRequestComments,
        },
      });

      return NextResponse.json({
        message: 'Changes requested successfully',
        request,
      });
    } else if (action === 'regenerate_token') {
      // Regenerate token and extend expiry
      const newToken = generateOnboardingToken();
      const expiryDays = body.expiryDays || 30;
      const tokenExpiry = new Date();
      tokenExpiry.setDate(tokenExpiry.getDate() + expiryDays);

      request.token = newToken;
      request.tokenExpiry = tokenExpiry;
      await request.save();

      await OnboardingAudit.create({
        onboardingRequestId: request._id,
        action: 'token_regenerated',
        performedBy: createdByUserId,
        performedAt: new Date(),
        description: 'Onboarding token regenerated',
      });

      const onboardingLink = generateOnboardingLink(newToken);

      return NextResponse.json({
        message: 'Token regenerated successfully',
        onboardingLink,
        tokenExpiry,
      });
    } else {
      // Generic update
      const validatedData = updateOnboardingRequestSchema.parse(updateData);
      Object.assign(request, validatedData);
      await request.save();

      return NextResponse.json({
        message: 'Onboarding request updated successfully',
        request,
      });
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map((issue) => {
        const path = issue.path.join('.');
        return `${path}: ${issue.message}`;
      });
      return NextResponse.json(
        {
          error: errorMessages.join(', '),
          issues: error.issues,
        },
        { status: 400 }
      );
    }
    
    // Handle MongoDB duplicate key errors
    if (error.code === 11000 || error.codeName === 'DuplicateKey') {
      const duplicateField = Object.keys(error.keyPattern || {})[0] || 'field';
      return NextResponse.json(
        {
          error: `A record with this ${duplicateField} already exists. Please check if the employee or user already exists.`,
          duplicateField,
        },
        { status: 409 }
      );
    }
    
    console.error('Error updating onboarding request:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Helper function to generate unique employee ID (EMP + 5 random digits)
async function generateEmployeeId(): Promise<string> {
  const prefix = 'EMP';
  let attempts = 0;
  const maxAttempts = 100;
  
  while (attempts < maxAttempts) {
    // Generate random 5-digit number
    const randomDigits = Math.floor(10000 + Math.random() * 90000).toString();
    const employeeId = `${prefix}${randomDigits}`;
    
    // Check if this ID already exists
    const existing = await Employee.findOne({ employeeId });
    if (!existing) {
      return employeeId;
    }
    
    attempts++;
  }
  
  // Fallback: if we can't find a unique random ID, use timestamp-based approach
  const timestamp = Date.now().toString().slice(-5);
  return `${prefix}${timestamp}`;
}

// DELETE - Delete onboarding request
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

    const request = await OnboardingRequest.findById(id);
    if (!request) {
      return NextResponse.json({ error: 'Onboarding request not found' }, { status: 404 });
    }

    // Don't allow deletion if employee has already been created
    if (request.employeeId) {
      return NextResponse.json(
        { error: 'Cannot delete onboarding request. Employee has already been created from this request.' },
        { status: 400 }
      );
    }

    // Get User ID for audit (before deletion)
    let deletedByUserId: mongoose.Types.ObjectId;
    if (session.user.id) {
      deletedByUserId = new mongoose.Types.ObjectId(session.user.id);
    } else {
      const user = await User.findOne({ email: session.user.email });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      deletedByUserId = user._id;
    }

    // Store request info for audit log before deletion
    const requestInfo = {
      onboardingId: request.onboardingId,
      email: request.email,
      firstName: request.firstName,
      lastName: request.lastName,
    };

    // Delete related submission
    await OnboardingSubmission.deleteMany({ onboardingRequestId: request._id });

    // Create audit log before deleting the request (so we can reference the ID)
    await OnboardingAudit.create({
      onboardingRequestId: request._id,
      action: 'onboarding_deleted',
      performedBy: deletedByUserId,
      performedAt: new Date(),
      description: `Onboarding request deleted for ${requestInfo.firstName} ${requestInfo.lastName} (${requestInfo.email})`,
      metadata: {
        onboardingId: requestInfo.onboardingId,
        email: requestInfo.email,
      },
    });

    // Delete the onboarding request (this will cascade or we handle related data above)
    await OnboardingRequest.findByIdAndDelete(id);

    return NextResponse.json({ message: 'Onboarding request deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting onboarding request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
