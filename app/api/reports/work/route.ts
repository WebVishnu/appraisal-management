import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import { getUserSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import WorkReport from '@/lib/models/WorkReport';
import Employee from '@/lib/models/Employee';
import {
  validateReport,
  autoFillReportMetadata,
  detectAttendanceMismatch,
  calculateProductivityScore,
  canEditReport,
} from '@/lib/utils/work-report';
import mongoose from 'mongoose';

// GET - Get work reports (role-based)
export async function GET(req: NextRequest) {
  try {
    const session = await getUserSession(req, auth);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const role = session.user.role;
    const employeeId = searchParams.get('employeeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');

    let query: any = {};

    // Role-based access
    if (role === 'employee') {
      // Employees can only see their own reports
      if (!session.user.email) {
        return NextResponse.json({ error: 'Employee email not found' }, { status: 400 });
      }
      const employee = await Employee.findOne({ email: session.user.email });
      if (!employee) {
        return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
      }
      query.employeeId = employee._id;
    } else if (role === 'manager') {
      // Managers can see their team's reports
      if (!session.user.email) {
        return NextResponse.json({ error: 'Manager email not found' }, { status: 400 });
      }
      const managerEmployee = await Employee.findOne({ email: session.user.email });
      if (!managerEmployee) {
        return NextResponse.json({ error: 'Manager record not found' }, { status: 404 });
      }

      if (employeeId) {
        // Check if employee is in manager's team
        const targetEmployee = await Employee.findOne({
          _id: employeeId,
          managerId: managerEmployee._id,
        });
        if (!targetEmployee) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
        query.employeeId = new mongoose.Types.ObjectId(employeeId);
      } else {
        // Get all team members
        const teamMembers = await Employee.find({
          managerId: managerEmployee._id,
          isActive: true,
        }).select('_id');
        query.employeeId = { $in: teamMembers.map(emp => emp._id) };
      }
    } else if (role === 'hr' || role === 'super_admin') {
      // HR/Admin can see all reports
      if (employeeId) {
        query.employeeId = new mongoose.Types.ObjectId(employeeId);
      }
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Date range filter
    if (startDate && endDate) {
      query.reportDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    const reports = await WorkReport.find(query)
      .populate('employeeId', 'name employeeId email')
      .populate('managerId', 'name employeeId')
      .populate('managerReview.reviewedBy', 'email')
      .sort({ reportDate: -1, createdAt: -1 })
      .limit(100);

    return NextResponse.json(reports);
  } catch (error: any) {
    console.error('Error fetching work reports:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create or submit work report
export async function POST(req: NextRequest) {
  try {
    const session = await getUserSession(req, auth);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only employees can create reports
    if (session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Only employees can create work reports' }, { status: 403 });
    }

    if (!session.user.email) {
      return NextResponse.json({ error: 'Employee email not found' }, { status: 400 });
    }

    await connectDB();

    const body = await req.json();
    const {
      reportDate,
      endDate,
      frequency,
      tasks,
      keyAchievements,
      challengesFaced,
      supportNeeded,
      selfProductivityRating,
      status, // 'draft' or 'submitted'
    } = body;

    // Get employee record
    const employee = await Employee.findOne({ email: session.user.email });
    if (!employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
    }

    // Auto-fill metadata
    const metadata = await autoFillReportMetadata(employee._id, new Date(reportDate));

    // Create report object
    const reportData: any = {
      employeeId: employee._id,
      reportDate: new Date(reportDate),
      frequency: frequency || 'daily',
      tasks,
      keyAchievements,
      challengesFaced,
      supportNeeded: supportNeeded || '',
      selfProductivityRating,
      status: status || 'draft',
      ...metadata,
    };

    if (endDate && frequency === 'weekly') {
      reportData.endDate = new Date(endDate);
    }

    // Validate report
    const validation = validateReport(reportData);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join(', ') }, { status: 400 });
    }

    // Check for existing report
    const existingReport = await WorkReport.findOne({
      employeeId: employee._id,
      reportDate: new Date(reportDate),
      frequency: reportData.frequency,
    });

    if (existingReport && existingReport.status === 'approved') {
      return NextResponse.json(
        { error: 'Cannot modify approved report' },
        { status: 400 }
      );
    }

    // Calculate productivity score
    const totalWorkHours = tasks.reduce((sum: number, task: any) => sum + task.timeSpent, 0) / 60;
    const taskCompletionCount = tasks.filter((t: any) => t.status === 'completed').length;
    const blockedTasksCount = tasks.filter((t: any) => t.status === 'blocked').length;
    const productivityScore = calculateProductivityScore(
      totalWorkHours,
      taskCompletionCount,
      tasks.length,
      blockedTasksCount,
      selfProductivityRating
    );
    reportData.productivityScore = productivityScore;

    // Detect attendance mismatch
    const mismatch = await detectAttendanceMismatch(employee._id, new Date(reportDate), totalWorkHours);
    reportData.attendanceMismatch = mismatch;

    // Set submitted date if submitting
    if (status === 'submitted') {
      reportData.submittedAt = new Date();
    }

    let report;
    if (existingReport) {
      // Update existing report
      if (!canEditReport(existingReport)) {
        return NextResponse.json(
          { error: 'Cannot edit this report' },
          { status: 400 }
        );
      }
      report = await WorkReport.findByIdAndUpdate(
        existingReport._id,
        reportData,
        { new: true, runValidators: true }
      );
    } else {
      // Create new report
      report = await WorkReport.create(reportData);
    }

    if (!report) {
      return NextResponse.json({ error: 'Failed to create or update report' }, { status: 500 });
    }

    const populatedReport = await WorkReport.findById(report._id)
      .populate('employeeId', 'name employeeId email')
      .populate('managerId', 'name employeeId')
      .populate('managerReview.reviewedBy', 'email');

    return NextResponse.json({
      message: status === 'submitted' ? 'Report submitted successfully' : 'Report saved as draft',
      report: populatedReport,
    });
  } catch (error: any) {
    console.error('Error creating work report:', error);
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Report already exists for this date' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

