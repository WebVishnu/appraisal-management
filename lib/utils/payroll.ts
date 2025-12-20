import mongoose from 'mongoose';
import Attendance from '@/lib/models/Attendance';
import Leave from '@/lib/models/Leave';
import SalaryStructure from '@/lib/models/SalaryStructure';
import { getAssignedShift, getDayOfWeek } from './shift';

export interface PayrollCalculationInput {
  employeeId: mongoose.Types.ObjectId | string;
  month: number; // 1-12
  year: number;
  salaryStructure: {
    grossMonthlySalary: number;
    workingDaysRule: 'shift_based' | 'calendar_days' | 'fixed_days';
    fixedWorkingDays?: number;
    paidLeaveTypes: string[];
    unpaidLeaveTypes: string[];
    halfDayDeductionRule: 'half_day' | 'proportional';
  };
}

export interface PayrollCalculationResult {
  totalWorkingDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  lateArrivals: number;
  payableDays: number;
  perDaySalary: number;
  grossPayable: number;
  deductions: {
    unpaidLeave: number;
    halfDay: number;
    latePenalty: number;
    total: number;
  };
  netPayable: number;
  anomalies: string[];
}

/**
 * Calculate payroll for an employee for a given month
 */
export async function calculatePayroll(
  input: PayrollCalculationInput
): Promise<PayrollCalculationResult> {
  const employeeId = typeof input.employeeId === 'string' 
    ? new mongoose.Types.ObjectId(input.employeeId) 
    : input.employeeId;

  const monthStart = new Date(input.year, input.month - 1, 1);
  const monthEnd = new Date(input.year, input.month, 0, 23, 59, 59, 999);

  const anomalies: string[] = [];

  // Get all attendance records for the month
  const attendanceRecords = await Attendance.find({
    employeeId: employeeId,
    date: {
      $gte: monthStart,
      $lte: monthEnd,
    },
  }).sort({ date: 1 });

  // Get all approved leaves for the month
  const approvedLeaves = await Leave.find({
    employeeId: employeeId,
    status: 'approved',
    $or: [
      {
        startDate: { $lte: monthEnd },
        endDate: { $gte: monthStart },
      },
    ],
  });

  // Calculate total working days based on rule
  let totalWorkingDays = 0;
  
  if (input.salaryStructure.workingDaysRule === 'fixed_days') {
    totalWorkingDays = input.salaryStructure.fixedWorkingDays || 0;
  } else if (input.salaryStructure.workingDaysRule === 'calendar_days') {
    // Count all days in month excluding Sundays
    const daysInMonth = monthEnd.getDate();
    totalWorkingDays = daysInMonth - Math.floor((daysInMonth + monthStart.getDay()) / 7);
  } else {
    // shift_based: Count working days based on assigned shifts
    totalWorkingDays = await calculateShiftBasedWorkingDays(employeeId, monthStart, monthEnd);
  }

  // Process attendance and leaves
  const attendanceMap = new Map<string, any>();
  attendanceRecords.forEach((record) => {
    const dateKey = record.date.toISOString().split('T')[0];
    attendanceMap.set(dateKey, record);
  });

  const leaveMap = new Map<string, any>();
  approvedLeaves.forEach((leave) => {
    const startDate = new Date(leave.startDate);
    const endDate = new Date(leave.endDate);
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      if (!leaveMap.has(dateKey)) {
        leaveMap.set(dateKey, leave);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });

  // Count days
  let presentDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let lateArrivals = 0;

  const currentDate = new Date(monthStart);
  while (currentDate <= monthEnd) {
    const dateKey = currentDate.toISOString().split('T')[0];
    const attendance = attendanceMap.get(dateKey);
    const leave = leaveMap.get(dateKey);

    // Skip weekends if using calendar_days rule
    if (input.salaryStructure.workingDaysRule === 'calendar_days') {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek === 0) { // Sunday
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
    }

    if (leave) {
      // Check if leave is paid or unpaid
      if (input.salaryStructure.paidLeaveTypes.includes(leave.leaveType)) {
        paidLeaveDays++;
      } else if (input.salaryStructure.unpaidLeaveTypes.includes(leave.leaveType)) {
        unpaidLeaveDays++;
      }
    } else if (attendance) {
      if (attendance.status === 'present') {
        presentDays++;
        if (attendance.isLate) {
          lateArrivals++;
        }
      } else if (attendance.status === 'half_day') {
        halfDays++;
      } else if (attendance.status === 'absent') {
        absentDays++;
      }
    } else {
      // No attendance record and no leave - check if it's a working day
      const assignedShift = await getAssignedShift(employeeId, currentDate);
      if (assignedShift && assignedShift.shift) {
        const dayOfWeek = getDayOfWeek(currentDate);
        if (assignedShift.shift.workingDays.includes(dayOfWeek)) {
          // It's a working day but no attendance - anomaly
          anomalies.push(`Missing attendance record for ${dateKey}`);
          absentDays++;
        }
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Calculate per-day salary
  const perDaySalary = input.salaryStructure.grossMonthlySalary / totalWorkingDays;

  // Calculate payable days
  let payableDays = presentDays + paidLeaveDays;
  
  // Handle half-days
  if (input.salaryStructure.halfDayDeductionRule === 'half_day') {
    payableDays += halfDays * 0.5;
  } else {
    // proportional: calculate based on actual working hours
    // For simplicity, treat as 0.5 days (can be enhanced)
    payableDays += halfDays * 0.5;
  }

  // Calculate deductions
  const unpaidLeaveDeduction = unpaidLeaveDays * perDaySalary;
  
  let halfDayDeduction = 0;
  if (input.salaryStructure.halfDayDeductionRule === 'half_day') {
    halfDayDeduction = halfDays * perDaySalary * 0.5;
  } else {
    // Proportional deduction already handled in payableDays
    halfDayDeduction = 0;
  }

  const latePenalty = 0; // Can be configured later
  const totalDeductions = unpaidLeaveDeduction + halfDayDeduction + latePenalty;

  // Calculate gross payable and net payable
  const grossPayable = payableDays * perDaySalary;
  const netPayable = grossPayable - totalDeductions;

  // Validate calculations
  if (presentDays + absentDays + halfDays + paidLeaveDays + unpaidLeaveDays > totalWorkingDays) {
    anomalies.push('Attendance/leave days exceed total working days');
  }

  return {
    totalWorkingDays,
    presentDays,
    absentDays,
    halfDays,
    paidLeaveDays,
    unpaidLeaveDays,
    lateArrivals,
    payableDays,
    perDaySalary,
    grossPayable,
    deductions: {
      unpaidLeave: unpaidLeaveDeduction,
      halfDay: halfDayDeduction,
      latePenalty,
      total: totalDeductions,
    },
    netPayable,
    anomalies,
  };
}

/**
 * Calculate working days based on assigned shifts
 */
async function calculateShiftBasedWorkingDays(
  employeeId: mongoose.Types.ObjectId,
  monthStart: Date,
  monthEnd: Date
): Promise<number> {
  let workingDays = 0;
  const currentDate = new Date(monthStart);

  while (currentDate <= monthEnd) {
    const assignedShift = await getAssignedShift(employeeId, currentDate);
    if (assignedShift && assignedShift.shift) {
      const dayOfWeek = getDayOfWeek(currentDate);
      if (assignedShift.shift.workingDays.includes(dayOfWeek)) {
        workingDays++;
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return workingDays;
}

/**
 * Get active salary structure for an employee
 */
export async function getActiveSalaryStructure(
  employeeId: mongoose.Types.ObjectId | string,
  employeeRole: string,
  effectiveDate: Date
): Promise<any | null> {
  const empId = typeof employeeId === 'string' 
    ? new mongoose.Types.ObjectId(employeeId) 
    : employeeId;

  // First try employee-specific structure
  let structure = await SalaryStructure.findOne({
    employeeId: empId,
    isActive: true,
    effectiveFrom: { $lte: effectiveDate },
    $or: [
      { effectiveTo: null },
      { effectiveTo: { $gte: effectiveDate } },
    ],
  }).sort({ effectiveFrom: -1 });

  // If not found, try role-based structure
  if (!structure) {
    structure = await SalaryStructure.findOne({
      role: employeeRole,
      employeeId: null,
      isActive: true,
      effectiveFrom: { $lte: effectiveDate },
      $or: [
        { effectiveTo: null },
        { effectiveTo: { $gte: effectiveDate } },
      ],
    }).sort({ effectiveFrom: -1 });
  }

  return structure;
}

