import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import OnboardingRequest from '@/lib/models/OnboardingRequest';
import OnboardingAudit from '@/lib/models/OnboardingAudit';
import { generateOnboardingLink } from '@/lib/utils/onboarding';
import { createNotification } from '@/lib/utils/notifications';
import User from '@/lib/models/User';
import mongoose from 'mongoose';

// POST - Send reminder to employee
export async function POST(
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

    // Check if already completed
    if (request.status === 'completed' || request.status === 'approved') {
      return NextResponse.json(
        { error: 'Cannot send reminder for completed onboarding' },
        { status: 400 }
      );
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

    // Update reminder count
    request.lastReminderSentAt = new Date();
    request.reminderCount = (request.reminderCount || 0) + 1;
    await request.save();

    // Create audit log
    await OnboardingAudit.create({
      onboardingRequestId: request._id,
      action: 'reminder_sent',
      performedBy: createdByUserId,
      performedAt: new Date(),
      description: `Reminder sent to ${request.email} (Reminder #${request.reminderCount})`,
    });

    // Generate onboarding link
    const onboardingLink = generateOnboardingLink(request.token);

    // TODO: Send email notification
    // For now, return the link for HR to send manually
    // In production, integrate with email service (SendGrid, AWS SES, etc.)

    return NextResponse.json({
      message: 'Reminder sent successfully',
      onboardingLink,
      reminderCount: request.reminderCount,
    });
  } catch (error) {
    console.error('Error sending reminder:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
