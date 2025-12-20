import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import JobRequisition from '@/lib/models/JobRequisition';
import Employee from '@/lib/models/Employee';
import { z } from 'zod';
import mongoose from 'mongoose';
import { generateJobRequisitionId } from '@/lib/utils/interview';
import InterviewAuditLog from '@/lib/models/InterviewAuditLog';

const evaluationCriterionSchema = z.object({
  criterion: z.string().min(1),
  weightage: z.number().min(1).max(100),
  description: z.string().optional(),
});

const interviewRoundSchema = z.object({
  roundName: z.string().min(1),
  roundOrder: z.number().min(1),
  roundType: z.enum(['hr_screening', 'technical', 'managerial', 'hr_final', 'panel', 'custom']),
  requiredInterviewers: z.number().min(1).default(1),
  evaluationCriteria: z.array(evaluationCriterionSchema).default([]),
  passingScore: z.number().min(0).max(100).optional(),
  isMandatory: z.boolean().default(true),
});

const createJobRequisitionSchema = z.object({
  jobTitle: z.string().min(1),
  department: z.string().min(1),
  location: z.string().min(1),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'intern']),
  description: z.string().min(1),
  requirements: z.string().min(1),
  responsibilities: z.string().optional(),
  requiredSkills: z.array(z.string()).default([]),
  preferredSkills: z.array(z.string()).default([]),
  experienceRange: z.object({
    min: z.number().min(0),
    max: z.number().min(0).optional(),
  }),
  hiringManagerId: z.string(),
  recruiterId: z.string().optional(),
  numberOfPositions: z.number().min(1).default(1),
  interviewRounds: z.array(interviewRoundSchema).min(1),
  postedDate: z.string().optional(),
  closingDate: z.string().optional(),
  expectedStartDate: z.string().optional(),
  salaryRange: z.object({
    min: z.number().min(0),
    max: z.number().min(0).optional(),
    currency: z.string().default('INR'),
  }).optional(),
});

const updateJobRequisitionSchema = createJobRequisitionSchema.partial().extend({
  status: z.enum(['open', 'on_hold', 'closed', 'cancelled']).optional(),
});

