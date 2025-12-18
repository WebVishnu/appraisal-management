import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import WorkReport from '@/lib/models/WorkReport';
import Employee from '@/lib/models/Employee';
import { calculateProductivityScore } from '@/lib/utils/work-report';
import mongoose from 'mongoose';

// POST - Manager review and approval
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid report ID' }, { status: 400 });
    }

    // Only managers, HR, and Admin can review
    if (
      session.user.role !== 'manager' &&
      session.user.role !== 'hr' &&
      session.user.role !== 'super_admin'
    ) {
      return NextResponse.json({ error: 'Only managers can review reports' }, { status: 403 });
    }

    await connectDB();

    const report = await WorkReport.findById(id);
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Check if report is submitted
    if (report.status !== 'submitted' && report.status !== 'returned') {
      return NextResponse.json(
        { error: 'Can only review submitted or returned reports' },
        { status: 400 }
      );
    }

    // Check manager permissions
    if (session.user.role === 'manager') {
      if (!session.user.email) {
        return NextResponse.json({ error: 'Manager email not found' }, { status: 400 });
      }
      const managerEmployee = await Employee.findOne({ email: session.user.email });
      if (!managerEmployee) {
        return NextResponse.json({ error: 'Manager record not found' }, { status: 404 });
      }
      const reportEmployee = await Employee.findById(report.employeeId);
      if (!reportEmployee || reportEmployee.managerId?.toString() !== managerEmployee._id.toString()) {
        return NextResponse.json(
          { error: 'You can only review reports from your team members' },
          { status: 403 }
        );
      }
    }

    const body = await req.json();
    const {
      taskComments,
      overallFeedback,
      managerProductivityRating,
      flag,
      approved,
      returnedReason,
    } = body;

    // Update manager review
    report.managerReview = {
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
      taskComments: taskComments || [],
      overallFeedback: overallFeedback || null,
      managerProductivityRating: managerProductivityRating || null,
      flag: flag || null,
      approved: approved === true,
      returnedReason: returnedReason || null,
    };

    // Update status
    if (approved) {
      report.status = 'approved';
      report.approvedAt = new Date();

      // Recalculate productivity score with manager rating if provided
      if (managerProductivityRating) {
        const totalWorkHours = report.totalWorkHours;
        const taskCompletionCount = report.taskCompletionCount;
        const blockedTasksCount = report.blockedTasksCount;
        report.productivityScore = calculateProductivityScore(
          totalWorkHours,
          taskCompletionCount,
          report.tasks.length,
          blockedTasksCount,
          report.selfProductivityRating,
          managerProductivityRating
        );
      }
    } else {
      report.status = 'returned';
    }

    await report.save();

    const populatedReport = await WorkReport.findById(report._id)
      .populate('employeeId', 'name employeeId email')
      .populate('managerId', 'name employeeId')
      .populate('managerReview.reviewedBy', 'email name');

    return NextResponse.json({
      message: approved ? 'Report approved successfully' : 'Report returned for revision',
      report: populatedReport,
    });
  } catch (error: any) {
    console.error('Error reviewing work report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

