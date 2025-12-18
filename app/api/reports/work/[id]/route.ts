import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import WorkReport from '@/lib/models/WorkReport';
import Employee from '@/lib/models/Employee';
import {
  validateReport,
  canEditReport,
  isReportLocked,
  calculateProductivityScore,
  detectAttendanceMismatch,
} from '@/lib/utils/work-report';
import mongoose from 'mongoose';

// GET - Get single work report
export async function GET(
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

    await connectDB();

    const report = await WorkReport.findById(id)
      .populate('employeeId', 'name employeeId email')
      .populate('managerId', 'name employeeId')
      .populate('managerReview.reviewedBy', 'email name');

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Check permissions
    const role = session.user.role;
    const employeeId = report.employeeId instanceof mongoose.Types.ObjectId
      ? report.employeeId
      : (report.employeeId as any)._id;

    if (role === 'employee') {
      if (!session.user.email) {
        return NextResponse.json({ error: 'Employee email not found' }, { status: 400 });
      }
      const employee = await Employee.findOne({ email: session.user.email });
      if (!employee || employee._id.toString() !== employeeId.toString()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    } else if (role === 'manager') {
      if (!session.user.email) {
        return NextResponse.json({ error: 'Manager email not found' }, { status: 400 });
      }
      const managerEmployee = await Employee.findOne({ email: session.user.email });
      if (!managerEmployee) {
        return NextResponse.json({ error: 'Manager record not found' }, { status: 404 });
      }
      const reportEmployee = await Employee.findById(employeeId);
      if (!reportEmployee || reportEmployee.managerId?.toString() !== managerEmployee._id.toString()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    } else if (role !== 'hr' && role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json(report);
  } catch (error: any) {
    console.error('Error fetching work report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update work report
export async function PUT(
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

    await connectDB();

    const report = await WorkReport.findById(id);
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Check permissions - only employee who created can edit
    if (session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Only employees can edit their reports' }, { status: 403 });
    }

    if (!session.user.email) {
      return NextResponse.json({ error: 'Employee email not found' }, { status: 400 });
    }

    const employee = await Employee.findOne({ email: session.user.email });
    if (!employee || report.employeeId.toString() !== employee._id.toString()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if report can be edited
    if (!canEditReport(report)) {
      return NextResponse.json(
        { error: 'Cannot edit this report. It may be approved or locked.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      tasks,
      keyAchievements,
      challengesFaced,
      supportNeeded,
      selfProductivityRating,
      status,
    } = body;

    // Update report
    if (tasks) report.tasks = tasks;
    if (keyAchievements) report.keyAchievements = keyAchievements;
    if (challengesFaced) report.challengesFaced = challengesFaced;
    if (supportNeeded !== undefined) report.supportNeeded = supportNeeded;
    if (selfProductivityRating) report.selfProductivityRating = selfProductivityRating;
    if (status) report.status = status;

    // Validate report
    const validation = validateReport(report);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join(', ') }, { status: 400 });
    }

    // Recalculate productivity score
    const totalWorkHours = report.tasks.reduce((sum, task) => sum + task.timeSpent, 0) / 60;
    const taskCompletionCount = report.tasks.filter(t => t.status === 'completed').length;
    const blockedTasksCount = report.tasks.filter(t => t.status === 'blocked').length;
    report.productivityScore = calculateProductivityScore(
      totalWorkHours,
      taskCompletionCount,
      report.tasks.length,
      blockedTasksCount,
      report.selfProductivityRating
    );

    // Re-detect attendance mismatch
    const mismatch = await detectAttendanceMismatch(
      report.employeeId,
      report.reportDate,
      totalWorkHours
    );
    report.attendanceMismatch = mismatch;

    // Set submitted date if submitting
    if (status === 'submitted' && !report.submittedAt) {
      report.submittedAt = new Date();
    }

    await report.save();

    const populatedReport = await WorkReport.findById(report._id)
      .populate('employeeId', 'name employeeId email')
      .populate('managerId', 'name employeeId')
      .populate('managerReview.reviewedBy', 'email');

    return NextResponse.json({
      message: 'Report updated successfully',
      report: populatedReport,
    });
  } catch (error: any) {
    console.error('Error updating work report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete work report (only draft or returned)
export async function DELETE(
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

    await connectDB();

    const report = await WorkReport.findById(id);
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Check permissions
    if (session.user.role === 'employee') {
      if (!session.user.email) {
        return NextResponse.json({ error: 'Employee email not found' }, { status: 400 });
      }
      const employee = await Employee.findOne({ email: session.user.email });
      if (!employee || report.employeeId.toString() !== employee._id.toString()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      // Employees can only delete draft or returned reports
      if (report.status !== 'draft' && report.status !== 'returned') {
        return NextResponse.json(
          { error: 'Can only delete draft or returned reports' },
          { status: 400 }
        );
      }
    } else if (session.user.role === 'hr' || session.user.role === 'super_admin') {
      // HR/Admin can delete any report
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await WorkReport.findByIdAndDelete(id);

    return NextResponse.json({ message: 'Report deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting work report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

