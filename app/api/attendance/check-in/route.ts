import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import { getUserSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import Attendance from '@/lib/models/Attendance';
import Employee from '@/lib/models/Employee';
import AttendanceAttemptLog from '@/lib/models/AttendanceAttemptLog';
import { getStartOfDay, getEndOfDay } from '@/lib/utils/attendance';
import { getAssignedShift, isLateCheckIn } from '@/lib/utils/shift';
import { validateWiFiForAttendance } from '@/lib/utils/wifi-validation';

export async function POST(req: NextRequest) {
  try {
    const session = await getUserSession(req, auth);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only employees can check in
    if (session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Only employees can check in' }, { status: 403 });
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

    // Check if already checked in today
    const existingAttendance = await Attendance.findOne({
      employeeId: employee._id,
      date: {
        $gte: today,
        $lte: getEndOfDay(now),
      },
    });

    if (existingAttendance) {
      return NextResponse.json(
        { error: 'Already checked in today' },
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
        attemptType: 'check_in',
        timestamp: now,
      });

      // Log the attempt
      await AttendanceAttemptLog.create({
        employeeId: employee._id,
        attemptType: 'check_in',
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

      // If validation failed and no override, block check-in
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

    // Get assigned shift for today
    const assignedShift = await getAssignedShift(employee._id, today);
    let late = false;
    let shiftId = null;

    if (assignedShift && assignedShift.shift) {
      shiftId = assignedShift.shiftId;
      // Check if late based on shift rules
      late = isLateCheckIn(now, assignedShift.shift.startTime, assignedShift.shift.gracePeriod);
    } else {
      // Fallback to default check if no shift assigned
      const defaultStartTime = '09:00';
      const defaultGracePeriod = 15;
      late = isLateCheckIn(now, defaultStartTime, defaultGracePeriod);
    }

    // Create attendance record
    const attendance = await Attendance.create({
      employeeId: employee._id,
      date: today,
      checkIn: now,
      isLate: late,
      status: 'present',
      shiftId: shiftId,
      wifiSSID: wifiData.wifiSSID,
      wifiBSSID: wifiData.wifiBSSID,
      wifiValidated: wifiValidationResult?.wifiValid ?? false,
      overrideId: overrideId,
    });

    return NextResponse.json({
      message: 'Checked in successfully',
      attendance: {
        id: attendance._id,
        checkIn: attendance.checkIn,
        isLate: attendance.isLate,
        date: attendance.date,
        wifiValidated: attendance.wifiValidated,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

