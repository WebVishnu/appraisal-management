import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Offer from '@/lib/models/Offer';
import Candidate from '@/lib/models/Candidate';
import JobRequisition from '@/lib/models/JobRequisition';
import Employee from '@/lib/models/Employee';
import User from '@/lib/models/User';
import { z } from 'zod';
import mongoose from 'mongoose';
import { generateOfferId, generateOfferToken, generateOfferLink, isOfferExpired } from '@/lib/utils/interview';
import InterviewAuditLog from '@/lib/models/InterviewAuditLog';
import { convertCandidateToOnboarding } from '@/lib/utils/candidate-conversion';

const compensationSchema = z.object({
  annualCTC: z.number().min(0),
  basicSalary: z.number().min(0),
  hra: z.number().min(0),
  specialAllowance: z.number().min(0),
  lta: z.number().min(0).default(0),
  medicalAllowance: z.number().min(0).default(0),
  performanceBonus: z.number().min(0).optional(),
  otherBenefits: z.number().min(0).optional(),
  currency: z.string().default('INR'),
});

const approvalWorkflowItemSchema = z.object({
  approverId: z.string(),
  approverRole: z.enum(['hr', 'manager', 'finance', 'super_admin']),
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  comments: z.string().optional(),
});

const createOfferSchema = z.object({
  candidateId: z.string(),
  jobTitle: z.string().min(1),
  department: z.string().min(1),
  location: z.string().min(1),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'intern']),
  startDate: z.string(), // ISO date string
  compensation: compensationSchema,
  benefits: z.array(z.string()).default([]),
  benefitsDescription: z.string().optional(),
  noticePeriod: z.number().min(0).optional(),
  probationPeriod: z.number().min(0).optional(),
  workTimings: z.string().optional(),
  workLocationDetails: z.string().optional(),
  offerValidUntil: z.string(), // ISO date string
  requiresApproval: z.boolean().default(true),
  approvalWorkflow: z.array(approvalWorkflowItemSchema).default([]),
  createOnboardingRequest: z.boolean().default(true), // Auto-create onboarding request
});

const updateOfferSchema = createOfferSchema.partial().extend({
  status: z.enum(['draft', 'pending_approval', 'approved', 'sent', 'accepted', 'rejected', 'expired', 'withdrawn']).optional(),
  candidateResponse: z.enum(['accepted', 'rejected', 'counter_offer']).optional(),
  candidateResponseComments: z.string().optional(),
  candidateCounterOffer: z.object({
    expectedCTC: z.number().min(0).optional(),
    comments: z.string().optional(),
  }).optional(),
  withdrawnReason: z.string().optional(),
});

