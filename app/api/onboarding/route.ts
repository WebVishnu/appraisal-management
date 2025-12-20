import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import OnboardingRequest from '@/lib/models/OnboardingRequest';
import OnboardingSubmission from '@/lib/models/OnboardingSubmission';
import OnboardingAudit from '@/lib/models/OnboardingAudit';
import Employee from '@/lib/models/Employee';
import { z } from 'zod';
import mongoose from 'mongoose';
import {
  generateOnboardingToken,
  generateOnboardingId,
  generateOnboardingLink,
} from '@/lib/utils/onboarding';
import { createNotification } from '@/lib/utils/notifications';

const createOnboardingRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  personalEmail: z.string().email('Invalid personal email').optional(),
  mobileNumber: z.string().optional(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfJoining: z.string().min(1, 'Date of joining is required'),
  department: z.string().optional(),
  designation: z.string().optional(),
  reportingManagerId: z.string().optional(),
  workLocation: z.string().optional(),
  requiresManagerAck: z.boolean().default(false),
  expiryDays: z.number().min(1).max(90).default(30), // Token expiry in days
  hrNotes: z.string().optional(),
});

// GET - List onboarding requests (HR/Admin only)
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const department = searchParams.get('department');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    const query: any = {};

    if (status) {
      query.status = status;
    }

    if (department) {
      query.department = department;
    }

    if (startDate && endDate) {
      query.dateOfJoining = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { onboardingId: { $regex: search, $options: 'i' } },
      ];
    }

    const requests = await OnboardingRequest.find(query)
      .populate('invitedBy', 'email name')
      .populate('reviewedBy', 'email name')
      .populate('approvedBy', 'email name')
      .populate('reportingManagerId', 'name employeeId email')
      .populate('employeeId', 'name employeeId email')
      .sort({ createdAt: -1 })
      .limit(100);

    // Populate candidate and offer information for hiring pipeline integration
    const Candidate = (await import('@/lib/models/Candidate')).default;
    const Offer = (await import('@/lib/models/Offer')).default;
    
    const requestsWithCandidateData = await Promise.all(
      requests.map(async (request) => {
        const requestObj: any = request.toObject();
        
        // Find candidate by onboardingRequestId
        const candidate = await Candidate.findOne({
          onboardingRequestId: request._id,
          isActive: true,
        }).populate('jobRequisitionId', 'jobTitle department');
        
        if (candidate) {
          requestObj.candidateId = candidate._id.toString();
          requestObj.source = 'hiring_pipeline';
          requestObj.candidate = {
            _id: candidate._id.toString(),
            candidateId: candidate.candidateId,
            jobRequisitionId: candidate.jobRequisitionId && typeof candidate.jobRequisitionId === 'object' && '_id' in candidate.jobRequisitionId ? {
              _id: (candidate.jobRequisitionId as any)._id.toString(),
              jobTitle: (candidate.jobRequisitionId as any).jobTitle,
              department: (candidate.jobRequisitionId as any).department,
            } : undefined,
          };
          
          // Find offer for this candidate
          const offer = await Offer.findOne({
            candidateId: candidate._id,
            status: 'accepted',
          }).select('offerId compensation');
          
          if (offer) {
            requestObj.offerId = offer._id.toString();
            requestObj.offer = {
              _id: offer._id.toString(),
              offerId: offer.offerId,
              compensation: offer.compensation,
            };
          }
        } else {
          requestObj.source = 'manual';
        }
        
        return requestObj;
      })
    );

    // Get counts by status
    const statusCounts = await OnboardingRequest.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const counts = statusCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      requests: requestsWithCandidateData,
      counts,
    });
  } catch (error) {
    console.error('Error fetching onboarding requests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create onboarding request (HR/Admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();
    const validatedData = createOnboardingRequestSchema.parse(body);

    // Check if onboarding already exists for this email
    const existing = await OnboardingRequest.findOne({
      email: validatedData.email.toLowerCase(),
      status: { $in: ['invited', 'in_progress', 'submitted', 'changes_requested'] },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'An active onboarding request already exists for this email' },
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

    // Generate onboarding ID
    const currentYear = new Date().getFullYear();
    const count = await OnboardingRequest.countDocuments({
      onboardingId: { $regex: `^ONB-${currentYear}-` },
    });
    const onboardingId = generateOnboardingId(currentYear, count + 1);

    // Generate secure token
    const token = generateOnboardingToken();
    const tokenExpiry = new Date();
    tokenExpiry.setDate(tokenExpiry.getDate() + (validatedData.expiryDays || 30));

    // Calculate expiry date (onboarding deadline)
    const expiryDate = new Date(validatedData.dateOfJoining);
    expiryDate.setDate(expiryDate.getDate() + 7); // 7 days after joining date

    // Verify reporting manager if provided
    if (validatedData.reportingManagerId) {
      const manager = await Employee.findById(validatedData.reportingManagerId);
      if (!manager || !manager.isActive) {
        return NextResponse.json({ error: 'Reporting manager not found or inactive' }, { status: 400 });
      }
    }

    const onboardingRequest = await OnboardingRequest.create({
      onboardingId,
      token,
      tokenExpiry,
      email: validatedData.email.toLowerCase(),
      personalEmail: validatedData.personalEmail?.toLowerCase(),
      mobileNumber: validatedData.mobileNumber,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      dateOfJoining: new Date(validatedData.dateOfJoining),
      department: validatedData.department,
      designation: validatedData.designation,
      reportingManagerId: validatedData.reportingManagerId
        ? new mongoose.Types.ObjectId(validatedData.reportingManagerId)
        : null,
      workLocation: validatedData.workLocation,
      status: 'invited',
      progressPercentage: 0,
      invitedBy: createdByUserId,
      requiresManagerAck: validatedData.requiresManagerAck || false,
      expiryDate,
      hrNotes: validatedData.hrNotes,
      reminderCount: 0,
    });

    // Create audit log
    await OnboardingAudit.create({
      onboardingRequestId: onboardingRequest._id,
      action: 'onboarding_created',
      performedBy: createdByUserId,
      performedAt: new Date(),
      description: `Onboarding request created for ${validatedData.firstName} ${validatedData.lastName} (${validatedData.email})`,
      metadata: {
        onboardingId,
        email: validatedData.email,
      },
    });

    // Create initial submission record
    await OnboardingSubmission.create({
      onboardingRequestId: onboardingRequest._id,
      stepsCompleted: {
        personalDetails: false,
        addressDetails: false,
        identityKYC: false,
        employmentDetails: false,
        compensationPayroll: false,
        statutoryTax: false,
        educationDetails: false,
        previousEmployment: false,
        emergencyContact: false,
        policiesDeclarations: false,
      },
      isDraft: true,
      lastSavedAt: new Date(),
    });

    // Populate for response
    await onboardingRequest.populate('invitedBy', 'email name');
    await onboardingRequest.populate('reportingManagerId', 'name employeeId email');

    // Generate onboarding link
    const onboardingLink = generateOnboardingLink(token);

    return NextResponse.json(
      {
        message: 'Onboarding request created successfully',
        onboarding: onboardingRequest,
        onboardingLink, // Include link for HR to send
      },
      { status: 201 }
    );
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
    console.error('Error creating onboarding request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
