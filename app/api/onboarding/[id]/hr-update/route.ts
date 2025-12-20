import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import OnboardingRequest from '@/lib/models/OnboardingRequest';
import OnboardingSubmission from '@/lib/models/OnboardingSubmission';
import OnboardingAudit from '@/lib/models/OnboardingAudit';
import { z } from 'zod';
import mongoose from 'mongoose';

const hrUpdateSchema = z.object({
  step: z.string(),
  data: z.any(),
});

// POST - HR updates onboarding submission
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    // Only HR and super_admin can update onboarding submissions
    // Managers have read-only access
    if (!session || (session.user.role !== 'hr' && session.user.role !== 'super_admin')) {
      return NextResponse.json({ error: 'Unauthorized - Only HR can edit onboarding submissions' }, { status: 401 });
    }

    await connectDB();

    const { id } = await params;
    const body = await req.json();
    const { step, data } = hrUpdateSchema.parse(body);

    const request = await OnboardingRequest.findById(id);
    if (!request) {
      return NextResponse.json({ error: 'Onboarding request not found' }, { status: 404 });
    }

    // HR can only edit if status is 'submitted' (not 'changes_requested', 'approved', 'rejected', etc.)
    if (request.status !== 'submitted') {
      return NextResponse.json(
        { error: `Cannot edit. Status must be 'submitted'. Current status: ${request.status}` },
        { status: 400 }
      );
    }

    let submission = await OnboardingSubmission.findOne({
      onboardingRequestId: request._id,
    });

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Update the step data
    (submission as any)[step] = data;
    if (submission.stepsCompleted) {
      (submission.stepsCompleted as any)[step] = true;
    }
    submission.lastSavedAt = new Date();
    await submission.save();

    // Get User ID for performedBy
    let performedByUserId: mongoose.Types.ObjectId;
    if (session.user.id) {
      performedByUserId = new mongoose.Types.ObjectId(session.user.id);
    } else {
      const { default: User } = await import('@/lib/models/User');
      const user = await User.findOne({ email: session.user.email });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      performedByUserId = user._id;
    }

    // Create audit log
    await OnboardingAudit.create({
      onboardingRequestId: request._id,
      action: 'hr_updated_submission',
      performedBy: performedByUserId,
      performedAt: new Date(),
      description: `HR updated ${step} step`,
      metadata: { step, updatedBy: session.user.email },
    });

    return NextResponse.json({
      message: 'Step updated successfully',
      submission,
    });
  } catch (error: any) {
    console.error('Error updating onboarding (HR):', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
