import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Interview from '@/lib/models/Interview';
import Candidate from '@/lib/models/Candidate';
import JobRequisition from '@/lib/models/JobRequisition';
import User from '@/lib/models/User';
import { z } from 'zod';
import mongoose from 'mongoose';
import { generateInterviewId, calculateInterviewDuration } from '@/lib/utils/interview';
import InterviewAuditLog from '@/lib/models/InterviewAuditLog';

const createInterviewSchema = z.object({
  candidateId: z.string(),
  roundName: z.string().min(1),
  roundOrder: z.number().min(1),
  roundType: z.enum(['hr_screening', 'technical', 'managerial', 'hr_final', 'panel', 'custom']),
  scheduledStartTime: z.string(), // ISO date string
  scheduledEndTime: z.string(), // ISO date string
  mode: z.enum(['in_person', 'video', 'telephonic']),
  location: z.string().optional(),
  interviewLink: z.union([z.string().url(), z.literal('')]).optional().transform(val => val === '' ? undefined : val),
  meetingId: z.string().optional(),
  meetingPassword: z.string().optional(),
  interviewers: z.array(z.string()).min(1), // Array of User IDs
  primaryInterviewerId: z.string(),
  interviewNotes: z.string().optional(),
  feedbackDueDate: z.string().optional(), // ISO date string
});

const updateInterviewSchema = createInterviewSchema.partial().extend({
  status: z.enum(['scheduled', 'rescheduled', 'completed', 'cancelled', 'no_show', 'in_progress']).optional(),
  actualStartTime: z.string().optional(),
  actualEndTime: z.string().optional(),
  rescheduleReason: z.string().optional(),
  cancellationReason: z.string().optional(),
  noShowReason: z.string().optional(),
});

