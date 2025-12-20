import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import InterviewFeedback from '@/lib/models/InterviewFeedback';
import Interview from '@/lib/models/Interview';
import Candidate from '@/lib/models/Candidate';
import JobRequisition from '@/lib/models/JobRequisition';
import { z } from 'zod';
import mongoose from 'mongoose';
import InterviewAuditLog from '@/lib/models/InterviewAuditLog';
import { calculateOverallScore } from '@/lib/utils/interview';

const criterionRatingSchema = z.object({
  criterion: z.string().min(1),
  rating: z.number().min(1).max(5),
  comments: z.string().optional(),
  weightage: z.number().min(1).max(100),
});

const keyQuestionSchema = z.object({
  question: z.string().min(1),
  response: z.string().min(1),
  interviewerNotes: z.string().optional(),
});

const createFeedbackSchema = z.object({
  interviewId: z.string(),
  technicalSkillsRating: z.number().min(1).max(5),
  technicalSkillsComments: z.string().optional(),
  problemSolvingRating: z.number().min(1).max(5),
  problemSolvingComments: z.string().optional(),
  communicationRating: z.number().min(1).max(5),
  communicationComments: z.string().optional(),
  cultureFitRating: z.number().min(1).max(5),
  cultureFitComments: z.string().optional(),
  overallRecommendation: z.enum(['strong_yes', 'yes', 'hold', 'no']),
  overallComments: z.string().min(1),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  criterionRatings: z.array(criterionRatingSchema).default([]),
  keyQuestions: z.array(keyQuestionSchema).default([]),
  recommendation: z.enum(['hire', 'maybe', 'reject']),
  confidenceLevel: z.enum(['high', 'medium', 'low']).default('medium'),
  interviewerNotes: z.string().optional(),
  candidateFeedback: z.string().optional(),
});

const updateFeedbackSchema = createFeedbackSchema.partial().extend({
  isSubmitted: z.boolean().optional(),
});

