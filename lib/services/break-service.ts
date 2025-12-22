/**
 * Break Management Service
 * Handles all break-related business logic
 */

import connectDB from '../mongodb';
import BreakSession, { IBreakSession } from '../models/BreakSession';
import BreakPolicy, { IBreakPolicy } from '../models/BreakPolicy';
import Attendance from '../models/Attendance';
import Employee from '../models/Employee';
import { getStartOfDay, getEndOfDay } from '../utils/attendance';
import mongoose from 'mongoose';

interface BreakValidationResult {
  allowed: boolean;
  reason?: string;
  remainingBreaks?: number;
  remainingBreakTime?: number;
}

interface BreakSummary {
  activeBreak?: any;
  completedBreaks: any[];
  totalBreakTime: number;
  remainingBreaks: number;
  remainingBreakTime: number;
  policy: any;
}

class BreakService {
  /**
   * Get effective break policy for employee on a given date
   */
  async getEffectivePolicy(
    employeeId: mongoose.Types.ObjectId,
    date: Date
  ): Promise<IBreakPolicy | null> {
    await connectDB();

    const employee = await Employee.findById(employeeId);
    if (!employee) return null;

    const policies = await BreakPolicy.find({
      isActive: true,
      effectiveFrom: { $lte: date },
      $or: [
        { effectiveTo: null },
        { effectiveTo: { $gte: date } },
      ],
    }).sort({ scope: 1 }); // Priority: specific to general

    // Check policies in order of specificity
    for (const policy of policies) {
      if (policy.scope === 'global') {
        return policy;
      }
      if (policy.scope === 'employee' && policy.scopeIds.includes(employeeId)) {
        return policy;
      }
      // Note: Department-based policies are skipped as Employee model doesn't have departmentId
      // To enable department-based policies, add departmentId field to Employee model
      if (
        policy.scope === 'role' &&
        employee.role &&
        policy.scopeIds.some((id) => id.toString() === employee.role)
      ) {
        return policy;
      }
    }

    // Return null if no policy found (will use default behavior)
    return null;
  }

  /**
   * Get default break policy (deprecated - using null instead)
   */
  private getDefaultPolicy(): Partial<IBreakPolicy> {
    return {
      name: 'Default Policy',
      scope: 'global',
      allowBreaks: true,
      maxBreaksPerDay: 3,
      maxTotalBreakDuration: 60,
      maxDurationPerBreak: 30,
      allowedBreakTypes: ['lunch', 'tea', 'personal', 'emergency'],
      mandatoryBreaks: [],
      deductBreakTime: true,
      paidBreaks: ['lunch'],
      autoFlagExcessiveBreaks: true,
      allowBreakOverrun: false,
      effectiveFrom: new Date(),
      isActive: true,
    } as Partial<IBreakPolicy>;
  }

