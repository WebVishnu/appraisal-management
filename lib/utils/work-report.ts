/**
 * Work Report business logic utilities
 */

import WorkReport, { IWorkReport, ReportFrequency } from '@/lib/models/WorkReport';
import Attendance from '@/lib/models/Attendance';
import Employee from '@/lib/models/Employee';
import Leave from '@/lib/models/Leave';
import mongoose from 'mongoose';

/**
 * Calculate productivity score based on various factors
 */
export function calculateProductivityScore(
  totalWorkHours: number,
  taskCompletionCount: number,
  totalTasks: number,
  blockedTasksCount: number,
  selfRating: number,
  managerRating?: number
): number {
  // Base score from work hours (normalized to 8-hour day)
  const hoursScore = Math.min((totalWorkHours / 8) * 30, 30); // Max 30 points
  
  // Task completion rate (max 30 points)
  const completionRate = totalTasks > 0 ? (taskCompletionCount / totalTasks) : 0;
  const completionScore = completionRate * 30;
  
  // Blocked tasks penalty (max -20 points)
  const blockedPenalty = Math.min(blockedTasksCount * 5, 20);
  
  // Self rating (max 20 points)
  const selfRatingScore = (selfRating / 5) * 20;
  
  // Manager rating if available (max 20 points, replaces self rating if present)
  const ratingScore = managerRating ? (managerRating / 5) * 20 : selfRatingScore;
  
  // Calculate final score (0-100)
  const score = hoursScore + completionScore - blockedPenalty + ratingScore;
  
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

/**
 * Detect attendance vs work mismatch
 */
export async function detectAttendanceMismatch(
  employeeId: mongoose.Types.ObjectId,
  reportDate: Date,
  totalWorkHours: number
): Promise<{ detected: boolean; reason: string }> {
  const { default: connectDB } = await import('@/lib/mongodb');
  await connectDB();
  
  // Get start and end of day
  const startOfDay = new Date(reportDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(reportDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  // Check attendance record
  const attendance = await Attendance.findOne({
    employeeId,
    date: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  });
  
  if (!attendance) {
    return {
      detected: true,
      reason: 'No attendance record found for this date',
    };
  }
  
  if (attendance.status === 'absent') {
    return {
      detected: true,
      reason: 'Employee marked absent but submitted work report',
    };
  }
  
  // Check if employee is on leave for this date
  const leave = await Leave.findOne({
    employeeId,
    startDate: { $lte: endOfDay },
    endDate: { $gte: startOfDay },
    status: 'approved',
  });
  
  if (leave) {
    return {
      detected: true,
      reason: 'Employee on leave but submitted work report',
    };
  }
  
  // Check if work hours match attendance
  if (attendance.workingHours) {
    const attendanceHours = attendance.workingHours / 60; // Convert minutes to hours
    const difference = Math.abs(totalWorkHours - attendanceHours);
    
    if (difference > 2) {
      return {
        detected: true,
        reason: `Work hours (${totalWorkHours.toFixed(1)}h) don't match attendance hours (${attendanceHours.toFixed(1)}h)`,
      };
    }
  }
  
  return {
    detected: false,
    reason: '',
  };
}

/**
 * Auto-fill report metadata from employee and attendance
 */
export async function autoFillReportMetadata(
  employeeId: mongoose.Types.ObjectId,
  reportDate: Date
): Promise<{
  employeeName: string;
  employeeRole: string;
  managerId?: mongoose.Types.ObjectId;
  managerName?: string;
  shift?: string;
  attendanceStatus?: 'present' | 'absent' | 'half_day' | 'missed_checkout';
}> {
  const { default: connectDB } = await import('@/lib/mongodb');
  await connectDB();
  
  const employee = await Employee.findById(employeeId).populate('managerId', 'name employeeId');
  
  if (!employee) {
    throw new Error('Employee not found');
  }
  
  // Get attendance status
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
  
  const manager = employee.managerId as any;
  
  return {
    employeeName: employee.name,
    employeeRole: employee.role,
    managerId: manager?._id || undefined,
    managerName: manager?.name || undefined,
    shift: undefined, // Can be extended if shift system exists
    attendanceStatus: attendance?.status || 'present',
  };
}

/**
 * Validate report before submission
 */
export function validateReport(report: Partial<IWorkReport>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!report.tasks || report.tasks.length === 0) {
    errors.push('At least one task is required');
  }
  
  if (!report.keyAchievements || report.keyAchievements.trim().length === 0) {
    errors.push('Key achievements are required');
  }
  
  if (!report.challengesFaced || report.challengesFaced.trim().length === 0) {
    errors.push('Challenges faced are required');
  }
  
  if (!report.selfProductivityRating || report.selfProductivityRating < 1 || report.selfProductivityRating > 5) {
    errors.push('Self productivity rating must be between 1 and 5');
  }
  
  // Validate tasks
  if (report.tasks) {
    report.tasks.forEach((task, index) => {
      if (!task.title || task.title.trim().length === 0) {
        errors.push(`Task ${index + 1}: Title is required`);
      }
      if (!task.description || task.description.trim().length === 0) {
        errors.push(`Task ${index + 1}: Description is required`);
      }
      if (!task.timeSpent || task.timeSpent <= 0) {
        errors.push(`Task ${index + 1}: Time spent must be greater than 0`);
      }
      if (task.status === 'blocked' && (!task.blockerReason || task.blockerReason.trim().length === 0)) {
        errors.push(`Task ${index + 1}: Blocker reason is required for blocked tasks`);
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if report can be edited
 */
export function canEditReport(report: IWorkReport): boolean {
  // Can only edit draft or returned reports
  return report.status === 'draft' || report.status === 'returned';
}

/**
 * Check if report is locked (approved)
 */
export function isReportLocked(report: IWorkReport): boolean {
  return report.status === 'approved';
}

/**
 * Get productivity trend for an employee
 */
export async function getProductivityTrend(
  employeeId: mongoose.Types.ObjectId,
  days: number = 30
): Promise<Array<{
  date: Date;
  productivityScore: number;
  totalWorkHours: number;
  taskCompletionCount: number;
}>> {
  const { default: connectDB } = await import('@/lib/mongodb');
  await connectDB();
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const reports = await WorkReport.find({
    employeeId,
    status: 'approved',
    reportDate: { $gte: startDate },
  })
    .sort({ reportDate: 1 })
    .select('reportDate productivityScore totalWorkHours taskCompletionCount');
  
  return reports.map(report => ({
    date: report.reportDate,
    productivityScore: report.productivityScore || 0,
    totalWorkHours: report.totalWorkHours,
    taskCompletionCount: report.taskCompletionCount,
  }));
}

/**
 * Get team productivity overview
 */
export async function getTeamProductivityOverview(
  managerId: mongoose.Types.ObjectId,
  startDate: Date,
  endDate: Date
): Promise<Array<{
  employeeId: mongoose.Types.ObjectId;
  employeeName: string;
  totalReports: number;
  averageProductivityScore: number;
  totalWorkHours: number;
  averageWorkHours: number;
  taskCompletionRate: number;
  blockedTasksCount: number;
  flags: string[];
}>> {
  const { default: connectDB } = await import('@/lib/mongodb');
  await connectDB();
  
  // Get team members
  const teamMembers = await Employee.find({
    managerId,
    isActive: true,
  }).select('_id name');
  
  const overview = [];
  
  for (const member of teamMembers) {
    const reports = await WorkReport.find({
      employeeId: member._id,
      status: 'approved',
      reportDate: {
        $gte: startDate,
        $lte: endDate,
      },
    });
    
    if (reports.length === 0) continue;
    
    const totalReports = reports.length;
    const totalProductivityScore = reports.reduce((sum, r) => sum + (r.productivityScore || 0), 0);
    const totalWorkHours = reports.reduce((sum, r) => sum + r.totalWorkHours, 0);
    const totalTasks = reports.reduce((sum, r) => sum + r.tasks.length, 0);
    const completedTasks = reports.reduce((sum, r) => sum + r.taskCompletionCount, 0);
    const blockedTasks = reports.reduce((sum, r) => sum + r.blockedTasksCount, 0);
    const flags = reports
      .map(r => r.managerReview?.flag)
      .filter((flag): flag is 'under_utilized' | 'overloaded' | 'needs_support' | 'excellent' => 
        flag !== null && flag !== undefined
      );
    
    overview.push({
      employeeId: member._id,
      employeeName: member.name,
      totalReports,
      averageProductivityScore: totalProductivityScore / totalReports,
      totalWorkHours,
      averageWorkHours: totalWorkHours / totalReports,
      taskCompletionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      blockedTasksCount: blockedTasks,
      flags: [...new Set(flags)],
    });
  }
  
  return overview;
}

