import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import { getUserSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import Attendance from '@/lib/models/Attendance';
import Employee from '@/lib/models/Employee';
import AttendanceAttemptLog from '@/lib/models/AttendanceAttemptLog';
import {
  getStartOfDay,
  getEndOfDay,
} from '@/lib/utils/attendance';
import { isEarlyCheckOut, calculateWorkingHours } from '@/lib/utils/shift';
import Shift from '@/lib/models/Shift';
import { breakService } from '@/lib/services/break-service';
import { validateWiFiForAttendance } from '@/lib/utils/wifi-validation';

export async function POST(req: NextRequest) {
  try {
    const session = await getUserSession(req, auth);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only employees can check out
    if (session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Only employees can check out' }, { status: 403 });
    }

    if (!session.user.employeeId) {
      return NextResponse.json({ error: 'Employee ID not found' }, { status: 400 });
    }

    await connectDB();

    // Parse request body for WiFi information
    let wifiData: {
      wifiSSID?: string;
      wifiBSSID?: string;
      isWiFiConnected: boolean;
      isMobileData: boolean;
      deviceInfo?: {
        platform: string;
        deviceId?: string;
        appVersion?: string;
      };
    } = {
      isWiFiConnected: false,
      isMobileData: false,
    };

    try {
      const body = await req.json().catch(() => ({}));
      wifiData = {
        wifiSSID: body.wifiSSID,
        wifiBSSID: body.wifiBSSID,
        isWiFiConnected: body.isWiFiConnected ?? false,
        isMobileData: body.isMobileData ?? false,
        deviceInfo: body.deviceInfo,
      };
    } catch (error) {
      // If no body, continue with defaults (web dashboard may not send WiFi data)
    }

    // Verify employee exists and is active
    const employee = await Employee.findOne({ email: session.user.email });
    if (!employee || !employee.isActive) {
      return NextResponse.json({ error: 'Employee not found or inactive' }, { status: 404 });
    }

    const now = new Date();
    const today = getStartOfDay(now);

    // Find today's attendance record
    const attendance = await Attendance.findOne({
      employeeId: employee._id,
      date: {
        $gte: today,
        $lte: getEndOfDay(now),
      },
    }).populate('shiftId');

    if (!attendance) {
      return NextResponse.json(
        { error: 'No check-in found for today' },
        { status: 400 }
      );
    }

    if (attendance.checkOut) {
      return NextResponse.json(
        { error: 'Already checked out today' },
        { status: 400 }
      );
    }

    // Validate WiFi (only for mobile app requests with WiFi data)
    let wifiValidationResult = null;
    let overrideId = null;

    if (wifiData.isWiFiConnected !== undefined || wifiData.wifiSSID) {
      wifiValidationResult = await validateWiFiForAttendance({
        employeeId: employee._id,
        wifiSSID: wifiData.wifiSSID,
        wifiBSSID: wifiData.wifiBSSID,
        isWiFiConnected: wifiData.isWiFiConnected,
        isMobileData: wifiData.isMobileData,
        attemptType: 'check_out',
        timestamp: now,
      });

      // Log the attempt
      await AttendanceAttemptLog.create({
        employeeId: employee._id,
        attemptType: 'check_out',
        status: wifiValidationResult.allowed ? 'success' : 'blocked',
        wifiSSID: wifiData.wifiSSID,
        wifiBSSID: wifiData.wifiBSSID,
        isWiFiConnected: wifiData.isWiFiConnected,
        isMobileData: wifiData.isMobileData,
        appliedPolicyId: wifiValidationResult.policyId,
        policyScope: wifiValidationResult.policyScope,
        validationResult: {
          wifiValid: wifiValidationResult.wifiValid,
          policyApplied: wifiValidationResult.policyApplied,
          allowed: wifiValidationResult.allowed,
          reason: wifiValidationResult.reason,
        },
        failureReason: wifiValidationResult.allowed ? undefined : 'wifi_not_allowed',
        failureDetails: wifiValidationResult.allowed ? undefined : wifiValidationResult.reason,
        overrideId: wifiValidationResult.overrideId,
        deviceInfo: wifiData.deviceInfo,
        attemptedAt: now,
      });

      // If validation failed and no override, block check-out
      if (!wifiValidationResult.allowed && !wifiValidationResult.overrideId) {
        return NextResponse.json(
          {
            error: 'WiFi validation failed',
            message: wifiValidationResult.reason,
            allowedNetworks: wifiValidationResult.allowedNetworks,
          },
          { status: 403 }
        );
      }

      overrideId = wifiValidationResult.overrideId || undefined;
    }

    // Get shift details for validation
    let shift = null;
    if (attendance.shiftId && typeof attendance.shiftId === 'object' && '_id' in attendance.shiftId) {
      shift = attendance.shiftId as any;
    } else if (attendance.shiftId) {
      shift = await Shift.findById(attendance.shiftId);
    }

    // Calculate working hours considering shift break
    let workingHours = 0;
    let earlyExit = false;

    if (shift) {
      workingHours = calculateWorkingHours(
        attendance.checkIn,
        now,
        shift.breakDuration || 0,
        shift.isBreakPaid || false
      );
      earlyExit = isEarlyCheckOut(
        now,
        shift.startTime,
        shift.endTime,
        shift.earlyExitGracePeriod || 15,
        shift.isNightShift || false
      );
    } else {
      // Fallback to default calculation
      const diffMs = now.getTime() - attendance.checkIn.getTime();
      workingHours = Math.floor(diffMs / (1000 * 60));
      const minWorkingMinutes = 8 * 60; // 8 hours
      earlyExit = workingHours < minWorkingMinutes;
    }

    // Determine status
    let status: 'present' | 'absent' | 'half_day' | 'missed_checkout' = 'present';
    const workingHoursDecimal = workingHours / 60;
    const minWorkingHours = shift ? (shift.minimumWorkingHours || 480) / 60 : 8;
    const halfDayHours = minWorkingHours / 2;

    if (workingHoursDecimal >= minWorkingHours) {
      status = 'present';
    } else if (workingHoursDecimal >= halfDayHours) {
      status = 'half_day';
    } else {
      status = 'absent';
    }

    // Auto-end any active breaks before check-out
    await breakService.autoEndBreakOnCheckout(attendance._id);

    // Update attendance record
    attendance.checkOut = now;
    attendance.workingHours = workingHours;
    attendance.isEarlyExit = earlyExit;
    attendance.status = status;
    
    // Update WiFi information if provided
    if (wifiData.wifiSSID) {
      attendance.wifiSSID = wifiData.wifiSSID;
      attendance.wifiBSSID = wifiData.wifiBSSID;
      attendance.wifiValidated = wifiValidationResult?.wifiValid ?? false;
      attendance.overrideId = overrideId;
    }
    
    // Recalculate working hours considering breaks
    await breakService.updateAttendanceBreakTotals(attendance._id);
    
    // Refresh attendance to get updated break totals
    await attendance.populate('breaks');
    const updatedAttendance = await Attendance.findById(attendance._id);
    
    // Use net working hours if available, otherwise use calculated hours
    if (updatedAttendance?.netWorkingHours !== null && updatedAttendance?.netWorkingHours !== undefined) {
      attendance.workingHours = updatedAttendance.netWorkingHours;
    }
    
    await attendance.save();

    return NextResponse.json({
      message: 'Checked out successfully',
      attendance: {
        id: attendance._id,
        checkIn: attendance.checkIn,
        checkOut: attendance.checkOut,
        workingHours,
        isEarlyExit: attendance.isEarlyExit,
        status: attendance.status,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

