/**
 * Leave management business logic utilities
 */

import { LeaveType, LeaveStatus } from '@/lib/models/Leave';
import mongoose from 'mongoose';

/**
 * Helper function to normalize employeeId to MongoDB ObjectId
 * Handles both MongoDB _id and employee's employeeId string
 */
async function normalizeEmployeeId(employeeId: string | mongoose.Types.ObjectId): Promise<mongoose.Types.ObjectId> {
  // If it's already an ObjectId instance, return it
  if (employeeId instanceof mongoose.Types.ObjectId) {
    return employeeId;
  }

  // Convert to string for validation
  const employeeIdStr = String(employeeId);

  // Check if the string looks like an object representation (contains new ObjectId or has object-like structure)
  if (employeeIdStr.includes('new ObjectId') || employeeIdStr.includes('_id:') || employeeIdStr.includes('employeeId:')) {
    throw new Error(`Invalid employeeId format: received object representation instead of ID. Please pass the MongoDB _id or employee's employeeId string.`);
  }

  // If it's already a valid ObjectId string, return it
  if (mongoose.Types.ObjectId.isValid(employeeIdStr)) {
    return new mongoose.Types.ObjectId(employeeIdStr);
  }

  // Otherwise, find employee by their employeeId string and return their _id
  const { default: Employee } = await import('@/lib/models/Employee');
  const { default: connectDB } = await import('@/lib/mongodb');
  
  await connectDB();
  
  const employee = await Employee.findOne({ employeeId: employeeIdStr });
  if (!employee) {
    throw new Error(`Employee not found: ${employeeIdStr}`);
  }
  
  return employee._id;
}

/**
 * Calculate number of working days between two dates (excluding weekends)
 */
export function calculateWorkingDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  const end = new Date(endDate);

  // Set time to start of day for accurate comparison
  current.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    // Count only weekdays (Monday = 1 to Friday = 5)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Check if dates overlap with existing approved/pending leaves
 */
export async function hasOverlappingLeaves(
  employeeId: string,
  startDate: Date,
  endDate: Date,
  excludeLeaveId?: string
): Promise<boolean> {
  const { default: Leave } = await import('@/lib/models/Leave');
  const { default: connectDB } = await import('@/lib/mongodb');

  await connectDB();

  const normalizedEmployeeId = await normalizeEmployeeId(employeeId);

  const query: any = {
    employeeId: normalizedEmployeeId,
    status: { $in: ['pending', 'approved'] },
    $or: [
      // Leave starts during existing leave
      {
        startDate: { $lte: startDate },
        endDate: { $gte: startDate },
      },
      // Leave ends during existing leave
      {
        startDate: { $lte: endDate },
        endDate: { $gte: endDate },
      },
      // Leave completely contains existing leave
      {
        startDate: { $gte: startDate },
        endDate: { $lte: endDate },
      },
    ],
  };

  if (excludeLeaveId) {
    query._id = { $ne: excludeLeaveId };
  }

  const overlapping = await Leave.findOne(query);
  return !!overlapping;
}

/**
 * Check if employee has sufficient leave balance
 */
export async function hasSufficientBalance(
  employeeId: string,
  leaveType: LeaveType,
  numberOfDays: number,
  year: number = new Date().getFullYear()
): Promise<{ hasBalance: boolean; available: number }> {
  const { default: LeaveBalance } = await import('@/lib/models/LeaveBalance');
  const { default: connectDB } = await import('@/lib/mongodb');

  await connectDB();

  const normalizedEmployeeId = await normalizeEmployeeId(employeeId);

  const balance = await LeaveBalance.findOne({
    employeeId: normalizedEmployeeId,
    leaveType,
    year,
  });

  if (!balance) {
    // If no balance record exists, assume 0 balance
    return { hasBalance: false, available: 0 };
  }

  const available = balance.availableDays;
  return {
    hasBalance: available >= numberOfDays,
    available,
  };
}

/**
 * Update leave balance when leave is approved
 */
export async function updateLeaveBalance(
  employeeId: string,
  leaveType: LeaveType,
  numberOfDays: number,
  operation: 'add' | 'subtract',
  year: number = new Date().getFullYear()
): Promise<void> {
  const { default: LeaveBalance } = await import('@/lib/models/LeaveBalance');
  const { default: connectDB } = await import('@/lib/mongodb');

  await connectDB();

  const normalizedEmployeeId = await normalizeEmployeeId(employeeId);

  const balance = await LeaveBalance.findOneAndUpdate(
    { employeeId: normalizedEmployeeId, leaveType, year },
    {
      $inc: {
        usedDays: operation === 'add' ? numberOfDays : -numberOfDays,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  // Recalculate available days
  balance.availableDays = balance.totalDays - balance.usedDays;
  await balance.save();
}

/**
 * Get leave balance for an employee
 */
export async function getLeaveBalance(
  employeeId: string,
  year: number = new Date().getFullYear()
): Promise<Record<LeaveType, { total: number; used: number; available: number }>> {
  const { default: LeaveBalance } = await import('@/lib/models/LeaveBalance');
  const { default: connectDB } = await import('@/lib/mongodb');

  await connectDB();

  const normalizedEmployeeId = await normalizeEmployeeId(employeeId);

  const balances = await LeaveBalance.find({ employeeId: normalizedEmployeeId, year });
  const result: Record<string, { total: number; used: number; available: number }> = {};

  const leaveTypes: LeaveType[] = ['paid', 'unpaid', 'sick', 'casual', 'annual'];

  leaveTypes.forEach((type) => {
    const balance = balances.find((b) => b.leaveType === type);
    result[type] = {
      total: balance?.totalDays || 0,
      used: balance?.usedDays || 0,
      available: balance?.availableDays || 0,
    };
  });

  return result as Record<LeaveType, { total: number; used: number; available: number }>;
}

/**
 * Validate leave application dates
 */
export function validateLeaveDates(startDate: Date, endDate: Date): {
  valid: boolean;
  error?: string;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  if (start < today) {
    return { valid: false, error: 'Start date cannot be in the past' };
  }

  if (end < start) {
    return { valid: false, error: 'End date cannot be before start date' };
  }

  const daysDiff = calculateWorkingDays(start, end);
  if (daysDiff === 0) {
    return { valid: false, error: 'Start and end date must span at least one working day' };
  }

  return { valid: true };
}

/**
 * Check if leave type requires balance (paid leaves need balance)
 */
export function requiresBalance(leaveType: LeaveType): boolean {
  return leaveType !== 'unpaid';
}

/**
 * Get status badge color
 */
export function getStatusColor(status: LeaveStatus): string {
  switch (status) {
    case 'approved':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'cancelled':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
}

