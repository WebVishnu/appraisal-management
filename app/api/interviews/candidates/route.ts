import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Candidate from '@/lib/models/Candidate';
import JobRequisition from '@/lib/models/JobRequisition';
import Employee from '@/lib/models/Employee';
import { z } from 'zod';
import mongoose from 'mongoose';
import { generateCandidateId } from '@/lib/utils/interview';
import InterviewAuditLog from '@/lib/models/InterviewAuditLog';

const createCandidateSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phoneNumber: z.string().min(1),
  alternatePhoneNumber: z.string().optional(),
  jobRequisitionId: z.string(),
  source: z.enum(['linkedin', 'referral', 'career_page', 'job_board', 'naukri', 'indeed', 'direct', 'campus', 'consultant', 'other']),
  referredBy: z.string().optional(),
  resumeUrl: z.string().url().optional(),
  coverLetterUrl: z.string().url().optional(),
  portfolioUrl: z.string().url().optional(),
  linkedinUrl: z.string().url().optional(),
  githubUrl: z.string().url().optional(),
  currentCompany: z.string().optional(),
  currentDesignation: z.string().optional(),
  totalExperience: z.number().min(0).optional(),
  currentCTC: z.number().min(0).optional(),
  expectedCTC: z.number().min(0).optional(),
  noticePeriod: z.number().min(0).default(0),
  assignedRecruiterId: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

const updateCandidateSchema = createCandidateSchema.partial().extend({
  status: z.enum([
    'applied',
    'screening',
    'shortlisted',
    'interview_scheduled',
    'interview_in_progress',
    'interview_completed',
    'offer_pending',
    'offer_sent',
    'offer_accepted',
    'offer_rejected',
    'offer_expired',
    'selected',
    'rejected',
    'withdrawn',
    'on_hold',
  ]).optional(),
  currentStage: z.string().optional(),
  overallScore: z.number().min(0).max(100).optional(),
});

