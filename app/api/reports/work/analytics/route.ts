import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import WorkReport from '@/lib/models/WorkReport';
import Attendance from '@/lib/models/Attendance';
import Employee from '@/lib/models/Employee';
import { getTeamProductivityOverview } from '@/lib/utils/work-report';
import mongoose from 'mongoose';

// GET - Get productivity analytics
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only HR and Admin can view analytics
    if (session.user.role !== 'hr' && session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get('endDate') || new Date().toISOString();
    const teamId = searchParams.get('teamId'); // Manager ID for team-level analytics

    const start = new Date(startDate);
    const end = new Date(endDate);

    let query: any = {
      status: 'approved',
      reportDate: {
        $gte: start,
        $lte: end,
      },
    };

    // Team-level analytics
    if (teamId) {
      const manager = await Employee.findById(teamId);
      if (!manager) {
        return NextResponse.json({ error: 'Manager not found' }, { status: 404 });
      }
      const teamMembers = await Employee.find({
        managerId: manager._id,
        isActive: true,
      }).select('_id');
      query.employeeId = { $in: teamMembers.map(emp => emp._id) };
    }

    const reports = await WorkReport.find(query)
      .populate('employeeId', 'name employeeId email role')
      .populate('managerId', 'name employeeId');

    // Organization-level analytics
    const totalReports = reports.length;
    const totalEmployees = new Set(reports.map(r => r.employeeId.toString())).size;
    const averageProductivityScore =
      reports.length > 0
        ? reports.reduce((sum, r) => sum + (r.productivityScore || 0), 0) / reports.length
        : 0;
    const totalWorkHours = reports.reduce((sum, r) => sum + r.totalWorkHours, 0);
    const averageWorkHours = reports.length > 0 ? totalWorkHours / reports.length : 0;

    // Task completion metrics
    const totalTasks = reports.reduce((sum, r) => sum + r.tasks.length, 0);
    const completedTasks = reports.reduce((sum, r) => sum + r.taskCompletionCount, 0);
    const blockedTasks = reports.reduce((sum, r) => sum + r.blockedTasksCount, 0);
    const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Attendance vs productivity correlation
    const attendanceProductivityData = [];
    for (const report of reports) {
      const employeeId = report.employeeId instanceof mongoose.Types.ObjectId
        ? report.employeeId
        : (report.employeeId as any)._id;

      const reportDate = new Date(report.reportDate);
      const startOfDay = new Date(reportDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(reportDate);
      endOfDay.setHours(23, 59, 59, 999);

      const attendance = await Attendance.findOne({
        employeeId,
        date: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      });

      attendanceProductivityData.push({
        employeeId: employeeId.toString(),
        employeeName: (report.employeeId as any).name || 'Unknown',
        date: report.reportDate,
        attendanceStatus: attendance?.status || 'unknown',
        productivityScore: report.productivityScore || 0,
        workHours: report.totalWorkHours,
        attendanceHours: attendance?.workingHours ? attendance.workingHours / 60 : 0,
      });
    }

    // High performers and burnout risks
    const employeeStats = new Map();
    for (const report of reports) {
      const employeeId = report.employeeId instanceof mongoose.Types.ObjectId
        ? report.employeeId.toString()
        : (report.employeeId as any)._id.toString();
      const employeeName = (report.employeeId as any).name || 'Unknown';

      if (!employeeStats.has(employeeId)) {
        employeeStats.set(employeeId, {
          employeeId,
          employeeName,
          reports: [],
          totalWorkHours: 0,
          averageProductivityScore: 0,
          flags: new Set(),
        });
      }

      const stats = employeeStats.get(employeeId);
      stats.reports.push(report);
      stats.totalWorkHours += report.totalWorkHours;
      if (report.managerReview?.flag) {
        stats.flags.add(report.managerReview.flag);
      }
    }

    // Calculate averages and identify patterns
    const employeeAnalytics = Array.from(employeeStats.values()).map(stats => {
      const avgProductivity =
        stats.reports.length > 0
          ? stats.reports.reduce((sum: number, r: any) => sum + (r.productivityScore || 0), 0) /
            stats.reports.length
          : 0;
      const avgWorkHours = stats.reports.length > 0 ? stats.totalWorkHours / stats.reports.length : 0;

      return {
        employeeId: stats.employeeId,
        employeeName: stats.employeeName,
        totalReports: stats.reports.length,
        averageProductivityScore: avgProductivity,
        averageWorkHours: avgWorkHours,
        flags: Array.from(stats.flags),
        isHighPerformer: avgProductivity >= 80 && avgWorkHours >= 6,
        isBurnoutRisk: avgWorkHours > 10 && stats.reports.length >= 5,
      };
    });

    const highPerformers = employeeAnalytics.filter(emp => emp.isHighPerformer);
    const burnoutRisks = employeeAnalytics.filter(emp => emp.isBurnoutRisk);

    // Team-level analytics (if manager specified)
    let teamOverview = null;
    if (teamId) {
      const manager = await Employee.findById(teamId);
      if (manager) {
        teamOverview = await getTeamProductivityOverview(manager._id, start, end);
      }
    }

    return NextResponse.json({
      period: {
        startDate: start,
        endDate: end,
      },
      organization: {
        totalReports,
        totalEmployees,
        averageProductivityScore: Math.round(averageProductivityScore * 10) / 10,
        totalWorkHours: Math.round(totalWorkHours * 10) / 10,
        averageWorkHours: Math.round(averageWorkHours * 10) / 10,
        taskCompletionRate: Math.round(taskCompletionRate * 10) / 10,
        blockedTasks,
      },
      attendanceProductivityCorrelation: attendanceProductivityData,
      highPerformers: highPerformers.map(emp => ({
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        averageProductivityScore: emp.averageProductivityScore,
        averageWorkHours: emp.averageWorkHours,
      })),
      burnoutRisks: burnoutRisks.map(emp => ({
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        averageWorkHours: emp.averageWorkHours,
        totalReports: emp.totalReports,
      })),
      teamOverview,
    });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

