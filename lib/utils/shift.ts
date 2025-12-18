import mongoose from 'mongoose';
import Shift from '@/lib/models/Shift';
import ShiftAssignment from '@/lib/models/ShiftAssignment';
import Roster from '@/lib/models/Roster';
import Leave from '@/lib/models/Leave';
import Employee from '@/lib/models/Employee';

/**
 * Parse time string (HH:mm) to minutes from midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes to time string (HH:mm)
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Get the actual end time considering night shifts
 */
export function getShiftEndTime(startTime: string, endTime: string, isNightShift: boolean): Date {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  
  if (isNightShift && endMinutes < startMinutes) {
    // Night shift: end time is next day
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 1);
    endDate.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
    return endDate;
  } else {
    // Regular shift: same day
    const endDate = new Date();
    endDate.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
    return endDate;
  }
}

/**
 * Check if check-in time is late based on shift rules
 */
export function isLateCheckIn(
  checkInTime: Date,
  shiftStartTime: string,
  gracePeriod: number
): boolean {
  const checkInMinutes = checkInTime.getHours() * 60 + checkInTime.getMinutes();
  const shiftStartMinutes = timeToMinutes(shiftStartTime);
  const allowedStartMinutes = shiftStartMinutes + gracePeriod;
  
  return checkInMinutes > allowedStartMinutes;
}

/**
 * Check if check-out time is early based on shift rules
 */
export function isEarlyCheckOut(
  checkOutTime: Date,
  shiftStartTime: string,
  shiftEndTime: string,
  gracePeriod: number,
  isNightShift: boolean
): boolean {
  const checkOutMinutes = checkOutTime.getHours() * 60 + checkOutTime.getMinutes();
  const shiftEndMinutes = timeToMinutes(shiftEndTime);
  
  if (isNightShift && shiftEndMinutes < timeToMinutes(shiftStartTime)) {
    // Night shift: check if checkout is before end time (next day)
    const allowedEndMinutes = shiftEndMinutes - gracePeriod;
    return checkOutMinutes < allowedEndMinutes;
  } else {
    const allowedEndMinutes = shiftEndMinutes - gracePeriod;
    return checkOutMinutes < allowedEndMinutes;
  }
}

/**
 * Get assigned shift for an employee on a specific date
 * Priority: Roster > Temporary Assignment > Permanent Assignment
 */
export async function getAssignedShift(
  employeeId: mongoose.Types.ObjectId | string,
  date: Date
): Promise<{ shiftId: mongoose.Types.ObjectId; shift: any } | null> {
  const empId = typeof employeeId === 'string' ? new mongoose.Types.ObjectId(employeeId) : employeeId;
  
  // Normalize date to start of day
  const queryDate = new Date(date);
  queryDate.setHours(0, 0, 0, 0);
  
  // 1. Check roster first (highest priority)
  const roster = await Roster.findOne({
    employeeId: empId,
    date: queryDate,
  }).populate('shiftId');
  
  if (roster && roster.shiftId) {
    return {
      shiftId: roster.shiftId._id,
      shift: roster.shiftId,
    };
  }
  
  // 2. Check temporary assignments
  const tempAssignment = await ShiftAssignment.findOne({
    employeeId: empId,
    assignmentType: 'temporary',
    isActive: true,
    startDate: { $lte: queryDate },
    endDate: { $gte: queryDate },
  }).populate('shiftId');
  
  if (tempAssignment && tempAssignment.shiftId) {
    return {
      shiftId: tempAssignment.shiftId._id,
      shift: tempAssignment.shiftId,
    };
  }
  
  // 3. Check permanent assignments
  const permanentAssignment = await ShiftAssignment.findOne({
    employeeId: empId,
    assignmentType: 'permanent',
    isActive: true,
    effectiveDate: { $lte: queryDate },
  }).populate('shiftId');
  
  if (permanentAssignment && permanentAssignment.shiftId) {
    return {
      shiftId: permanentAssignment.shiftId._id,
      shift: permanentAssignment.shiftId,
    };
  }
  
  // 4. Check team assignments
  const employee = await Employee.findById(empId);
  if (employee && employee.managerId) {
    const teamAssignment = await ShiftAssignment.findOne({
      teamManagerId: employee.managerId,
      assignmentType: 'permanent',
      isActive: true,
      effectiveDate: { $lte: queryDate },
    }).populate('shiftId');
    
    if (teamAssignment && teamAssignment.shiftId) {
      return {
        shiftId: teamAssignment.shiftId._id,
        shift: teamAssignment.shiftId,
      };
    }
  }
  
  // 5. Check department assignments
  if (employee && employee.role) {
    const deptAssignment = await ShiftAssignment.findOne({
      departmentRole: employee.role,
      assignmentType: 'permanent',
      isActive: true,
      effectiveDate: { $lte: queryDate },
    }).populate('shiftId');
    
    if (deptAssignment && deptAssignment.shiftId) {
      return {
        shiftId: deptAssignment.shiftId._id,
        shift: deptAssignment.shiftId,
      };
    }
  }
  
  return null;
}