// GET - List all interviews
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const candidateId = searchParams.get('candidateId');
    const interviewerId = searchParams.get('interviewerId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query: any = {};

    // Role-based filtering
    if (session.user.role === 'employee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    } else if (session.user.role === 'manager') {
      // Managers see interviews for candidates in their job requisitions
      const jobReqs = await JobRequisition.find({
        hiringManagerId: session.user.employeeId,
        isActive: true,
      }).select('_id');
      const candidates = await Candidate.find({
        jobRequisitionId: { $in: jobReqs.map(jr => jr._id) },
        isActive: true,
      }).select('_id');
      query.candidateId = { $in: candidates.map(c => c._id) };
    } else if (session.user.role === 'hr' || session.user.role === 'super_admin') {
      // HR/Admin can see all interviews
    } else {
      // Interviewers see only their assigned interviews
      query.$or = [
        { primaryInterviewerId: session.user.id },
        { interviewers: session.user.id },
      ];
    }

    if (candidateId) {
      query.candidateId = candidateId;
    }

    if (interviewerId) {
      query.$or = [
        { primaryInterviewerId: interviewerId },
        { interviewers: interviewerId },
      ];
    }

    if (status) {
      query.status = status;
    }

    if (startDate && endDate) {
      query.scheduledStartTime = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else if (startDate) {
      query.scheduledStartTime = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.scheduledStartTime = { $lte: new Date(endDate) };
    }

    const interviews = await Interview.find(query)
      .populate('candidateId', 'firstName lastName email candidateId')
      .populate('jobRequisitionId', 'jobTitle department')
      .populate('interviewers', 'email')
      .populate('primaryInterviewerId', 'email')
      .populate('scheduledBy', 'email')
      .sort({ scheduledStartTime: 1 })
      .limit(200);

    return NextResponse.json(interviews);
  } catch (error) {
    console.error('Error fetching interviews:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Schedule new interview
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createInterviewSchema.parse(body);

    await connectDB();

    // Validate candidate exists
    const candidate = await Candidate.findById(validatedData.candidateId);
    if (!candidate || !candidate.isActive) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 400 });
    }

    // Validate job requisition
    const jobRequisition = await JobRequisition.findById(candidate.jobRequisitionId);
    if (!jobRequisition || !jobRequisition.isActive) {
      return NextResponse.json({ error: 'Job requisition not found' }, { status: 400 });
    }

    // Validate interview round exists in job requisition
    const roundTemplate = jobRequisition.interviewRounds.find(
      r => r.roundOrder === validatedData.roundOrder
    );
    if (!roundTemplate) {
      return NextResponse.json({ error: 'Invalid interview round' }, { status: 400 });
    }

    // Validate interviewers
    const interviewers = await User.find({
      _id: { $in: validatedData.interviewers },
      isActive: true,
    });
    if (interviewers.length !== validatedData.interviewers.length) {
      return NextResponse.json({ error: 'One or more interviewers not found' }, { status: 400 });
    }

    // Validate primary interviewer is in interviewers list
    if (!validatedData.interviewers.includes(validatedData.primaryInterviewerId)) {
      return NextResponse.json(
        { error: 'Primary interviewer must be in interviewers list' },
        { status: 400 }
      );
    }

    // Validate primary interviewer exists
    const primaryInterviewer = await User.findById(validatedData.primaryInterviewerId);
    if (!primaryInterviewer || !primaryInterviewer.isActive) {
      return NextResponse.json({ error: 'Primary interviewer not found' }, { status: 400 });
    }

    // Check for scheduling conflicts
    const scheduledStart = new Date(validatedData.scheduledStartTime);
    const scheduledEnd = new Date(validatedData.scheduledEndTime);

    // Check if any interviewer has a conflicting interview
    const interviewerQueries = validatedData.interviewers.map(interviewerId => ({
      $or: [
        { primaryInterviewerId: interviewerId },
        { interviewers: interviewerId },
      ],
    }));

    const conflictingInterviews = await Interview.find({
      $or: interviewerQueries,
      status: { $in: ['scheduled', 'rescheduled', 'in_progress'] },
      $and: [
        {
          scheduledStartTime: { $lt: scheduledEnd },
          scheduledEndTime: { $gt: scheduledStart },
        },
      ],
    });

    if (conflictingInterviews.length > 0) {
      return NextResponse.json(
        { error: 'One or more interviewers have a scheduling conflict' },
        { status: 400 }
      );
    }

    // Generate interview ID
    const currentYear = new Date().getFullYear();
    const count = await Interview.countDocuments({
      interviewId: new RegExp(`^INT-${currentYear}-`),
    });
    const interviewId = generateInterviewId(currentYear, count + 1);

    const interview = await Interview.create({
      interviewId,
      candidateId: validatedData.candidateId,
      jobRequisitionId: candidate.jobRequisitionId,
      roundName: validatedData.roundName,
      roundOrder: validatedData.roundOrder,
      roundType: validatedData.roundType,
      scheduledDate: new Date(scheduledStart.toDateString()),
      scheduledStartTime: scheduledStart,
      scheduledEndTime: scheduledEnd,
      mode: validatedData.mode,
      location: validatedData.location,
      interviewLink: validatedData.interviewLink,
      meetingId: validatedData.meetingId,
      meetingPassword: validatedData.meetingPassword,
      interviewers: validatedData.interviewers,
      primaryInterviewerId: validatedData.primaryInterviewerId,
      status: 'scheduled',
      feedbackDueDate: validatedData.feedbackDueDate ? new Date(validatedData.feedbackDueDate) : undefined,
      interviewNotes: validatedData.interviewNotes,
      scheduledBy: session.user.id,
      rescheduleCount: 0,
    });

    // Update candidate status to interview_scheduled (always update when interview is scheduled)
    const previousStatus = candidate.status;
    
    // Update status to interview_scheduled if not already in a later stage
    // Allow updating from: applied, screening, shortlisted, on_hold, interview_scheduled
    if (['applied', 'screening', 'shortlisted', 'on_hold', 'interview_scheduled'].includes(candidate.status)) {
      candidate.status = 'interview_scheduled';
    } else if (candidate.status === 'interview_in_progress') {
      // If already in progress, keep it as is (might be scheduling another round)
      // But update current stage
    } else {
      // For other statuses, still update the stage but don't change status
    }
    
    candidate.currentStage = validatedData.roundName;
    candidate.lastActivityAt = new Date();
    await candidate.save();

    // Create audit log
    await InterviewAuditLog.create({
      interviewId: interview._id,
      candidateId: candidate._id,
      jobRequisitionId: candidate.jobRequisitionId,
      action: 'interview_scheduled',
      actionDescription: `Interview ${interviewId} scheduled for ${candidate.firstName} ${candidate.lastName} - ${validatedData.roundName}`,
      performedBy: session.user.id,
      performedByRole: session.user.role === 'super_admin' ? 'super_admin' : 'hr',
      timestamp: new Date(),
    });

    const populated = await Interview.findById(interview._id)
      .populate('candidateId', 'firstName lastName email candidateId')
      .populate('jobRequisitionId', 'jobTitle department')
      .populate('interviewers', 'email')
      .populate('primaryInterviewerId', 'email')
      .populate('scheduledBy', 'email');

    return NextResponse.json(populated, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error creating interview:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update interview (reschedule, cancel, mark complete, etc.)
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Interview ID is required' }, { status: 400 });
    }

    const validatedData = updateInterviewSchema.parse(updateData);

    await connectDB();

    const interview = await Interview.findById(id);
    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    const candidate = await Candidate.findById(interview.candidateId);
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const previousStatus = interview.status;

    // Handle rescheduling
    if (validatedData.scheduledStartTime && validatedData.scheduledEndTime && previousStatus === 'scheduled') {
      const newStart = new Date(validatedData.scheduledStartTime);
      const newEnd = new Date(validatedData.scheduledEndTime);

      // Check for conflicts
      const interviewerQueries = interview.interviewers.map(interviewerId => ({
        $or: [
          { primaryInterviewerId: interviewerId },
          { interviewers: interviewerId },
        ],
      }));

      const conflictingInterviews = await Interview.find({
        _id: { $ne: interview._id },
        $or: interviewerQueries,
        status: { $in: ['scheduled', 'rescheduled', 'in_progress'] },
        $and: [
          {
            scheduledStartTime: { $lt: newEnd },
            scheduledEndTime: { $gt: newStart },
          },
        ],
      });

      if (conflictingInterviews.length > 0) {
        return NextResponse.json(
          { error: 'One or more interviewers have a scheduling conflict' },
          { status: 400 }
        );
      }

      interview.rescheduledFrom = interview.scheduledStartTime;
      interview.scheduledStartTime = newStart;
      interview.scheduledEndTime = newEnd;
      interview.scheduledDate = new Date(newStart.toDateString());
      interview.status = 'rescheduled';
      interview.rescheduleCount = (interview.rescheduleCount || 0) + 1;
      if (validatedData.rescheduleReason) {
        interview.rescheduleReason = validatedData.rescheduleReason;
      }

      await InterviewAuditLog.create({
        interviewId: interview._id,
        candidateId: candidate._id,
        jobRequisitionId: interview.jobRequisitionId,
        action: 'interview_rescheduled',
        actionDescription: `Interview rescheduled from ${interview.rescheduledFrom} to ${newStart}`,
        previousValue: interview.rescheduledFrom,
        newValue: newStart,
        performedBy: session.user.id,
        performedByRole: session.user.role === 'super_admin' ? 'super_admin' : session.user.role === 'hr' ? 'hr' : 'interviewer',
        timestamp: new Date(),
      });
    }

    // Handle cancellation
    if (validatedData.status === 'cancelled' && previousStatus !== 'cancelled') {
      interview.status = 'cancelled';
      interview.cancelledBy = new mongoose.Types.ObjectId(session.user.id);
      interview.cancelledAt = new Date();
      if (validatedData.cancellationReason) {
        interview.cancellationReason = validatedData.cancellationReason;
      }

      await InterviewAuditLog.create({
        interviewId: interview._id,
        candidateId: candidate._id,
        jobRequisitionId: interview.jobRequisitionId,
        action: 'interview_cancelled',
        actionDescription: `Interview cancelled: ${validatedData.cancellationReason || 'No reason provided'}`,
        performedBy: session.user.id,
        performedByRole: session.user.role === 'super_admin' ? 'super_admin' : session.user.role === 'hr' ? 'hr' : 'interviewer',
        timestamp: new Date(),
      });
    }

    // Handle completion
    if (validatedData.status === 'completed' && previousStatus !== 'completed') {
      interview.status = 'completed';
      if (validatedData.actualStartTime) {
        interview.actualStartTime = new Date(validatedData.actualStartTime);
      }
      if (validatedData.actualEndTime) {
        interview.actualEndTime = new Date(validatedData.actualEndTime);
        if (interview.actualStartTime) {
          interview.duration = calculateInterviewDuration(interview.actualStartTime, interview.actualEndTime);
        }
      }

      // Update candidate status to interview_completed
      // Check if candidate is in a valid state to transition to interview_completed
      if (candidate.status === 'interview_scheduled' || candidate.status === 'interview_in_progress') {
        candidate.status = 'interview_completed';
        candidate.lastActivityAt = new Date();
        await candidate.save();
      }

      await InterviewAuditLog.create({
        interviewId: interview._id,
        candidateId: candidate._id,
        jobRequisitionId: interview.jobRequisitionId,
        action: 'interview_completed',
        actionDescription: `Interview completed`,
        performedBy: session.user.id,
        performedByRole: session.user.role === 'super_admin' ? 'super_admin' : session.user.role === 'hr' ? 'hr' : 'interviewer',
        timestamp: new Date(),
      });
    }

    // Handle no-show
    if (validatedData.status === 'no_show' && previousStatus !== 'no_show') {
      interview.status = 'no_show';
      if (validatedData.noShowReason) {
        interview.noShowReason = validatedData.noShowReason;
      }

      await InterviewAuditLog.create({
        interviewId: interview._id,
        candidateId: candidate._id,
        jobRequisitionId: interview.jobRequisitionId,
        action: 'interview_no_show',
        actionDescription: `Interview marked as no-show: ${validatedData.noShowReason || 'No reason provided'}`,
        performedBy: session.user.id,
        performedByRole: session.user.role === 'super_admin' ? 'super_admin' : session.user.role === 'hr' ? 'hr' : 'interviewer',
        timestamp: new Date(),
      });
    }

    // Update other fields
    if (validatedData.interviewNotes !== undefined) interview.interviewNotes = validatedData.interviewNotes;
    if (validatedData.interviewLink) interview.interviewLink = validatedData.interviewLink;
    if (validatedData.meetingId) interview.meetingId = validatedData.meetingId;
    if (validatedData.meetingPassword) interview.meetingPassword = validatedData.meetingPassword;
    if (validatedData.location) interview.location = validatedData.location;

    await interview.save();

    const populated = await Interview.findById(interview._id)
      .populate('candidateId', 'firstName lastName email candidateId')
      .populate('jobRequisitionId', 'jobTitle department')
      .populate('interviewers', 'email')
      .populate('primaryInterviewerId', 'email')
      .populate('scheduledBy', 'email');

    return NextResponse.json(populated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error updating interview:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

