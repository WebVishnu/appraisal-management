/**
 * Attendance business logic utilities
 */

// Standard working hours configuration
export const WORK_START_TIME = 9; // 9:00 AM
export const WORK_END_TIME = 18; // 6:00 PM
export const LATE_THRESHOLD_MINUTES = 15; // 15 minutes grace period
export const MIN_WORKING_HOURS = 8; // Minimum 8 hours for full day
export const HALF_DAY_HOURS = 4; // 4 hours for half day

/**
 * Calculate working hours in minutes between check-in and check-out
 * Handles night shifts (check-out on next day)
 */
export function calculateWorkingHours(checkIn: Date, checkOut: Date): number {
  const diffMs = checkOut.getTime() - checkIn.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  return diffMinutes;
}

/**
 * Check if check-in is late based on standard work start time
 */
export function isLateCheckIn(checkInTime: Date): boolean {
  const checkInHour = checkInTime.getHours();
  const checkInMinute = checkInTime.getMinutes();
  const checkInTotalMinutes = checkInHour * 60 + checkInMinute;
  const workStartTotalMinutes = WORK_START_TIME * 60 + LATE_THRESHOLD_MINUTES;
  
  return checkInTotalMinutes > workStartTotalMinutes;
}

/**
 * Check if check-out is early based on standard work end time
 */
export function isEarlyCheckOut(checkOutTime: Date, checkInTime: Date): boolean {
  const workingHours = calculateWorkingHours(checkInTime, checkOutTime);
  const minWorkingMinutes = MIN_WORKING_HOURS * 60;
  
  return workingHours < minWorkingMinutes;
}

/**
 * Determine attendance status based on check-in/check-out times
 */
export function determineAttendanceStatus(
  checkIn: Date,
  checkOut: Date | null,
  workingHours: number | null
): 'present' | 'absent' | 'half_day' | 'missed_checkout' {
  if (!checkOut) {
    return 'missed_checkout';
  }

  if (!workingHours) {
    return 'absent';
  }

  const workingHoursDecimal = workingHours / 60;

  if (workingHoursDecimal >= MIN_WORKING_HOURS) {
    return 'present';
  } else if (workingHoursDecimal >= HALF_DAY_HOURS) {
    return 'half_day';
  } else {
    return 'absent';
  }
}

/**
 * Get start of day in local timezone
 */
export function getStartOfDay(date: Date = new Date()): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Get end of day in local timezone
 */
export function getEndOfDay(date: Date = new Date()): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Format minutes to HH:MM format
 */
export function formatWorkingHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if check-in already exists for today
 */
export async function hasCheckedInToday(
  employeeId: string,
  date: Date = new Date()
): Promise<boolean> {
  const { default: Attendance } = await import('@/lib/models/Attendance');
  const { default: connectDB } = await import('@/lib/mongodb');
  
  await connectDB();
  
  const startOfDay = getStartOfDay(date);
  const endOfDay = getEndOfDay(date);
  
  const attendance = await Attendance.findOne({
    employeeId,
    date: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  });
  
  return !!attendance;
}