// GET - List all offers
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin' && session.user.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const candidateId = searchParams.get('candidateId');
    const status = searchParams.get('status');
    const token = searchParams.get('token'); // For candidate offer acceptance link

    let query: any = {};

    // Role-based filtering
    if (session.user.role === 'manager' && session.user.employeeId) {
      // Managers see offers for their job requisitions
      const jobReqs = await JobRequisition.find({
        hiringManagerId: session.user.employeeId,
        isActive: true,
      }).select('_id');
      const candidates = await Candidate.find({
        jobRequisitionId: { $in: jobReqs.map(jr => jr._id) },
        isActive: true,
      }).select('_id');
      query.candidateId = { $in: candidates.map(c => c._id) };
    }

    if (candidateId) {
      query.candidateId = candidateId;
    }

    if (status) {
      query.status = status;
    }

    if (token) {
      // Public endpoint for offer acceptance (no auth required for this query)
      query.offerToken = token;
    }

    const offers = await Offer.find(query)
      .populate('candidateId', 'firstName lastName email candidateId')
      .populate('jobRequisitionId', 'jobTitle department')
      .populate('createdBy', 'email')
      .populate('createdFor', 'name email employeeId')
      .populate('approvedBy', 'email')
      .sort({ createdAt: -1 })
      .limit(100);

    return NextResponse.json(offers);
  } catch (error) {
    console.error('Error fetching offers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new offer
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createOfferSchema.parse(body);

    await connectDB();

    // Validate candidate exists and is in correct status
    const candidate = await Candidate.findById(validatedData.candidateId);
    if (!candidate || !candidate.isActive) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 400 });
    }

    if (candidate.status !== 'interview_completed' && candidate.status !== 'offer_pending') {
      return NextResponse.json(
        { error: `Candidate is not eligible for offer. Current status: ${candidate.status}` },
        { status: 400 }
      );
    }

    // Check if offer already exists for this candidate
    const existingOffer = await Offer.findOne({
      candidateId: validatedData.candidateId,
      status: { $in: ['draft', 'pending_approval', 'approved', 'sent'] },
    });

    if (existingOffer) {
      return NextResponse.json(
        { error: 'An active offer already exists for this candidate' },
        { status: 400 }
      );
    }

    // Validate job requisition
    const jobRequisition = await JobRequisition.findById(candidate.jobRequisitionId)
      .populate('hiringManagerId', 'name email employeeId isActive');
    if (!jobRequisition) {
      return NextResponse.json({ error: 'Job requisition not found' }, { status: 400 });
    }

    // Validate hiring manager
    if (!jobRequisition.hiringManagerId) {
      return NextResponse.json({ error: 'Job requisition does not have a hiring manager assigned' }, { status: 400 });
    }

    // Check if hiring manager was populated (exists in database)
    // If populate fails, it returns the ObjectId, not a populated object
    const populatedHiringManager = jobRequisition.hiringManagerId as any;
    const isPopulated = populatedHiringManager && typeof populatedHiringManager === 'object' && populatedHiringManager._id;
    
    let hiringManagerObjectId: mongoose.Types.ObjectId;
    try {
      // Get the ObjectId - either from populated object or from the ID itself
      if (isPopulated) {
        hiringManagerObjectId = populatedHiringManager._id;
        // If populated but inactive, we know the issue
        if (!populatedHiringManager.isActive) {
          return NextResponse.json({ 
            error: `Hiring manager is inactive. Employee: ${populatedHiringManager.name || 'Unknown'} (${populatedHiringManager.employeeId || 'N/A'})` 
          }, { status: 400 });
        }
      } else {
        // Not populated - get the ObjectId from the field
        // Type assertion needed because TypeScript doesn't know the type after populate
        const hiringManagerIdValue = jobRequisition.hiringManagerId as mongoose.Types.ObjectId | string;
        hiringManagerObjectId = hiringManagerIdValue instanceof mongoose.Types.ObjectId
          ? hiringManagerIdValue
          : new mongoose.Types.ObjectId(String(hiringManagerIdValue));
      }
    } catch (error) {
      console.error('Invalid hiring manager ID format:', jobRequisition.hiringManagerId);
      return NextResponse.json({ error: 'Invalid hiring manager ID format' }, { status: 400 });
    }

    // First check if Employee exists at all (for debugging)
    const hiringManagerCheck = await Employee.findById(hiringManagerObjectId);
    
    if (!hiringManagerCheck) {
      // Check if populate returned null (Employee was deleted)
      if (!isPopulated) {
        console.error('Hiring manager Employee does not exist (reference in JobRequisition points to deleted Employee):', {
          hiringManagerId: hiringManagerObjectId.toString(),
          jobRequisitionId: jobRequisition._id.toString(),
          candidateId: candidate._id.toString(),
          jobRequisitionTitle: jobRequisition.jobTitle,
        });
        return NextResponse.json({ 
          error: `Hiring manager Employee (ID: ${hiringManagerObjectId.toString()}) not found in database. The Employee may have been deleted. Please update the job requisition "${jobRequisition.jobTitle}" with a valid hiring manager.` 
        }, { status: 400 });
      }
      
      console.error('Hiring manager Employee does not exist:', {
        hiringManagerId: hiringManagerObjectId.toString(),
        jobRequisitionId: jobRequisition._id.toString(),
        candidateId: candidate._id.toString(),
      });
      return NextResponse.json({ 
        error: `Hiring manager Employee (ID: ${hiringManagerObjectId.toString()}) not found in database. Please ensure the Employee exists and is active.` 
      }, { status: 400 });
    }

    // Now check if Employee is active
    const hiringManager = await Employee.findOne({
      _id: hiringManagerObjectId,
      isActive: true,
    });
    
    if (!hiringManager) {
      console.error('Hiring manager found but inactive:', {
        hiringManagerId: hiringManagerObjectId.toString(),
        isActive: hiringManagerCheck.isActive,
        employeeId: hiringManagerCheck.employeeId,
        name: hiringManagerCheck.name,
        jobRequisitionId: jobRequisition._id.toString(),
        candidateId: candidate._id.toString(),
      });
      return NextResponse.json({ error: `Hiring manager is inactive. Employee: ${hiringManagerCheck.name} (${hiringManagerCheck.employeeId})` }, { status: 400 });
    }

    // Find the User associated with this Employee for approval workflow
    const hiringManagerUser = await User.findOne({
      employeeId: hiringManagerObjectId,
      status: 'active',
      $or: [
        { lockedUntil: null },
        { lockedUntil: { $lt: new Date() } }
      ],
    });

    if (!hiringManagerUser) {
      console.error('Hiring manager user account not found:', {
        employeeId: hiringManagerObjectId.toString(),
        hiringManagerName: hiringManager.name,
      });
      return NextResponse.json({ error: 'Hiring manager user account not found or inactive' }, { status: 400 });
    }

    // Generate offer ID and token
    const currentYear = new Date().getFullYear();
    const count = await Offer.countDocuments({
      offerId: new RegExp(`^OFF-${currentYear}-`),
    });
    const offerId = generateOfferId(currentYear, count + 1);
    const offerToken = generateOfferToken();

    // Set approval workflow if required
    let approvalWorkflow = validatedData.approvalWorkflow;
    let initialStatus: 'pending_approval' | 'approved' = 'pending_approval';
    
    if (validatedData.requiresApproval && (!approvalWorkflow || approvalWorkflow.length === 0)) {
      // Default workflow: HR -> Hiring Manager -> Finance (if applicable)
      approvalWorkflow = [
        {
          approverId: session.user.id,
          approverRole: 'hr',
          status: 'approved' as const, // Creator auto-approves
        },
        {
          approverId: hiringManagerUser._id.toString(),
          approverRole: 'manager',
          status: 'pending' as const,
        },
      ];
      
      // Check if all approvers are already approved (HR-only approval scenario)
      const allApproved = approvalWorkflow.every(item => item.status === 'approved');
      if (allApproved) {
        initialStatus = 'approved';
      }
    } else if (!validatedData.requiresApproval) {
      // No approval required
      initialStatus = 'approved';
      approvalWorkflow = [];
    } else if (approvalWorkflow && approvalWorkflow.length > 0) {
      // Custom workflow provided - check if all are already approved
      const allApproved = approvalWorkflow.every(item => item.status === 'approved');
      if (allApproved) {
        initialStatus = 'approved';
      }
    }

    const offer = await Offer.create({
      offerId,
      offerToken,
      candidateId: validatedData.candidateId,
      jobRequisitionId: candidate.jobRequisitionId,
      jobTitle: validatedData.jobTitle,
      department: validatedData.department,
      location: validatedData.location,
      employmentType: validatedData.employmentType,
      startDate: new Date(validatedData.startDate),
      compensation: validatedData.compensation,
      benefits: validatedData.benefits,
      benefitsDescription: validatedData.benefitsDescription,
      noticePeriod: validatedData.noticePeriod,
      probationPeriod: validatedData.probationPeriod,
      workTimings: validatedData.workTimings,
      workLocationDetails: validatedData.workLocationDetails,
      offerValidUntil: new Date(validatedData.offerValidUntil),
      requiresApproval: validatedData.requiresApproval,
      approvalWorkflow: approvalWorkflow,
      status: initialStatus, // Use the calculated status
      createdBy: session.user.id,
      createdFor: hiringManager._id,
    });

    // If already approved, set approvedAt and add to approvedBy array
    if (initialStatus === 'approved') {
      offer.approvedAt = new Date();
      const userId = new mongoose.Types.ObjectId(session.user.id);
      if (!offer.approvedBy.some(id => id.toString() === userId.toString())) {
        offer.approvedBy.push(userId);
      }
      await offer.save();
    }

    // Update candidate status
    candidate.status = 'offer_pending';
    candidate.lastActivityAt = new Date();
    await candidate.save();

    // Create audit log
    await InterviewAuditLog.create({
      offerId: offer._id,
      candidateId: candidate._id,
      jobRequisitionId: candidate.jobRequisitionId,
      action: 'offer_created',
      actionDescription: `Offer ${offerId} created for ${candidate.firstName} ${candidate.lastName}`,
      performedBy: session.user.id,
      performedByRole: session.user.role === 'super_admin' ? 'super_admin' : 'hr',
      timestamp: new Date(),
    });

    // Auto-create onboarding request if requested
    let onboardingRequestId = null;
    if (validatedData.createOnboardingRequest) {
      try {
        const result = await convertCandidateToOnboarding(candidate, offer);
        onboardingRequestId = result.onboardingRequest._id.toString();
        
        // Create audit log
        await InterviewAuditLog.create({
          candidateId: candidate._id,
          offerId: offer._id,
          onboardingRequestId: result.onboardingRequest._id,
          jobRequisitionId: candidate.jobRequisitionId,
          action: 'onboarding_request_created',
          actionDescription: `Onboarding request ${result.onboardingRequest.onboardingId} created automatically with offer`,
          performedBy: session.user.id,
          performedByRole: session.user.role === 'super_admin' ? 'super_admin' : 'hr',
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('Error creating onboarding request:', error);
        // Don't fail the offer creation if onboarding fails
      }
    }

    const populated = await Offer.findById(offer._id)
      .populate('candidateId', 'firstName lastName email candidateId')
      .populate('jobRequisitionId', 'jobTitle department')
      .populate('createdBy', 'email')
      .populate('createdFor', 'name email employeeId');

    if (!populated) {
      return NextResponse.json({ error: 'Offer not found after creation' }, { status: 500 });
    }

    const responseData: any = populated.toObject();
    if (onboardingRequestId) {
      responseData.onboardingRequestId = onboardingRequestId;
    }

    return NextResponse.json(responseData, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error creating offer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update offer (approve, send, accept, reject)
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();

    const body = await req.json();
    const { id, token, ...updateData } = body;

    // For offer acceptance via token (public endpoint)
    if (token) {
      await connectDB();
      const offer = await Offer.findOne({ offerToken: token });
      if (!offer) {
        return NextResponse.json({ error: 'Invalid offer token' }, { status: 404 });
      }

      // Check if offer is expired
      if (isOfferExpired(offer.offerValidUntil)) {
        offer.status = 'expired';
        await offer.save();
        return NextResponse.json({ error: 'Offer has expired' }, { status: 400 });
      }

      const validatedData = z.object({
        candidateResponse: z.enum(['accepted', 'rejected', 'counter_offer']),
        candidateResponseComments: z.string().optional(),
        candidateCounterOffer: z.object({
          expectedCTC: z.number().min(0).optional(),
          comments: z.string().optional(),
        }).optional(),
      }).parse(updateData);

      const previousStatus = offer.status;

      if (validatedData.candidateResponse === 'accepted') {
        offer.status = 'accepted';
        offer.candidateResponse = 'accepted';
        offer.candidateResponseComments = validatedData.candidateResponseComments;
        offer.offerAcceptedAt = new Date();

        // Update candidate status
        const candidate = await Candidate.findById(offer.candidateId);
        if (candidate) {
          candidate.status = 'offer_accepted';
          candidate.lastActivityAt = new Date();
          await candidate.save();

          // Convert to onboarding
          await convertCandidateToOnboarding(candidate, offer);
        }

        await InterviewAuditLog.create({
          offerId: offer._id,
          candidateId: offer.candidateId,
          jobRequisitionId: offer.jobRequisitionId,
          action: 'offer_accepted',
          actionDescription: 'Offer accepted by candidate',
          previousValue: previousStatus,
          newValue: 'accepted',
          performedByRole: 'candidate',
          timestamp: new Date(),
        });
      } else if (validatedData.candidateResponse === 'rejected') {
        offer.status = 'rejected';
        offer.candidateResponse = 'rejected';
        offer.candidateResponseComments = validatedData.candidateResponseComments;
        offer.offerRejectedAt = new Date();

        const candidate = await Candidate.findById(offer.candidateId);
        if (candidate) {
          candidate.status = 'offer_rejected';
          candidate.lastActivityAt = new Date();
          await candidate.save();
        }

        await InterviewAuditLog.create({
          offerId: offer._id,
          candidateId: offer.candidateId,
          jobRequisitionId: offer.jobRequisitionId,
          action: 'offer_rejected',
          actionDescription: 'Offer rejected by candidate',
          previousValue: previousStatus,
          newValue: 'rejected',
          performedByRole: 'candidate',
          timestamp: new Date(),
        });
      } else if (validatedData.candidateResponse === 'counter_offer') {
        offer.candidateResponse = 'counter_offer';
        offer.candidateResponseComments = validatedData.candidateResponseComments;
        offer.candidateCounterOffer = validatedData.candidateCounterOffer;
      }

      await offer.save();

      const populated = await Offer.findById(offer._id)
        .populate('candidateId', 'firstName lastName email candidateId')
        .populate('jobRequisitionId', 'jobTitle department');

      return NextResponse.json(populated);
    }

    // Regular update (requires auth)
    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin' && session.user.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: 'Offer ID is required' }, { status: 400 });
    }

    const validatedData = updateOfferSchema.parse(updateData);

    await connectDB();

    const offer = await Offer.findById(id);
    if (!offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    const previousStatus = offer.status;

    // Handle approval
    if (validatedData.status === 'approved' && previousStatus === 'pending_approval') {
      // Check if user is in approval workflow
      const workflowItem = offer.approvalWorkflow.find(
        item => item.approverId.toString() === session.user.id && item.status === 'pending'
      );

      if (!workflowItem && session.user.role !== 'super_admin') {
        return NextResponse.json({ error: 'You are not authorized to approve this offer' }, { status: 403 });
      }

      if (workflowItem) {
        workflowItem.status = 'approved';
        workflowItem.approvedAt = new Date();
      }

      // Check if all approvals are complete
      const allApproved = offer.approvalWorkflow.every(item => item.status === 'approved');
      if (allApproved) {
        offer.status = 'approved';
        offer.approvedAt = new Date();
        const userId = new mongoose.Types.ObjectId(session.user.id);
        if (!offer.approvedBy.some(id => id.toString() === userId.toString())) {
          offer.approvedBy.push(userId);
        }

        await InterviewAuditLog.create({
          offerId: offer._id,
          candidateId: offer.candidateId,
          jobRequisitionId: offer.jobRequisitionId,
          action: 'offer_approved',
          actionDescription: 'Offer approved',
          previousValue: previousStatus,
          newValue: 'approved',
          performedBy: session.user.id,
          performedByRole: session.user.role === 'super_admin' ? 'super_admin' : session.user.role === 'hr' ? 'hr' : 'manager',
          timestamp: new Date(),
        });
      }
    }

    // Handle sending offer
    if (validatedData.status === 'sent' && previousStatus === 'approved') {
      offer.status = 'sent';
      offer.offerSentAt = new Date();

      const candidate = await Candidate.findById(offer.candidateId);
      if (candidate) {
        candidate.status = 'offer_sent';
        candidate.lastActivityAt = new Date();
        await candidate.save();
      }

      await InterviewAuditLog.create({
        offerId: offer._id,
        candidateId: offer.candidateId,
        jobRequisitionId: offer.jobRequisitionId,
        action: 'offer_sent',
        actionDescription: 'Offer sent to candidate',
        previousValue: previousStatus,
        newValue: 'sent',
        performedBy: session.user.id,
        performedByRole: session.user.role === 'super_admin' ? 'super_admin' : 'hr',
        timestamp: new Date(),
      });
    }

    // Handle withdrawal
    if (validatedData.status === 'withdrawn' && previousStatus !== 'withdrawn') {
      offer.status = 'withdrawn';
      offer.withdrawnBy = new mongoose.Types.ObjectId(session.user.id);
      offer.withdrawnAt = new Date();
      if (updateData.withdrawnReason) {
        offer.withdrawnReason = updateData.withdrawnReason;
      }

      const candidate = await Candidate.findById(offer.candidateId);
      if (candidate) {
        candidate.status = 'rejected';
        candidate.lastActivityAt = new Date();
        await candidate.save();
      }

      // Delete associated onboarding request and submission if they exist
      if (offer.convertedToOnboardingRequestId) {
        try {
          const OnboardingRequest = (await import('@/lib/models/OnboardingRequest')).default;
          const OnboardingSubmission = (await import('@/lib/models/OnboardingSubmission')).default;
          
          const onboardingRequestId = offer.convertedToOnboardingRequestId;
          
          // Delete onboarding submission first (if exists)
          await OnboardingSubmission.deleteOne({ onboardingRequestId: onboardingRequestId });
          
          // Delete onboarding request
          await OnboardingRequest.deleteOne({ _id: onboardingRequestId });
          
          // Update candidate to remove onboarding request reference
          if (candidate) {
            candidate.onboardingRequestId = undefined;
            await candidate.save();
          }

          await InterviewAuditLog.create({
            offerId: offer._id,
            candidateId: offer.candidateId,
            onboardingRequestId: onboardingRequestId,
            jobRequisitionId: offer.jobRequisitionId,
            action: 'onboarding_deleted',
            actionDescription: `Onboarding request deleted due to offer withdrawal`,
            performedBy: session.user.id,
            performedByRole: session.user.role === 'super_admin' ? 'super_admin' : 'hr',
            timestamp: new Date(),
          });
        } catch (error) {
          console.error('Error deleting onboarding request:', error);
          // Don't fail withdrawal if onboarding deletion fails
        }
      }

      await InterviewAuditLog.create({
        offerId: offer._id,
        candidateId: offer.candidateId,
        jobRequisitionId: offer.jobRequisitionId,
        action: 'offer_withdrawn',
        actionDescription: updateData.withdrawnReason 
          ? `Offer withdrawn: ${updateData.withdrawnReason}`
          : 'Offer withdrawn',
        previousValue: previousStatus,
        newValue: 'withdrawn',
        performedBy: session.user.id,
        performedByRole: session.user.role === 'super_admin' ? 'super_admin' : 'hr',
        timestamp: new Date(),
      });
    }

    // Update other fields
    if (validatedData.compensation) offer.compensation = validatedData.compensation;
    if (validatedData.benefits) offer.benefits = validatedData.benefits;
    if (validatedData.benefitsDescription !== undefined) offer.benefitsDescription = validatedData.benefitsDescription;
    if (validatedData.noticePeriod !== undefined) offer.noticePeriod = validatedData.noticePeriod;
    if (validatedData.probationPeriod !== undefined) offer.probationPeriod = validatedData.probationPeriod;
    if (validatedData.workTimings) offer.workTimings = validatedData.workTimings;
    if (validatedData.workLocationDetails) offer.workLocationDetails = validatedData.workLocationDetails;
    if (validatedData.offerValidUntil) offer.offerValidUntil = new Date(validatedData.offerValidUntil);

    await offer.save();

    const populated = await Offer.findById(offer._id)
      .populate('candidateId', 'firstName lastName email candidateId')
      .populate('jobRequisitionId', 'jobTitle department')
      .populate('createdBy', 'email')
      .populate('createdFor', 'name email employeeId')
      .populate('approvedBy', 'email');

    return NextResponse.json(populated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error updating offer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

