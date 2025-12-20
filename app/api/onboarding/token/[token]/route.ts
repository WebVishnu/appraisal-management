import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import OnboardingRequest from '@/lib/models/OnboardingRequest';
import OnboardingSubmission from '@/lib/models/OnboardingSubmission';
import OnboardingAudit from '@/lib/models/OnboardingAudit';
import { isTokenExpired } from '@/lib/utils/onboarding';

// GET - Get onboarding request by token (for employee self-onboarding)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await connectDB();

    const { token } = await params;

    const request = await OnboardingRequest.findOne({ token })
      .populate('reportingManagerId', 'name employeeId email');

    if (!request) {
      return NextResponse.json({ error: 'Invalid onboarding token' }, { status: 404 });
    }

    // Check if token is expired
    if (isTokenExpired(request.tokenExpiry)) {
      return NextResponse.json(
        { error: 'Onboarding link has expired. Please contact HR for a new link.' },
        { status: 400 }
      );
    }

    // Get submission
    const submission = await OnboardingSubmission.findOne({
      onboardingRequestId: request._id,
    });

    // Track if this is first access (onboarding started)
    if (request.status === 'invited' && !request.startedAt) {
      request.status = 'in_progress';
      request.startedAt = new Date();
      await request.save();

      // Create audit log
      await OnboardingAudit.create({
        onboardingRequestId: request._id,
        action: 'onboarding_started',
        performedBy: request.invitedBy, // System action
        performedAt: new Date(),
        description: 'Employee started onboarding process',
      });
    }

    return NextResponse.json({
      request,
      submission,
    });
  } catch (error) {
    console.error('Error fetching onboarding by token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
