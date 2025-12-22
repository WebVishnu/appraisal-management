import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import JobRequisition from '@/lib/models/JobRequisition';

// GET - Get job details for public application (no auth required)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await connectDB();
    const { token } = await params;

    // First, try to find the job by token (without other restrictions) to provide better error messages
    // Note: publicToken has select: false, so we need to explicitly include it with +
    const jobWithToken = await JobRequisition.findOne({ publicToken: token })
      .select('+publicToken allowPublicApplications isActive status jobTitle');

    if (!jobWithToken) {
      console.log('Job not found with token:', token);
      return NextResponse.json({ error: 'Invalid token. Job not found.' }, { status: 404 });
    }

    console.log('Job found with token:', {
      jobTitle: jobWithToken.jobTitle,
      isActive: jobWithToken.isActive,
      status: jobWithToken.status,
      allowPublicApplications: jobWithToken.allowPublicApplications,
    });

    // Check each condition and provide specific error messages
    if (!jobWithToken.isActive) {
      return NextResponse.json({ error: 'This job requisition is no longer active' }, { status: 404 });
    }

    if (jobWithToken.status !== 'open') {
      return NextResponse.json({ 
        error: `Applications are closed. Job status: ${jobWithToken.status.replace('_', ' ')}` 
      }, { status: 404 });
    }

    if (!jobWithToken.allowPublicApplications) {
      return NextResponse.json({ error: 'Public applications are not enabled for this job' }, { status: 404 });
    }

    // Now get the full job details (should exist since we already validated conditions above)
    const job = await JobRequisition.findOne({
      publicToken: token,
      allowPublicApplications: true,
      isActive: true,
      status: 'open',
    }).select('jobTitle department location description requirements salaryRange employmentType publicApplicationDeadline');

    if (!job) {
      // This shouldn't happen if the checks above passed, but just in case
      console.error('Job not found after validation, this should not happen');
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Check if deadline passed
    if (job.publicApplicationDeadline && new Date() > job.publicApplicationDeadline) {
      return NextResponse.json({ error: 'Application deadline has passed' }, { status: 400 });
    }

    return NextResponse.json({
      jobTitle: job.jobTitle,
      department: job.department,
      location: job.location,
      description: job.description,
      requirements: job.requirements,
      salaryRange: job.salaryRange,
      employmentType: job.employmentType,
      deadline: job.publicApplicationDeadline,
    });
  } catch (error) {
    console.error('Error fetching public job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

