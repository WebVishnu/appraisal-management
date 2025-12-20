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

      // Create Employee record
      const employeeId = await generateEmployeeId();
      const employee = await Employee.create({
        employeeId,
        name: `${submission.personalDetails?.fullName || request.firstName} ${request.lastName}`,
        email: request.email,
        role: submission.employmentDetails?.designation || request.designation || 'Employee',
        managerId: submission.employmentDetails?.reportingManagerId || request.reportingManagerId || null,
        isActive: true,
      });

      // Create User account
      const defaultPassword = `${employeeId}@123`;
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

      const user = await User.create({
        email: request.email,
        password: hashedPassword,
        role: userRole,
        employeeId: employee._id,
        isActive: true,
      });

      // Create Salary Structure if compensation data exists
      if (submission.compensationPayroll) {
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

      // Create Leave Balances for current year
      const currentYear = new Date().getFullYear();
      const leaveTypes = ['paid', 'unpaid', 'sick', 'casual', 'annual'];
      const leaveBalances = {
        paid: 12,
        unpaid: 0,
        sick: 10,
        casual: 8,
        annual: 20,
      };

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

      // Update onboarding request
      request.status = 'approved';
      request.approvedAt = new Date();
      request.approvedBy = createdByUserId;
      request.employeeId = employee._id;
      request.userId = user._id;
      await request.save();

      // Create audit log
      await OnboardingAudit.create({
        onboardingRequestId: request._id,
        action: 'onboarding_approved',
        performedBy: createdByUserId,
        performedAt: new Date(),
        description: `Onboarding approved. Employee ID: ${employeeId} created.`,
        metadata: {
          employeeId: employee._id.toString(),
          userId: user._id.toString(),
        },
      });

      // Create notification for employee (if user account exists)
      try {
        await createNotification(
          user._id.toString(),
          'onboarding_approved',
          'Onboarding Approved',
          `Your onboarding has been approved. Your Employee ID is ${employeeId}. Default password: ${defaultPassword}`,
          '/dashboard/employee',
          request._id.toString()
        );
      } catch (error) {
        console.error('Error creating notification:', error);
        // Don't fail the approval if notification fails
      }

      return NextResponse.json({
        message: 'Onboarding approved successfully',
        employeeId,
        defaultPassword, // Share with HR to communicate to employee
        employee,
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
  } catch (error) {
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
    console.error('Error updating onboarding request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to generate unique employee ID
async function generateEmployeeId(): Promise<string> {
  const prefix = 'EMP';
  const currentYear = new Date().getFullYear().toString().slice(-2);
  
  // Find the latest employee ID with this prefix and year
  const latestEmployee = await Employee.findOne({
    employeeId: { $regex: `^${prefix}${currentYear}` },
  })
    .sort({ employeeId: -1 })
    .select('employeeId');

  let sequence = 1;
  if (latestEmployee) {
    const match = latestEmployee.employeeId.match(/\d+$/);
    if (match) {
      sequence = parseInt(match[0]) + 1;
    }
  }

  return `${prefix}${currentYear}${String(sequence).padStart(3, '0')}`;
}
