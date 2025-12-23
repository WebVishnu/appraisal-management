import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import { getUserSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import Employee from '@/lib/models/Employee';
import { validateWiFiForAttendance } from '@/lib/utils/wifi-validation';

export async function POST(req: NextRequest) {
  try {
    const session = await getUserSession(req, auth);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only employees can validate WiFi
    if (session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Only employees can validate WiFi' }, { status: 403 });
    }

    if (!session.user.employeeId) {
      return NextResponse.json({ error: 'Employee ID not found' }, { status: 400 });
    }

    await connectDB();

    // Verify employee exists
    const employee = await Employee.findById(session.user.employeeId);
    if (!employee || !employee.isActive) {
      return NextResponse.json({ error: 'Employee not found or inactive' }, { status: 404 });
    }

    // Parse request body
    const body = await req.json();
    const {
      wifiSSID,
      wifiBSSID,
      isWiFiConnected,
      isMobileData,
      attemptType = 'check_in',
    } = body;

    // Validate WiFi
    const validationResult = await validateWiFiForAttendance({
      employeeId: employee._id,
      wifiSSID,
      wifiBSSID,
      isWiFiConnected: isWiFiConnected ?? false,
      isMobileData: isMobileData ?? false,
      attemptType: attemptType as 'check_in' | 'check_out',
      timestamp: new Date(),
    });

    return NextResponse.json({
      allowed: validationResult.allowed,
      wifiValid: validationResult.wifiValid,
      policyApplied: validationResult.policyApplied,
      reason: validationResult.reason,
      allowedNetworks: validationResult.allowedNetworks,
      overrideId: validationResult.overrideId,
    });
  } catch (error) {
    console.error('Error validating WiFi:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