  /**
   * Validate if employee can start a break
   */
  async validateBreakStart(
    employeeId: mongoose.Types.ObjectId,
    breakType: string
  ): Promise<BreakValidationResult> {
    await connectDB();

    const today = getStartOfDay(new Date());
    const todayEnd = getEndOfDay(new Date());

    // Get today's attendance
    const attendance = await Attendance.findOne({
      employeeId,
      date: {
        $gte: today,
        $lte: todayEnd,
      },
    }).populate('breaks');

    if (!attendance || !attendance.checkIn) {
      return {
        allowed: false,
        reason: 'You must check in before taking a break',
      };
    }

    if (attendance.checkOut) {
      return {
        allowed: false,
        reason: 'Cannot take break after check out',
      };
    }

    // Check if already on break
    const activeBreak = await BreakSession.findOne({
      attendanceId: attendance._id,
      status: 'active',
    });

    if (activeBreak) {
      return {
        allowed: false,
        reason: 'You are already on a break. Please end current break first.',
      };
    }

    // Check if emergency break - emergency breaks bypass most restrictions
    const isEmergencyBreak = breakType === 'emergency';

    // Get effective policy
    const policy = await this.getEffectivePolicy(employeeId, new Date());

    // Emergency breaks are always allowed, even if breaks are disabled
    if (!isEmergencyBreak && (!policy || !policy.allowBreaks)) {
      return {
        allowed: false,
        reason: 'Breaks are not allowed for your role',
      };
    }

    // Check break type is allowed
    // Emergency breaks are always allowed, bypassing policy restrictions
    if (!isEmergencyBreak && policy && !policy.allowedBreakTypes.includes(breakType)) {
      return {
        allowed: false,
        reason: `${breakType} break is not allowed`,
      };
    }

    // Get today's breaks
    const todayBreaks = await BreakSession.find({
      attendanceId: attendance._id,
      status: { $in: ['completed', 'auto_completed'] },
    });

    // For emergency breaks, skip most policy restrictions
    if (!isEmergencyBreak && policy) {
      // Check max breaks per day
      if (policy.maxBreaksPerDay && todayBreaks.length >= policy.maxBreaksPerDay) {
        return {
          allowed: false,
          reason: `Maximum ${policy.maxBreaksPerDay} breaks per day allowed`,
          remainingBreaks: 0,
        };
      }

      // Check total break time
      const totalBreakTime = todayBreaks.reduce((sum, b) => sum + (b.duration || 0), 0);
      if (policy.maxTotalBreakDuration && totalBreakTime >= policy.maxTotalBreakDuration) {
        return {
          allowed: false,
          reason: `Daily break limit of ${policy.maxTotalBreakDuration} minutes reached`,
          remainingBreakTime: 0,
        };
      }

      // Check minimum working hours before first break
      // Skip this check in development mode
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      if (policy.minWorkingHoursBeforeFirstBreak && todayBreaks.length === 0) {
        if (isDevelopment) {
          // Skip minimum working hours check in development mode
          console.log('⚠️  Minimum working hours check skipped in development mode.');
        } else {
          const workingHours = (new Date().getTime() - attendance.checkIn.getTime()) / (1000 * 60 * 60);
          if (workingHours < policy.minWorkingHoursBeforeFirstBreak) {
            return {
              allowed: false,
              reason: `You must work at least ${policy.minWorkingHoursBeforeFirstBreak} hours before taking first break`,
            };
          }
        }
      }
    }

    const totalBreakTime = todayBreaks.reduce((sum, b) => sum + (b.duration || 0), 0);
    return {
      allowed: true,
      remainingBreaks: policy && policy.maxBreaksPerDay
        ? policy.maxBreaksPerDay - todayBreaks.length
        : undefined,
      remainingBreakTime: policy && policy.maxTotalBreakDuration
        ? policy.maxTotalBreakDuration - totalBreakTime
        : undefined,
    };
  }

  /**
   * Start a break
   */
  async startBreak(
    employeeId: mongoose.Types.ObjectId,
    breakType: string,
    notes?: string
  ): Promise<{ success: boolean; breakSession?: any; error?: string }> {
    await connectDB();

    const today = getStartOfDay(new Date());
    const todayEnd = getEndOfDay(new Date());

    // Get today's attendance
    const attendance = await Attendance.findOne({
      employeeId,
      date: {
        $gte: today,
        $lte: todayEnd,
      },
    });

    if (!attendance) {
      return {
        success: false,
        error: 'No attendance record found. Please check in first.',
      };
    }

    // Validate break start
    const validation = await this.validateBreakStart(employeeId, breakType);
    if (!validation.allowed) {
      return {
        success: false,
        error: validation.reason || 'Break not allowed',
      };
    }

    // Get policy
    const policy = await this.getEffectivePolicy(employeeId, new Date());
    const isPaid = policy?.paidBreaks?.includes(breakType) ?? true;

    // Create break session
    const breakSession = await BreakSession.create({
      attendanceId: attendance._id,
      employeeId,
      breakType: breakType as any,
      startTime: new Date(),
      status: 'active',
      isPaid,
      policyId: policy?._id,
      notes,
    });

    // Update attendance
    if (!attendance.breaks) {
      attendance.breaks = [];
    }
    attendance.breaks.push(breakSession._id);
    await attendance.save();

    return {
      success: true,
      breakSession: {
        id: breakSession._id,
        startTime: breakSession.startTime,
        breakType: breakSession.breakType,
        status: breakSession.status,
        isPaid: breakSession.isPaid,
      },
    };
  }

