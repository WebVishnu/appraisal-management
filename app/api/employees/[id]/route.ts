import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import Employee from '@/lib/models/Employee';
import ManagerReview from '@/lib/models/ManagerReview';
import SelfReview from '@/lib/models/SelfReview';
import AppraisalCycle from '@/lib/models/AppraisalCycle';
import Leave from '@/lib/models/Leave';
import LeaveBalance from '@/lib/models/LeaveBalance';
import WorkReport from '@/lib/models/WorkReport';
import Attendance from '@/lib/models/Attendance';
import ShiftAssignment from '@/lib/models/ShiftAssignment';
import Roster from '@/lib/models/Roster';
import Shift from '@/lib/models/Shift';
import mongoose from 'mongoose';
import { getAssignedShift } from '@/lib/utils/shift';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    // Role-based access control
    let employeeId = id;
    let employee: any = null;
    
    if (session.user.role === 'employee') {
      // Employee can only view their own profile
      employee = await Employee.findOne({ email: session.user.email });
      if (!employee || employee._id.toString() !== id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      employeeId = employee._id.toString();
    } else if (session.user.role === 'manager') {
      // Manager can view their own profile or team members
      const manager = await Employee.findOne({ email: session.user.email });
      if (!manager) {
        return NextResponse.json({ error: 'Manager record not found' }, { status: 404 });
      }
      
      // If viewing own profile, allow
      if (manager._id.toString() === id) {
        employeeId = manager._id.toString();
        employee = await Employee.findById(id).populate('managerId', 'name employeeId email');
      } else {
        // Check if the employee is in manager's team
        const targetEmployee = await Employee.findById(id).populate('managerId', 'name employeeId email');
        if (!targetEmployee || targetEmployee.managerId?.toString() !== manager._id.toString()) {
          return NextResponse.json({ error: 'Unauthorized - Not a team member' }, { status: 403 });
        }
        employeeId = id;
        employee = targetEmployee;
      }
    } else if (session.user.role === 'hr' || session.user.role === 'super_admin') {
      // HR/Admin can view any employee
      employee = await Employee.findById(id).populate('managerId', 'name employeeId email');
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Get all appraisal history
    const managerReviews = await ManagerReview.find({ employeeId: employeeId })
      .populate('cycleId', 'name startDate endDate status')
      .populate('managerId', 'name employeeId')
      .sort({ createdAt: -1 });

    const selfReviews = await SelfReview.find({ employeeId: employeeId })
      .populate('cycleId', 'name startDate endDate status')
      .sort({ createdAt: -1 });

    // Combine reviews and sort by date
    const allReviews = [
      ...managerReviews.map((r) => ({
        type: 'manager' as const,
        cycleId: r.cycleId,
        rating: r.finalRating,
        submittedAt: r.submittedAt,
        createdAt: r.createdAt,
        status: r.status,
      })),
      ...selfReviews.map((r) => ({
        type: 'self' as const,
        cycleId: r.cycleId,
        rating: null,
        submittedAt: r.submittedAt,
        createdAt: r.createdAt,
        status: r.status,
      })),
    ].sort((a, b) => {
      const dateA = a.cycleId && typeof a.cycleId === 'object' && 'startDate' in a.cycleId
        ? new Date(a.cycleId.startDate as Date).getTime()
        : 0;
      const dateB = b.cycleId && typeof b.cycleId === 'object' && 'startDate' in b.cycleId
        ? new Date(b.cycleId.startDate as Date).getTime()
        : 0;
      return dateB - dateA;
    });

    // Calculate performance trends
    const ratings = managerReviews
      .filter((r) => r.finalRating && r.status === 'submitted')
      .map((r) => {
        const match = r.finalRating.match(/(\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : null;
      })
      .filter((r): r is number => r !== null);

    const averageRating = ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : 0;

    // Get manager hierarchy
    const managerHierarchy = [];
    let currentManager = employee.managerId;
    while (currentManager && typeof currentManager === 'object' && '_id' in currentManager) {
      const manager = await Employee.findById(currentManager._id).populate('managerId', 'name employeeId');
      if (manager) {
        managerHierarchy.push({
          _id: manager._id,
          name: manager.name,
          employeeId: manager.employeeId,
          email: manager.email,
        });
        currentManager = manager.managerId;
      } else {
        break;
      }
    }

    // Get leave data
    const currentYear = new Date().getFullYear();
    const leaves = await Leave.find({ employeeId: employeeId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('approvedBy', 'name employeeId');
    
    const leaveBalances = await LeaveBalance.find({
      employeeId: id,
      year: currentYear,
    });

    const leaveStats = {
      pending: await Leave.countDocuments({ employeeId: employeeId, status: 'pending' }),
      approved: await Leave.countDocuments({ employeeId: employeeId, status: 'approved' }),
      rejected: await Leave.countDocuments({ employeeId: employeeId, status: 'rejected' }),
      totalDays: leaves.filter(l => l.status === 'approved').reduce((sum, l) => sum + l.numberOfDays, 0),
    };

    // Get work report data
    const workReports = await WorkReport.find({ employeeId: employeeId })
      .sort({ reportDate: -1 })
      .limit(10)
      .populate('managerId', 'name employeeId');

    const workReportStats = {
      total: await WorkReport.countDocuments({ employeeId: employeeId }),
      approved: await WorkReport.countDocuments({ employeeId: employeeId, status: 'approved' }),
      pending: await WorkReport.countDocuments({ employeeId: employeeId, status: 'submitted' }),
      returned: await WorkReport.countDocuments({ employeeId: employeeId, status: 'returned' }),
      averageProductivity: 0,
    };

    const approvedReports = await WorkReport.find({
      employeeId: employeeId,
      status: 'approved',
      productivityScore: { $exists: true, $ne: null },
    }).select('productivityScore');
    
    if (approvedReports.length > 0) {
      const totalScore = approvedReports.reduce((sum, r) => sum + (r.productivityScore || 0), 0);
      workReportStats.averageProductivity = Math.round((totalScore / approvedReports.length) * 10) / 10;
    }

    // Get attendance data
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);
    
    const attendanceRecords = await Attendance.find({
      employeeId: employeeId,
      date: { $gte: thisMonthStart },
    }).sort({ date: -1 }).limit(30);

    const attendanceStats = {
      thisMonth: await Attendance.countDocuments({
        employeeId: employeeId,
        date: { $gte: thisMonthStart },
        status: 'present',
      }),
      totalDays: Math.ceil((new Date().getTime() - thisMonthStart.getTime()) / (1000 * 60 * 60 * 24)),
      lateCount: await Attendance.countDocuments({
        employeeId: employeeId,
        date: { $gte: thisMonthStart },
        isLate: true,
      }),
      averageHours: 0,
    };

    const presentRecords = attendanceRecords.filter(a => a.status === 'present' && a.workingHours);
    if (presentRecords.length > 0) {
      const totalMinutes = presentRecords.reduce((sum, a) => sum + (a.workingHours || 0), 0);
      attendanceStats.averageHours = Math.round((totalMinutes / presentRecords.length / 60) * 10) / 10;
    }

    // Get shift & roster data
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentShift = await getAssignedShift(new mongoose.Types.ObjectId(employeeId), today);
    
    // Get shift assignments history
    const shiftAssignments = await ShiftAssignment.find({
      $or: [
        { employeeId: new mongoose.Types.ObjectId(employeeId) },
        { teamManagerId: employee.managerId },
        { departmentRole: employee.role },
      ],
      isActive: true,
    })
      .populate('shiftId', 'name shiftType startTime endTime workingDays')
      .populate('assignedBy', 'email name')
      .sort({ createdAt: -1 })
      .limit(10);

    // Get upcoming roster entries (next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const upcomingRosters = await Roster.find({
      employeeId: new mongoose.Types.ObjectId(employeeId),
      date: { $gte: today, $lte: thirtyDaysFromNow },
    })
      .populate('shiftId', 'name startTime endTime')
      .sort({ date: 1 })
      .limit(30);

    // Calculate system health indicators (for Manager/HR only)
    const healthIndicators = {
      attendanceRisk: 'low' as 'low' | 'medium' | 'high',
      productivityRisk: 'low' as 'low' | 'medium' | 'high',
      burnoutRisk: 'low' as 'low' | 'medium' | 'high',
      flags: [] as string[],
    };

    if (session.user.role === 'manager' || session.user.role === 'hr' || session.user.role === 'super_admin') {
      // Attendance risk: based on late arrivals and absences
      const lateRate = attendanceStats.totalDays > 0 
        ? (attendanceStats.lateCount / attendanceStats.totalDays) * 100 
        : 0;
      if (lateRate > 30) healthIndicators.attendanceRisk = 'high';
      else if (lateRate > 15) healthIndicators.attendanceRisk = 'medium';

      // Productivity risk: based on average productivity score
      if (workReportStats.averageProductivity < 50) healthIndicators.productivityRisk = 'high';
      else if (workReportStats.averageProductivity < 70) healthIndicators.productivityRisk = 'medium';

      // Burnout risk: based on work hours and blocked tasks
      const recentReports = await WorkReport.find({
        employeeId: new mongoose.Types.ObjectId(employeeId),
        reportDate: { $gte: thisMonthStart },
      }).select('totalWorkHours blockedTasksCount');
      
      const avgWorkHours = recentReports.length > 0
        ? recentReports.reduce((sum, r) => sum + (r.totalWorkHours || 0), 0) / recentReports.length
        : 0;
      
      const blockedTasksCount = recentReports.reduce((sum, r) => sum + (r.blockedTasksCount || 0), 0);
      
      if (avgWorkHours > 10 || blockedTasksCount > 5) healthIndicators.burnoutRisk = 'high';
      else if (avgWorkHours > 9 || blockedTasksCount > 3) healthIndicators.burnoutRisk = 'medium';

      // Flags
      if (attendanceStats.thisMonth < attendanceStats.totalDays * 0.8) {
        healthIndicators.flags.push('Low attendance rate');
      }
      if (workReportStats.averageProductivity < 60) {
        healthIndicators.flags.push('Low productivity');
      }
      if (avgWorkHours > 10) {
        healthIndicators.flags.push('Potential overload');
      }
      if (workReportStats.averageProductivity > 90 && avgWorkHours < 6) {
        healthIndicators.flags.push('Under-utilized');
      }
    }

    // Get detailed attendance for calendar view (last 3 months)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const calendarAttendance = await Attendance.find({
      employeeId: new mongoose.Types.ObjectId(employeeId),
      date: { $gte: threeMonthsAgo },
    })
      .select('date status isLate isEarlyExit workingHours')
      .sort({ date: -1 });

    // Get all leaves for calendar (current year)
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const calendarLeaves = await Leave.find({
      employeeId: new mongoose.Types.ObjectId(employeeId),
      status: 'approved',
      startDate: { $gte: yearStart },
    })
      .select('startDate endDate leaveType')
      .sort({ startDate: 1 });

    return NextResponse.json({
      employee,
      reviews: allReviews,
      statistics: {
        totalReviews: managerReviews.length,
        averageRating: Math.round(averageRating * 10) / 10,
        ratings,
      },
      managerHierarchy,
      leaves: {
        recent: leaves,
        balances: leaveBalances,
        stats: leaveStats,
        calendar: calendarLeaves,
      },
      workReports: {
        recent: workReports,
        stats: workReportStats,
      },
      attendance: {
        recent: attendanceRecords,
        stats: attendanceStats,
        calendar: calendarAttendance,
      },
      shift: {
        current: currentShift,
        assignments: shiftAssignments,
        upcomingRosters: upcomingRosters,
      },
      healthIndicators: session.user.role === 'manager' || session.user.role === 'hr' || session.user.role === 'super_admin' 
        ? healthIndicators 
        : null,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

