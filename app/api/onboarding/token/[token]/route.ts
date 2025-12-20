import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import OnboardingRequest from '@/lib/models/OnboardingRequest';
import OnboardingSubmission from '@/lib/models/OnboardingSubmission';
import OnboardingAudit from '@/lib/models/OnboardingAudit';
import { isTokenExpired } from '@/lib/utils/onboarding';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import Employee from '@/lib/models/Employee';

// GET - Get onboarding request by token (for employee self-onboarding)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await connectDB();

    const { token } = await params;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

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

    // Check authentication and authorization
    const session = await auth();
    
    // If authenticated, validate access
    if (session?.user) {
      const userRole = session.user.role;
      const userEmail = session.user.email?.toLowerCase();
      const requestEmail = request.email?.toLowerCase();

      // HR and Super Admin can always view
      if (userRole === 'hr' || userRole === 'super_admin') {
        // Allow access - HR view
      } 
      // Managers can view if they are the reporting manager
      else if (userRole === 'manager') {
        // Check if user is the reporting manager by matching employeeId
        const userEmployee = await Employee.findOne({ email: userEmail });
        if (!userEmployee) {
          return NextResponse.json(
            { error: 'You do not have permission to view this onboarding request' },
            { status: 403 }
          );
        }
        
        // Check if this manager is the reporting manager for this onboarding request
        if (!request.reportingManagerId || 
            (typeof request.reportingManagerId === 'object' && 
             request.reportingManagerId._id.toString() !== userEmployee._id.toString())) {
          return NextResponse.json(
            { error: 'You do not have permission to view this onboarding request' },
            { status: 403 }
          );
        }
      }
      // Employees can only view their own onboarding request
      else if (userRole === 'employee') {
        if (userEmail !== requestEmail && userEmail !== request.personalEmail?.toLowerCase()) {
          return NextResponse.json(
            { error: 'You can only access your own onboarding request' },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Unauthorized access' },
          { status: 403 }
        );
      }
    }
    // If not authenticated, allow access (for employees completing onboarding)
    // The token itself is the authorization mechanism

    // Get submission
    const submission = await OnboardingSubmission.findOne({
      onboardingRequestId: request._id,
    });

    // Track if this is first access (onboarding started) - only for unauthenticated users (new employees)
    if (!session?.user && request.status === 'invited' && !request.startedAt) {
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
  } catch (error: any) {
    console.error('Error fetching onboarding by token:', error);
    
    // Provide more specific error messages
    if (error.message?.includes('Cast to ObjectId')) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to load onboarding request. Please try again.' },
      { status: 500 }
    );
  }
}