// GET - List all job requisitions
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin' && session.user.role !== 'manager')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const department = searchParams.get('department');
    const hiringManagerId = searchParams.get('hiringManagerId');

    let query: any = { isActive: true };

    // Role-based filtering
    if (session.user.role === 'manager' && session.user.employeeId) {
      query.hiringManagerId = session.user.employeeId;
    }

    if (status) {
      query.status = status;
    }

    if (department) {
      query.department = department;
    }

    if (hiringManagerId) {
      query.hiringManagerId = hiringManagerId;
    }

    const jobRequisitions = await JobRequisition.find(query)
      .populate('hiringManagerId', 'name email employeeId')
      .populate('recruiterId', 'email')
      .populate('createdBy', 'email')
      .sort({ createdAt: -1 });

    return NextResponse.json(jobRequisitions);
  } catch (error) {
    console.error('Error fetching job requisitions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new job requisition
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createJobRequisitionSchema.parse(body);

    await connectDB();

    // Validate hiring manager exists
    const hiringManager = await Employee.findById(validatedData.hiringManagerId);
    if (!hiringManager || !hiringManager.isActive) {
      return NextResponse.json({ error: 'Hiring manager not found or inactive' }, { status: 400 });
    }

    // Validate recruiter if provided
    if (validatedData.recruiterId) {
      const User = (await import('@/lib/models/User')).default;
      const recruiter = await User.findById(validatedData.recruiterId);
      if (!recruiter || (recruiter.role !== 'hr' && recruiter.role !== 'super_admin')) {
        return NextResponse.json({ error: 'Invalid recruiter' }, { status: 400 });
      }
    }

    // Generate job requisition ID
    const currentYear = new Date().getFullYear();
    const count = await JobRequisition.countDocuments({
      jobRequisitionId: new RegExp(`^REQ-${currentYear}-`),
    });
    const jobRequisitionId = generateJobRequisitionId(currentYear, count + 1);

    // Validate interview rounds order
    const roundOrders = validatedData.interviewRounds.map(r => r.roundOrder).sort((a, b) => a - b);
    if (roundOrders[0] !== 1 || !roundOrders.every((val, idx) => val === idx + 1)) {
      return NextResponse.json(
        { error: 'Interview rounds must have sequential order starting from 1' },
        { status: 400 }
      );
    }

    const jobRequisition = await JobRequisition.create({
      jobRequisitionId,
      jobTitle: validatedData.jobTitle,
      department: validatedData.department,
      location: validatedData.location,
      employmentType: validatedData.employmentType,
      description: validatedData.description,
      requirements: validatedData.requirements,
      responsibilities: validatedData.responsibilities,
      requiredSkills: validatedData.requiredSkills,
      preferredSkills: validatedData.preferredSkills,
      experienceRange: validatedData.experienceRange,
      hiringManagerId: validatedData.hiringManagerId,
      recruiterId: validatedData.recruiterId,
      numberOfPositions: validatedData.numberOfPositions,
      interviewRounds: validatedData.interviewRounds,
      postedDate: validatedData.postedDate ? new Date(validatedData.postedDate) : new Date(),
      closingDate: validatedData.closingDate ? new Date(validatedData.closingDate) : undefined,
      expectedStartDate: validatedData.expectedStartDate ? new Date(validatedData.expectedStartDate) : undefined,
      salaryRange: validatedData.salaryRange,
      status: 'open',
      createdBy: session.user.id,
      isActive: true,
    });

    // Create audit log
    await InterviewAuditLog.create({
      jobRequisitionId: new mongoose.Types.ObjectId(jobRequisition._id),
      action: 'candidate_created',
      actionDescription: `Job requisition ${jobRequisitionId} created for ${validatedData.jobTitle}`,
      performedBy: session.user.id,
      performedByRole: session.user.role === 'super_admin' ? 'super_admin' : 'hr',
      timestamp: new Date(),
    });

    const populated = await JobRequisition.findById(jobRequisition._id)
      .populate('hiringManagerId', 'name email employeeId')
      .populate('recruiterId', 'email')
      .populate('createdBy', 'email');

    return NextResponse.json(populated, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error creating job requisition:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update job requisition
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Job requisition ID is required' }, { status: 400 });
    }

    const validatedData = updateJobRequisitionSchema.parse(updateData);

    await connectDB();

    const jobRequisition = await JobRequisition.findById(id);
    if (!jobRequisition || !jobRequisition.isActive) {
      return NextResponse.json({ error: 'Job requisition not found' }, { status: 404 });
    }

    // Validate hiring manager if provided
    if (validatedData.hiringManagerId) {
      const hiringManager = await Employee.findById(validatedData.hiringManagerId);
      if (!hiringManager || !hiringManager.isActive) {
        return NextResponse.json({ error: 'Hiring manager not found or inactive' }, { status: 400 });
      }
      jobRequisition.hiringManagerId = new mongoose.Types.ObjectId(validatedData.hiringManagerId);
    }

    // Update fields
    if (validatedData.jobTitle) jobRequisition.jobTitle = validatedData.jobTitle;
    if (validatedData.department) jobRequisition.department = validatedData.department;
    if (validatedData.location) jobRequisition.location = validatedData.location;
    if (validatedData.employmentType) jobRequisition.employmentType = validatedData.employmentType;
    if (validatedData.description) jobRequisition.description = validatedData.description;
    if (validatedData.requirements) jobRequisition.requirements = validatedData.requirements;
    if (validatedData.responsibilities !== undefined) jobRequisition.responsibilities = validatedData.responsibilities;
    if (validatedData.requiredSkills) jobRequisition.requiredSkills = validatedData.requiredSkills;
    if (validatedData.preferredSkills) jobRequisition.preferredSkills = validatedData.preferredSkills;
    if (validatedData.experienceRange) jobRequisition.experienceRange = validatedData.experienceRange;
    if (validatedData.numberOfPositions) jobRequisition.numberOfPositions = validatedData.numberOfPositions;
    if (validatedData.interviewRounds) {
      // Validate round order
      const roundOrders = validatedData.interviewRounds.map(r => r.roundOrder).sort((a, b) => a - b);
      if (roundOrders[0] !== 1 || !roundOrders.every((val, idx) => val === idx + 1)) {
        return NextResponse.json(
          { error: 'Interview rounds must have sequential order starting from 1' },
          { status: 400 }
        );
      }
      jobRequisition.interviewRounds = validatedData.interviewRounds;
    }
    if (validatedData.status) {
      const previousStatus = jobRequisition.status;
      jobRequisition.status = validatedData.status;
      
      // Create audit log for status change
      await InterviewAuditLog.create({
        jobRequisitionId: jobRequisition._id,
        action: 'candidate_status_changed',
        actionDescription: `Job requisition status changed from ${previousStatus} to ${validatedData.status}`,
        previousValue: previousStatus,
        newValue: validatedData.status,
        performedBy: session.user.id,
        performedByRole: session.user.role === 'super_admin' ? 'super_admin' : 'hr',
        timestamp: new Date(),
      });
    }
    if (validatedData.postedDate) jobRequisition.postedDate = new Date(validatedData.postedDate);
    if (validatedData.closingDate) jobRequisition.closingDate = new Date(validatedData.closingDate);
    if (validatedData.expectedStartDate) jobRequisition.expectedStartDate = new Date(validatedData.expectedStartDate);
    if (validatedData.salaryRange) jobRequisition.salaryRange = validatedData.salaryRange;

    await jobRequisition.save();

    const populated = await JobRequisition.findById(jobRequisition._id)
      .populate('hiringManagerId', 'name email employeeId')
      .populate('recruiterId', 'email')
      .populate('createdBy', 'email');

    return NextResponse.json(populated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error updating job requisition:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

