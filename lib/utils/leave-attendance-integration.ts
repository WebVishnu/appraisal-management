/**
 * Integration logic between Leave and Attendance systems
 * When a leave is approved, it should be reflected in attendance records
 */

import Attendance from '@/lib/models/Attendance';
import { getStartOfDay, getEndOfDay } from './attendance';

/**
 * Create attendance records for approved leave days
 * This marks the days as "on leave" in the attendance system
 */
export async function createLeaveAttendanceRecords(
  employeeId: string,
  startDate: Date,
  endDate: Date,
  leaveType: string
): Promise<void> {
  const { default: connectDB } = await import('@/lib/mongodb');
  await connectDB();

  const start = getStartOfDay(startDate);
  const end = getEndOfDay(endDate);
  const current = new Date(start);

  // Create attendance records for each day of leave
  while (current <= end) {
    const dayOfWeek = current.getDay();
    
    // Only create records for weekdays (Monday-Friday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const dayStart = getStartOfDay(new Date(current));
      
      // Check if attendance record already exists for this day
      const existing = await Attendance.findOne({
        employeeId,
        date: {
          $gte: dayStart,
          $lte: getEndOfDay(new Date(current)),
        },
      });

      // Only create if no record exists (to avoid overwriting actual check-in/out)
      if (!existing) {
        await Attendance.create({
          employeeId,
          date: dayStart,
          checkIn: dayStart, // Set check-in to start of day
          checkOut: getEndOfDay(new Date(current)), // Set check-out to end of day
          workingHours: 8 * 60, // 8 hours in minutes
          isLate: false,
          isEarlyExit: false,
          status: 'present',
          notes: `On ${leaveType} leave`,
        });
      }
    }

    current.setDate(current.getDate() + 1);
  }
}

/**
 * Remove attendance records created for a leave when it's rejected or cancelled
 */
export async function removeLeaveAttendanceRecords(
  employeeId: string,
  startDate: Date,
  endDate: Date
): Promise<void> {
  const { default: connectDB } = await import('@/lib/mongodb');
  await connectDB();

  const start = getStartOfDay(startDate);
  const end = getEndOfDay(endDate);

  // Find and delete attendance records that were created for this leave
  // We identify them by checking if they have notes indicating they're leave records
  await Attendance.deleteMany({
    employeeId,
    date: {
      $gte: start,
      $lte: end,
    },
    notes: { $regex: /leave/i }, // Match any note containing "leave"
  });
}

/**
 * Update attendance records when leave dates are modified
 */
export async function updateLeaveAttendanceRecords(
  employeeId: string,
  oldStartDate: Date,
  oldEndDate: Date,
  newStartDate: Date,
  newEndDate: Date,
  leaveType: string
): Promise<void> {
  // Remove old records
  await removeLeaveAttendanceRecords(employeeId, oldStartDate, oldEndDate);
  
  // Create new records
  await createLeaveAttendanceRecords(employeeId, newStartDate, newEndDate, leaveType);
}