/**
 * Check for conflicts when assigning a shift
 */
export async function checkShiftConflicts(
  employeeId: mongoose.Types.ObjectId | string,
  date: Date,
  shiftId: mongoose.Types.ObjectId | string
): Promise<{ hasConflict: boolean; conflicts: string[] }> {
  try {
    const empId = typeof employeeId === 'string' ? new mongoose.Types.ObjectId(employeeId) : employeeId;
    const sId = typeof shiftId === 'string' ? new mongoose.Types.ObjectId(shiftId) : shiftId;
    
    const conflicts: string[] = [];
    const queryDate = new Date(date);
    queryDate.setHours(0, 0, 0, 0);
    
    // Check for leave overlap
    const leave = await Leave.findOne({
      employeeId: empId,
      status: { $in: ['pending', 'approved'] },
      startDate: { $lte: queryDate },
      endDate: { $gte: queryDate },
    });
    
    if (leave) {
      conflicts.push(`Employee has ${leave.status} leave on this date`);
    }
    
    // Check for weekly off
    const shift = await Shift.findById(sId);
    if (shift) {
      const dayOfWeek = getDayOfWeek(queryDate);
      if (!shift.workingDays.includes(dayOfWeek as any)) {
        conflicts.push(`Shift is not active on ${dayOfWeek}`);
      }
    }
    
    // Check for existing roster entry
    const existingRoster = await Roster.findOne({
      employeeId: empId,
      date: queryDate,
    });
    
    if (existingRoster && existingRoster.shiftId.toString() !== sId.toString()) {
      conflicts.push(`Employee already has a different shift assigned on this date`);
    }
    
    return {
      hasConflict: conflicts.length > 0,
      conflicts,
    };
  } catch (error) {
    console.error('Error checking shift conflicts:', error);
    // Return no conflicts on error to allow assignment to proceed
    return {
      hasConflict: false,
      conflicts: [],
    };
  }
}

/**
 * Get day of week name
 */
export function getDayOfWeek(date: Date): string {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return dayNames[date.getDay()];
}

/**
 * Calculate working hours considering break
 */
export function calculateWorkingHours(
  checkIn: Date,
  checkOut: Date,
  breakDuration: number,
  isBreakPaid: boolean
): number {
  const totalMinutes = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60);
  const workingMinutes = isBreakPaid ? totalMinutes : totalMinutes - breakDuration;
  return Math.max(0, workingMinutes);
}

/**
 * Validate shift times
 */
export function validateShiftTimes(
  startTime: string,
  endTime: string,
  isNightShift: boolean
): { valid: boolean; error?: string } {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  
  if (!isNightShift && endMinutes <= startMinutes) {
    return {
      valid: false,
      error: 'End time must be after start time for non-night shifts',
    };
  }
  
  if (isNightShift && endMinutes === startMinutes) {
    return {
      valid: false,
      error: 'Start and end times cannot be the same',
    };
  }
  
  return { valid: true };
}

/**
 * Get employees under a manager (team)
 */
export async function getTeamEmployees(managerId: mongoose.Types.ObjectId | string): Promise<mongoose.Types.ObjectId[]> {
  const mId = typeof managerId === 'string' ? new mongoose.Types.ObjectId(managerId) : managerId;
  const employees = await Employee.find({
    managerId: mId,
    isActive: true,
  }).select('_id');
  
  return employees.map((e) => e._id);
}

/**
 * Get employees by department role
 */
export async function getDepartmentEmployees(role: string): Promise<mongoose.Types.ObjectId[]> {
  const employees = await Employee.find({
    role,
    isActive: true,
  }).select('_id');
  
  return employees.map((e) => e._id);
}