// GET - List all candidates
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin' && session.user.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const jobRequisitionId = searchParams.get('jobRequisitionId');
    const recruiterId = searchParams.get('recruiterId');
    const search = searchParams.get('search'); // Search by name or email

    let query: any = { isActive: true };

    // Role-based filtering
    if (session.user.role === 'manager' && session.user.employeeId) {
      // Managers see candidates for their job requisitions
      const jobReqs = await JobRequisition.find({
        hiringManagerId: session.user.employeeId,
        isActive: true,
      }).select('_id');
      query.jobRequisitionId = { $in: jobReqs.map(jr => jr._id) };
    } else if (session.user.role === 'hr' && recruiterId && recruiterId === session.user.id) {
      // HR can filter by assigned recruiter
      query.assignedRecruiterId = recruiterId;
    }

    if (status) {
      // Handle comma-separated statuses
      const statusArray = status.split(',').map(s => s.trim());
      if (statusArray.length === 1) {
        query.status = statusArray[0];
      } else {
        query.status = { $in: statusArray };
      }
    }

    if (jobRequisitionId) {
      query.jobRequisitionId = jobRequisitionId;
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { candidateId: { $regex: search, $options: 'i' } },
      ];
    }

    const candidates = await Candidate.find(query)
      .populate('jobRequisitionId', 'jobTitle department')
      .populate('assignedRecruiterId', 'email')
      .populate('referredBy', 'name email employeeId')
      .sort({ lastActivityAt: -1, createdAt: -1 })
      .limit(100);

    return NextResponse.json(candidates);
  } catch (error) {
    console.error('Error fetching candidates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new candidate
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createCandidateSchema.parse(body);

    await connectDB();

    // Validate job requisition exists and is open
    const jobRequisition = await JobRequisition.findById(validatedData.jobRequisitionId);
    if (!jobRequisition || !jobRequisition.isActive) {
      return NextResponse.json({ error: 'Job requisition not found or inactive' }, { status: 400 });
    }

    if (jobRequisition.status !== 'open') {
      return NextResponse.json({ error: 'Job requisition is not open for applications' }, { status: 400 });
    }

    // Check if candidate with same email already exists for this job
    const existingCandidate = await Candidate.findOne({
      email: validatedData.email.toLowerCase(),
      jobRequisitionId: validatedData.jobRequisitionId,
      isActive: true,
    });

    if (existingCandidate) {
      return NextResponse.json(
        { error: 'Candidate with this email already applied for this position' },
        { status: 400 }
      );
    }

    // Validate referredBy if provided
    if (validatedData.referredBy) {
      const referrer = await Employee.findById(validatedData.referredBy);
      if (!referrer || !referrer.isActive) {
        return NextResponse.json({ error: 'Referrer not found or inactive' }, { status: 400 });
      }
    }

    // Validate assigned recruiter if provided
    if (validatedData.assignedRecruiterId) {
      const User = (await import('@/lib/models/User')).default;
      const recruiter = await User.findById(validatedData.assignedRecruiterId);
      if (!recruiter || (recruiter.role !== 'hr' && recruiter.role !== 'super_admin')) {
        return NextResponse.json({ error: 'Invalid recruiter' }, { status: 400 });
      }
    }

    // Generate candidate ID
    const currentYear = new Date().getFullYear();
    const count = await Candidate.countDocuments({
      candidateId: new RegExp(`^CAN-${currentYear}-`),
    });
    const candidateId = generateCandidateId(currentYear, count + 1);

    const candidate = await Candidate.create({
      candidateId,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      email: validatedData.email.toLowerCase(),
      phoneNumber: validatedData.phoneNumber,
      alternatePhoneNumber: validatedData.alternatePhoneNumber,
      jobRequisitionId: validatedData.jobRequisitionId,
      appliedPosition: jobRequisition.jobTitle,
      source: validatedData.source,
      referredBy: validatedData.referredBy,
      resumeUrl: validatedData.resumeUrl,
      coverLetterUrl: validatedData.coverLetterUrl,
      portfolioUrl: validatedData.portfolioUrl,
      linkedinUrl: validatedData.linkedinUrl,
      githubUrl: validatedData.githubUrl,
      currentCompany: validatedData.currentCompany,
      currentDesignation: validatedData.currentDesignation,
      totalExperience: validatedData.totalExperience,
      currentCTC: validatedData.currentCTC,
      expectedCTC: validatedData.expectedCTC,
      noticePeriod: validatedData.noticePeriod,
      status: 'applied',
      assignedRecruiterId: validatedData.assignedRecruiterId || session.user.id,
      notes: validatedData.notes,
      tags: validatedData.tags,
      appliedAt: new Date(),
      lastActivityAt: new Date(),
      isActive: true,
    });

    // Create audit log
    await InterviewAuditLog.create({
      candidateId: candidate._id,
      jobRequisitionId: new mongoose.Types.ObjectId(candidate.jobRequisitionId),
      action: 'candidate_created',
      actionDescription: `Candidate ${candidateId} created for position ${jobRequisition.jobTitle}`,
      performedBy: session.user.id,
      performedByRole: session.user.role === 'super_admin' ? 'super_admin' : 'hr',
      timestamp: new Date(),
    });

    const populated = await Candidate.findById(candidate._id)
      .populate('jobRequisitionId', 'jobTitle department')
      .populate('assignedRecruiterId', 'email')
      .populate('referredBy', 'name email employeeId');

    return NextResponse.json(populated, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error creating candidate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update candidate
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Candidate ID is required' }, { status: 400 });
    }

    const validatedData = updateCandidateSchema.parse(updateData);

    await connectDB();

    const candidate = await Candidate.findById(id);
    if (!candidate || !candidate.isActive) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    // Track status change for audit
    const previousStatus = candidate.status;

    // Update fields
    if (validatedData.firstName) candidate.firstName = validatedData.firstName;
    if (validatedData.lastName) candidate.lastName = validatedData.lastName;
    if (validatedData.email) candidate.email = validatedData.email.toLowerCase();
    if (validatedData.phoneNumber) candidate.phoneNumber = validatedData.phoneNumber;
    if (validatedData.alternatePhoneNumber !== undefined) candidate.alternatePhoneNumber = validatedData.alternatePhoneNumber;
    if (validatedData.source) candidate.source = validatedData.source;
    if (validatedData.referredBy) candidate.referredBy = new mongoose.Types.ObjectId(validatedData.referredBy);
    if (validatedData.resumeUrl) candidate.resumeUrl = validatedData.resumeUrl;
    if (validatedData.coverLetterUrl) candidate.coverLetterUrl = validatedData.coverLetterUrl;
    if (validatedData.portfolioUrl) candidate.portfolioUrl = validatedData.portfolioUrl;
    if (validatedData.linkedinUrl) candidate.linkedinUrl = validatedData.linkedinUrl;
    if (validatedData.githubUrl) candidate.githubUrl = validatedData.githubUrl;
    if (validatedData.currentCompany !== undefined) candidate.currentCompany = validatedData.currentCompany;
    if (validatedData.currentDesignation !== undefined) candidate.currentDesignation = validatedData.currentDesignation;
    if (validatedData.totalExperience !== undefined) candidate.totalExperience = validatedData.totalExperience;
    if (validatedData.currentCTC !== undefined) candidate.currentCTC = validatedData.currentCTC;
    if (validatedData.expectedCTC !== undefined) candidate.expectedCTC = validatedData.expectedCTC;
    if (validatedData.noticePeriod !== undefined) candidate.noticePeriod = validatedData.noticePeriod;
    if (validatedData.assignedRecruiterId) candidate.assignedRecruiterId = new mongoose.Types.ObjectId(validatedData.assignedRecruiterId);
    if (validatedData.notes !== undefined) candidate.notes = validatedData.notes;
    if (validatedData.tags) candidate.tags = validatedData.tags;
    if (validatedData.status) {
      candidate.status = validatedData.status;
      candidate.lastActivityAt = new Date();
    }
    if (validatedData.currentStage !== undefined) candidate.currentStage = validatedData.currentStage;
    if (validatedData.overallScore !== undefined) candidate.overallScore = validatedData.overallScore;

    await candidate.save();

    // Create audit log for status change
    if (validatedData.status && validatedData.status !== previousStatus) {
      await InterviewAuditLog.create({
        candidateId: candidate._id,
        jobRequisitionId: new mongoose.Types.ObjectId(candidate.jobRequisitionId),
        action: 'candidate_status_changed',
        actionDescription: `Candidate status changed from ${previousStatus} to ${validatedData.status}`,
        previousValue: previousStatus,
        newValue: validatedData.status,
        performedBy: session.user.id,
        performedByRole: session.user.role === 'super_admin' ? 'super_admin' : 'hr',
        timestamp: new Date(),
      });
    }

    const populated = await Candidate.findById(candidate._id)
      .populate('jobRequisitionId', 'jobTitle department')
      .populate('assignedRecruiterId', 'email')
      .populate('referredBy', 'name email employeeId');

    return NextResponse.json(populated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error updating candidate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