  /**
   * End a break
   */
  async endBreak(
    employeeId: mongoose.Types.ObjectId,
    breakSessionId?: mongoose.Types.ObjectId
  ): Promise<{ success: boolean; breakSession?: any; error?: string }> {
    await connectDB();

    const today = getStartOfDay(new Date());
    const todayEnd = getEndOfDay(new Date());

    // Get today's attendance
    const attendance = await Attendance.findOne({
      employeeId,
      date: {
        $gte: today,
        $lte: todayEnd,
      },
    });

    if (!attendance) {
      return {
        success: false,
        error: 'No attendance record found',
      };
    }

    // Find active break
    let breakSession;
    if (breakSessionId) {
      breakSession = await BreakSession.findOne({
        _id: breakSessionId,
        attendanceId: attendance._id,
        employeeId,
        status: 'active',
      });
    } else {
      breakSession = await BreakSession.findOne({
        attendanceId: attendance._id,
        employeeId,
        status: 'active',
      });
    }

    if (!breakSession) {
      return {
        success: false,
        error: 'No active break found',
      };
    }

    // End break
    const endTime = new Date();
    breakSession.endTime = endTime;
    breakSession.status = 'completed';
    breakSession.duration = Math.floor(
      (endTime.getTime() - breakSession.startTime.getTime()) / (1000 * 60)
    );

    // Validate against policy
    const policy = await this.getEffectivePolicy(employeeId, new Date());
    if (policy) {
      // Check break duration
      if (
        policy.maxDurationPerBreak &&
        breakSession.duration > policy.maxDurationPerBreak + (policy.gracePeriod || 0)
      ) {
        breakSession.violationFlags.exceededDuration = true;
        breakSession.violationFlags.policyViolation = true;
        breakSession.violationFlags.reason = `Break duration exceeded limit of ${policy.maxDurationPerBreak} minutes`;

        if (!policy.allowBreakOverrun) {
          // Auto-flag for HR review
          attendance.breakViolations = attendance.breakViolations || {};
          attendance.breakViolations.policyViolations =
            attendance.breakViolations.policyViolations || [];
          attendance.breakViolations.policyViolations.push(
            `Break duration exceeded: ${breakSession.duration} minutes`
          );
        }
      }

      // Check total break time
      const todayBreaks = await BreakSession.find({
        attendanceId: attendance._id,
        status: { $in: ['completed', 'auto_completed'] },
        _id: { $ne: breakSession._id },
      });
      const totalBreakTime =
        todayBreaks.reduce((sum, b) => sum + (b.duration || 0), 0) + breakSession.duration;

      if (
        policy.maxTotalBreakDuration &&
        totalBreakTime > policy.maxTotalBreakDuration
      ) {
        breakSession.violationFlags.exceededDailyLimit = true;
        breakSession.violationFlags.policyViolation = true;
        attendance.breakViolations = attendance.breakViolations || {};
        attendance.breakViolations.exceededDailyLimit = true;
      }
    }

    await breakSession.save();

    // Update attendance break totals
    await this.updateAttendanceBreakTotals(attendance._id);

    return {
      success: true,
      breakSession: {
        id: breakSession._id,
        startTime: breakSession.startTime,
        endTime: breakSession.endTime,
        duration: breakSession.duration,
        status: breakSession.status,
        violationFlags: breakSession.violationFlags,
      },
    };
  }

  /**
   * Auto-end break on check-out
   */
  async autoEndBreakOnCheckout(attendanceId: mongoose.Types.ObjectId): Promise<void> {
    await connectDB();

    const activeBreak = await BreakSession.findOne({
      attendanceId,
      status: 'active',
    });

    if (activeBreak) {
      activeBreak.endTime = new Date();
      activeBreak.status = 'auto_completed';
      activeBreak.duration = Math.floor(
        (activeBreak.endTime.getTime() - activeBreak.startTime.getTime()) / (1000 * 60)
      );
      await activeBreak.save();

      // Update attendance break totals
      await this.updateAttendanceBreakTotals(attendanceId);
    }
  }