// GET - Get feedback for interviews
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const interviewId = searchParams.get('interviewId');
    const candidateId = searchParams.get('candidateId');
    const interviewerId = searchParams.get('interviewerId');
    const submitted = searchParams.get('submitted'); // 'true' or 'false'

    let query: any = {};

    // Role-based access
    if (session.user.role === 'employee') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Interviewers can only see their own feedback
    if (session.user.role !== 'hr' && session.user.role !== 'super_admin' && session.user.role !== 'manager') {
      query.interviewerId = session.user.id;
    }

    if (interviewId) {
      query.interviewId = interviewId;
    }

    if (candidateId) {
      query.candidateId = candidateId;
    }

    if (interviewerId) {
      query.interviewerId = interviewerId;
    }

    if (submitted === 'true') {
      query.isSubmitted = true;
    } else if (submitted === 'false') {
      query.isSubmitted = false;
    }

    const feedbacks = await InterviewFeedback.find(query)
      .populate('interviewId', 'interviewId roundName roundOrder scheduledStartTime')
      .populate('candidateId', 'firstName lastName email candidateId')
      .populate('interviewerId', 'email')
      .populate('jobRequisitionId', 'jobTitle')
      .sort({ submittedAt: -1, createdAt: -1 })
      .limit(100);

    return NextResponse.json(feedbacks);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create or update feedback (draft)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = createFeedbackSchema.parse(body);

    await connectDB();

    // Validate interview exists
    const interview = await Interview.findById(validatedData.interviewId);
    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 400 });
    }

    // Check if user is assigned as interviewer
    const isInterviewer = interview.interviewers.some(
      id => id.toString() === session.user.id
    ) || interview.primaryInterviewerId.toString() === session.user.id;

    if (!isInterviewer && session.user.role !== 'hr' && session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'You are not assigned as an interviewer for this interview' }, { status: 403 });
    }

    // Check if feedback already exists
    const existingFeedback = await InterviewFeedback.findOne({
      interviewId: validatedData.interviewId,
      interviewerId: session.user.id,
    });

    const candidate = await Candidate.findById(interview.candidateId);
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 400 });
    }

    const jobRequisition = await JobRequisition.findById(interview.jobRequisitionId);
    if (!jobRequisition) {
      return NextResponse.json({ error: 'Job requisition not found' }, { status: 400 });
    }

    let feedback;
    if (existingFeedback) {
      // Update existing feedback (only if not submitted)
      if (existingFeedback.isSubmitted) {
        return NextResponse.json({ error: 'Feedback has already been submitted and cannot be modified' }, { status: 400 });
      }

      existingFeedback.technicalSkillsRating = validatedData.technicalSkillsRating as 1 | 2 | 3 | 4 | 5;
      existingFeedback.technicalSkillsComments = validatedData.technicalSkillsComments;
      existingFeedback.problemSolvingRating = validatedData.problemSolvingRating as 1 | 2 | 3 | 4 | 5;
      existingFeedback.problemSolvingComments = validatedData.problemSolvingComments;
      existingFeedback.communicationRating = validatedData.communicationRating as 1 | 2 | 3 | 4 | 5;
      existingFeedback.communicationComments = validatedData.communicationComments;
      existingFeedback.cultureFitRating = validatedData.cultureFitRating as 1 | 2 | 3 | 4 | 5;
      existingFeedback.cultureFitComments = validatedData.cultureFitComments;
      // Calculate overall score
      let overallScore: number;
      if (validatedData.criterionRatings && validatedData.criterionRatings.length > 0) {
        let totalWeightedScore = 0;
        let totalWeight = 0;
        validatedData.criterionRatings.forEach((cr) => {
          const normalizedScore = ((cr.rating - 1) / 4) * 100;
          totalWeightedScore += normalizedScore * (cr.weightage / 100);
          totalWeight += cr.weightage / 100;
        });
        overallScore = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0;
      } else {
        const avgRating = (
          validatedData.technicalSkillsRating +
          validatedData.problemSolvingRating +
          validatedData.communicationRating +
          validatedData.cultureFitRating
        ) / 4;
        overallScore = Math.round(((avgRating - 1) / 4) * 100);
      }

      existingFeedback.overallRecommendation = validatedData.overallRecommendation;
      existingFeedback.overallScore = overallScore;
      existingFeedback.overallComments = validatedData.overallComments;
      existingFeedback.strengths = validatedData.strengths;
      existingFeedback.weaknesses = validatedData.weaknesses;
      existingFeedback.criterionRatings = validatedData.criterionRatings.map(cr => ({
        ...cr,
        rating: cr.rating as 1 | 2 | 3 | 4 | 5,
      }));
      existingFeedback.keyQuestions = validatedData.keyQuestions;
      existingFeedback.recommendation = validatedData.recommendation;
      existingFeedback.confidenceLevel = validatedData.confidenceLevel;
      existingFeedback.interviewerNotes = validatedData.interviewerNotes;
      existingFeedback.candidateFeedback = validatedData.candidateFeedback;
      existingFeedback.version = (existingFeedback.version || 1) + 1;
      existingFeedback.lastSavedAt = new Date();

      await existingFeedback.save();
      feedback = existingFeedback;
    } else {
      // Calculate overall score from ratings
      let overallScore: number;
      if (validatedData.criterionRatings && validatedData.criterionRatings.length > 0) {
        // Calculate weighted average from criterion ratings
        let totalWeightedScore = 0;
        let totalWeight = 0;
        
        validatedData.criterionRatings.forEach((cr) => {
          // Convert 1-5 rating to 0-100 scale (1=0, 2=25, 3=50, 4=75, 5=100)
          const normalizedScore = ((cr.rating - 1) / 4) * 100;
          totalWeightedScore += normalizedScore * (cr.weightage / 100);
          totalWeight += cr.weightage / 100;
        });
        
        if (totalWeight > 0) {
          overallScore = Math.round(totalWeightedScore / totalWeight);
        } else {
          overallScore = 0;
        }
      } else {
        // Fallback: Calculate from individual ratings
        const avgRating = (
          validatedData.technicalSkillsRating +
          validatedData.problemSolvingRating +
          validatedData.communicationRating +
          validatedData.cultureFitRating
        ) / 4;
        // Convert 1-5 to 0-100 scale
        overallScore = Math.round(((avgRating - 1) / 4) * 100);
      }

      // Create new feedback
      feedback = await InterviewFeedback.create({
        interviewId: validatedData.interviewId,
        candidateId: interview.candidateId,
        interviewerId: session.user.id,
        jobRequisitionId: interview.jobRequisitionId,
        roundName: interview.roundName,
        roundOrder: interview.roundOrder,
        technicalSkillsRating: validatedData.technicalSkillsRating as 1 | 2 | 3 | 4 | 5,
        technicalSkillsComments: validatedData.technicalSkillsComments,
        problemSolvingRating: validatedData.problemSolvingRating as 1 | 2 | 3 | 4 | 5,
        problemSolvingComments: validatedData.problemSolvingComments,
        communicationRating: validatedData.communicationRating as 1 | 2 | 3 | 4 | 5,
        communicationComments: validatedData.communicationComments,
        cultureFitRating: validatedData.cultureFitRating as 1 | 2 | 3 | 4 | 5,
        cultureFitComments: validatedData.cultureFitComments,
        overallRecommendation: validatedData.overallRecommendation,
        overallScore: overallScore,
        overallComments: validatedData.overallComments,
        strengths: validatedData.strengths,
        weaknesses: validatedData.weaknesses,
        criterionRatings: validatedData.criterionRatings.map(cr => ({
          ...cr,
          rating: cr.rating as 1 | 2 | 3 | 4 | 5,
        })),
        keyQuestions: validatedData.keyQuestions,
        recommendation: validatedData.recommendation,
        confidenceLevel: validatedData.confidenceLevel,
        interviewerNotes: validatedData.interviewerNotes,
        candidateFeedback: validatedData.candidateFeedback,
        isSubmitted: false,
        version: 1,
        lastSavedAt: new Date(),
      });
    }

    const populated = await InterviewFeedback.findById(feedback._id)
      .populate('interviewId', 'interviewId roundName roundOrder')
      .populate('candidateId', 'firstName lastName email candidateId')
      .populate('interviewerId', 'email')
      .populate('jobRequisitionId', 'jobTitle');

    return NextResponse.json(populated, { status: existingFeedback ? 200 : 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error creating/updating feedback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Submit feedback (final submission)
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { interviewId, ...updateData } = body;

    if (!interviewId) {
      return NextResponse.json({ error: 'Interview ID is required' }, { status: 400 });
    }

    const validatedData = updateFeedbackSchema.parse(updateData);

    await connectDB();

    // Find feedback
    const feedback = await InterviewFeedback.findOne({
      interviewId,
      interviewerId: session.user.id,
    });

    if (!feedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }

    // Check if already submitted
    if (feedback.isSubmitted && !validatedData.isSubmitted) {
      return NextResponse.json({ error: 'Feedback has already been submitted and cannot be modified' }, { status: 400 });
    }

    // Update fields if provided
    if (validatedData.technicalSkillsRating !== undefined) feedback.technicalSkillsRating = validatedData.technicalSkillsRating as 1 | 2 | 3 | 4 | 5;
    if (validatedData.technicalSkillsComments !== undefined) feedback.technicalSkillsComments = validatedData.technicalSkillsComments;
    if (validatedData.problemSolvingRating !== undefined) feedback.problemSolvingRating = validatedData.problemSolvingRating as 1 | 2 | 3 | 4 | 5;
    if (validatedData.problemSolvingComments !== undefined) feedback.problemSolvingComments = validatedData.problemSolvingComments;
    if (validatedData.communicationRating !== undefined) feedback.communicationRating = validatedData.communicationRating as 1 | 2 | 3 | 4 | 5;
    if (validatedData.communicationComments !== undefined) feedback.communicationComments = validatedData.communicationComments;
    if (validatedData.cultureFitRating !== undefined) feedback.cultureFitRating = validatedData.cultureFitRating as 1 | 2 | 3 | 4 | 5;
    if (validatedData.cultureFitComments !== undefined) feedback.cultureFitComments = validatedData.cultureFitComments;
    if (validatedData.overallRecommendation !== undefined) feedback.overallRecommendation = validatedData.overallRecommendation;
    if (validatedData.overallComments !== undefined) feedback.overallComments = validatedData.overallComments;
    if (validatedData.strengths) feedback.strengths = validatedData.strengths;
    if (validatedData.weaknesses) feedback.weaknesses = validatedData.weaknesses;
    if (validatedData.criterionRatings) feedback.criterionRatings = validatedData.criterionRatings.map(cr => ({
      ...cr,
      rating: cr.rating as 1 | 2 | 3 | 4 | 5,
    }));
    if (validatedData.keyQuestions) feedback.keyQuestions = validatedData.keyQuestions;
    if (validatedData.recommendation !== undefined) feedback.recommendation = validatedData.recommendation;
    if (validatedData.confidenceLevel !== undefined) feedback.confidenceLevel = validatedData.confidenceLevel;
    if (validatedData.interviewerNotes !== undefined) feedback.interviewerNotes = validatedData.interviewerNotes;
    if (validatedData.candidateFeedback !== undefined) feedback.candidateFeedback = validatedData.candidateFeedback;

    // Submit feedback
    if (validatedData.isSubmitted === true && !feedback.isSubmitted) {
      feedback.isSubmitted = true;
      feedback.submittedAt = new Date();

      // Update interview feedback status
      const interview = await Interview.findById(interviewId);
      if (interview) {
        const userId = new mongoose.Types.ObjectId(session.user.id);
        if (!interview.feedbackSubmittedBy.some(id => id.toString() === userId.toString())) {
          interview.feedbackSubmittedBy.push(userId);
        }

        // Check if all interviewers have submitted feedback
        const allInterviewers = [...interview.interviewers.map(id => id.toString()), interview.primaryInterviewerId.toString()];
        const uniqueInterviewers = [...new Set(allInterviewers)];
        if (uniqueInterviewers.every(id => interview.feedbackSubmittedBy.some(submittedId => submittedId.toString() === id))) {
          interview.feedbackSubmitted = true;
        }
        await interview.save();
      }

      // Create audit log
      const candidate = await Candidate.findById(feedback.candidateId);
      if (candidate) {
        await InterviewAuditLog.create({
          interviewId: interview?._id || undefined,
          candidateId: candidate._id,
          jobRequisitionId: feedback.jobRequisitionId,
          action: 'feedback_submitted',
          actionDescription: `Feedback submitted for ${candidate.firstName} ${candidate.lastName} - ${feedback.roundName}`,
          performedBy: session.user.id,
          performedByRole: 'interviewer',
          timestamp: new Date(),
        });
      }
    }

    await feedback.save();

    // Recalculate candidate overall score if all feedbacks are submitted
    if (feedback.isSubmitted) {
      const allFeedbacks = await InterviewFeedback.find({
        candidateId: feedback.candidateId,
        isSubmitted: true,
      });

      if (allFeedbacks.length > 0) {
        const overallScore = calculateOverallScore(
          allFeedbacks.map(f => ({ overallScore: f.overallScore }))
        );

        await Candidate.findByIdAndUpdate(feedback.candidateId, {
          overallScore,
          lastActivityAt: new Date(),
        });
      }
    }

    const populated = await InterviewFeedback.findById(feedback._id)
      .populate('interviewId', 'interviewId roundName roundOrder')
      .populate('candidateId', 'firstName lastName email candidateId')
      .populate('interviewerId', 'email')
      .populate('jobRequisitionId', 'jobTitle');

    return NextResponse.json(populated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error submitting feedback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