  /**
   * Update attendance break totals
   */
  async updateAttendanceBreakTotals(attendanceId: mongoose.Types.ObjectId): Promise<void> {
    await connectDB();

    const attendance = await Attendance.findById(attendanceId).populate('breaks');
    if (!attendance) return;

    const breaks = await BreakSession.find({
      attendanceId,
      status: { $in: ['completed', 'auto_completed'] },
    });

    // Calculate total break duration
    const totalBreakDuration = breaks.reduce((sum, b) => sum + (b.duration || 0), 0);
    attendance.totalBreakDuration = totalBreakDuration;

    // Calculate net working hours
    if (attendance.checkIn && attendance.checkOut) {
      const totalTime = Math.floor(
        (attendance.checkOut.getTime() - attendance.checkIn.getTime()) / (1000 * 60)
      );

      // Get policy to determine if breaks should be deducted
      const policy = await this.getEffectivePolicy(
        attendance.employeeId as any,
        attendance.date
      );

      if (policy?.deductBreakTime) {
        // Deduct unpaid breaks only
        const unpaidBreakTime = breaks
          .filter((b) => !b.isPaid)
          .reduce((sum, b) => sum + (b.duration || 0), 0);
        attendance.netWorkingHours = totalTime - unpaidBreakTime;
      } else {
        // All breaks are paid, don't deduct
        attendance.netWorkingHours = totalTime;
      }
    }

    await attendance.save();
  }

  /**
   * Get today's break summary
   */
  async getTodayBreakSummary(
    employeeId: mongoose.Types.ObjectId
  ): Promise<BreakSummary | null> {
    await connectDB();

    const today = getStartOfDay(new Date());
    const todayEnd = getEndOfDay(new Date());

    const attendance = await Attendance.findOne({
      employeeId,
      date: {
        $gte: today,
        $lte: todayEnd,
      },
    });

    if (!attendance) {
      return null;
    }

    // Get all breaks for today
    const allBreaks = await BreakSession.find({
      attendanceId: attendance._id,
    }).sort({ startTime: 1 });

    // Also check directly for active break to ensure we catch it
    // Find active break - check directly first, then fallback to array search
    let activeBreak = await BreakSession.findOne({
      attendanceId: attendance._id,
      status: 'active',
    });
    
    // Fallback to array search if direct query didn't find it
    if (!activeBreak) {
      activeBreak = allBreaks.find((b) => b.status === 'active') || null;
    }
    
    // Debug logging
    if (activeBreak) {
      console.log('Active break found:', {
        id: activeBreak._id,
        breakType: activeBreak.breakType,
        startTime: activeBreak.startTime,
        status: activeBreak.status,
      });
    } else {
      console.log('No active break found for attendance:', attendance._id);
    }
    const completedBreaks = allBreaks.filter(
      (b) => b.status === 'completed' || b.status === 'auto_completed'
    );

    const totalBreakTime = completedBreaks.reduce((sum, b) => sum + (b.duration || 0), 0);

    // Get policy
    const policy = await this.getEffectivePolicy(employeeId, new Date());

    const remainingBreaks = policy?.maxBreaksPerDay
      ? policy.maxBreaksPerDay - completedBreaks.length
      : 999;

    const remainingBreakTime = policy?.maxTotalBreakDuration
      ? policy.maxTotalBreakDuration - totalBreakTime
      : 999;

    return {
      activeBreak: activeBreak
        ? {
            id: activeBreak._id.toString(),
            startTime: activeBreak.startTime.toISOString(),
            breakType: activeBreak.breakType,
            duration: activeBreak.duration || this.calculateBreakDuration(activeBreak),
          }
        : null,
      completedBreaks: completedBreaks.map((b) => ({
        id: b._id,
        breakType: b.breakType,
        startTime: b.startTime,
        endTime: b.endTime,
        duration: b.duration,
        status: b.status,
      })),
      totalBreakTime,
      remainingBreaks: Math.max(0, remainingBreaks),
      remainingBreakTime: Math.max(0, remainingBreakTime),
      policy: policy
        ? {
            maxBreaksPerDay: policy.maxBreaksPerDay,
            maxTotalBreakDuration: policy.maxTotalBreakDuration,
            maxDurationPerBreak: policy.maxDurationPerBreak,
            allowedBreakTypes: policy.allowedBreakTypes,
          }
        : null,
    };
  }

  /**
   * Calculate break duration for active break
   */
  private calculateBreakDuration(breakSession: any): number {
    if (breakSession.endTime) {
      return Math.floor(
        (breakSession.endTime.getTime() - breakSession.startTime.getTime()) / (1000 * 60)
      );
    }
    return Math.floor((new Date().getTime() - breakSession.startTime.getTime()) / (1000 * 60));
  }
}

export const breakService = new BreakService();

