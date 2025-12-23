/**
 * WiFi Validation Utilities
 * Handles WiFi network validation and policy enforcement
 */

import mongoose from 'mongoose';
import WiFiNetwork from '../models/WiFiNetwork';
import WiFiPolicy from '../models/WiFiPolicy';
import AttendanceOverride from '../models/AttendanceOverride';
import Employee from '../models/Employee';
import ShiftAssignment from '../models/ShiftAssignment';

export interface WiFiValidationRequest {
  employeeId: mongoose.Types.ObjectId;
  wifiSSID?: string;
  wifiBSSID?: string;
  isWiFiConnected: boolean;
  isMobileData: boolean;
  attemptType: 'check_in' | 'check_out';
  timestamp?: Date;
}

export interface WiFiValidationResult {
  allowed: boolean;
  wifiValid: boolean;
  policyApplied: boolean;
  policyId?: mongoose.Types.ObjectId;
  policyScope?: string;
  reason: string;
  overrideId?: mongoose.Types.ObjectId;
  allowedNetworks?: Array<{
    ssid: string;
    bssid?: string;
    location?: string;
  }>;
}

/**
 * Validates if a WiFi network is in the allowed list
 */
export async function validateWiFiNetwork(
  ssid?: string,
  bssid?: string
): Promise<{ valid: boolean; network?: any }> {
  if (!ssid) {
    return { valid: false };
  }

  // Build query for network lookup
  const query: any = {
    ssid: ssid.trim(),
    isActive: true,
  };

  // If BSSID provided, prefer exact match (higher security)
  if (bssid) {
    query.bssid = bssid.trim().toUpperCase();
  }

  // Try exact match first (SSID + BSSID if provided)
  let network = await WiFiNetwork.findOne(query).sort({ priority: -1 });

  // If no exact match and BSSID was provided, try SSID-only match
  if (!network && bssid) {
    network = await WiFiNetwork.findOne({
      ssid: ssid.trim(),
      isActive: true,
      $or: [{ bssid: null }, { bssid: { $exists: false } }], // SSID-only networks
    }).sort({ priority: -1 });
  }

  // If still no match, try SSID-only (fallback)
  if (!network) {
    network = await WiFiNetwork.findOne({
      ssid: ssid.trim(),
      isActive: true,
    }).sort({ priority: -1 });
  }

  return {
    valid: !!network,
    network: network || undefined,
  };
}

/**
 * Gets applicable WiFi policy for an employee
 */
export async function getApplicablePolicy(
  employeeId: mongoose.Types.ObjectId,
  timestamp: Date = new Date()
): Promise<{ policy: any; scope: string } | null> {
  const employee = await Employee.findById(employeeId).populate('managerId');
  if (!employee) {
    return null;
  }

  // Get employee's shift assignment for today
  const today = new Date(timestamp);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const shiftAssignment = await ShiftAssignment.findOne({
    $or: [
      {
        assignmentScope: 'employee',
        employeeId: employeeId,
      },
      {
        assignmentScope: 'department',
        departmentRole: employee.role,
      },
    ],
    startDate: { $lte: today },
    $or: [{ endDate: null }, { endDate: { $gte: today } }],
    isActive: true,
  }).populate('shiftId');

  // Priority order: employee > shift > department > office > company
  const policies = await WiFiPolicy.find({
    isActive: true,
    status: 'active',
    requireWiFi: true,
    $or: [
      // Employee-specific
      {
        scope: 'employee',
        'scopeIds.employeeId': employeeId,
      },
      // Shift-specific
      {
        scope: 'shift',
        'scopeIds.shiftId': shiftAssignment?.shiftId?._id || null,
      },
      // Department-specific
      {
        scope: 'department',
        'scopeIds.departmentId': employee.role,
      },
      // Company-wide (fallback)
      {
        scope: 'company',
      },
    ],
  })
    .populate('allowedNetworks')
    .sort({ priority: -1 }); // Higher priority first

  // Check time-based rules
  const currentDay = timestamp.getDay();
  const currentTime = `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}`;

  for (const policy of policies) {
    // Check if policy is effective
    if (policy.effectiveFrom && timestamp < policy.effectiveFrom) continue;
    if (policy.effectiveTo && timestamp > policy.effectiveTo) continue;

    // Check day of week
    if (policy.daysOfWeek && !policy.daysOfWeek.includes(currentDay)) continue;

    // Check time range
    if (policy.timeRange) {
      if (policy.timeRange.start && currentTime < policy.timeRange.start) continue;
      if (policy.timeRange.end && currentTime > policy.timeRange.end) continue;
    }

    // Return first matching policy
    return {
      policy,
      scope: policy.scope,
    };
  }

  return null;
}

/**
 * Checks if employee has an active override
 */
export async function checkOverride(
  employeeId: mongoose.Types.ObjectId,
  timestamp: Date = new Date()
): Promise<{ hasOverride: boolean; override?: any }> {
  const override = await AttendanceOverride.findOne({
    employeeId,
    status: 'approved',
    validFrom: { $lte: timestamp },
    validTo: { $gte: timestamp },
  });

  return {
    hasOverride: !!override,
    override: override || undefined,
  };
}

/**
 * Main WiFi validation function
 */
export async function validateWiFiForAttendance(
  request: WiFiValidationRequest
): Promise<WiFiValidationResult> {
  const {
    employeeId,
    wifiSSID,
    wifiBSSID,
    isWiFiConnected,
    isMobileData,
    attemptType,
    timestamp = new Date(),
  } = request;

  // Check for active override first
  const overrideCheck = await checkOverride(employeeId, timestamp);
  if (overrideCheck.hasOverride && overrideCheck.override) {
    return {
      allowed: true,
      wifiValid: false, // WiFi not validated, but override allows
      policyApplied: false,
      overrideId: overrideCheck.override._id,
      reason: `Attendance allowed via override: ${overrideCheck.override.reason}`,
    };
  }

  // Check if WiFi is connected
  if (!isWiFiConnected || isMobileData) {
    return {
      allowed: false,
      wifiValid: false,
      policyApplied: false,
      reason: isMobileData
        ? 'Mobile data detected. Please connect to office WiFi to mark attendance.'
        : 'WiFi not connected. Please connect to office WiFi to mark attendance.',
    };
  }

  // Get applicable policy
  const policyResult = await getApplicablePolicy(employeeId, timestamp);
  
  // If no policy requires WiFi, allow (backward compatibility)
  if (!policyResult || !policyResult.policy.requireWiFi) {
    return {
      allowed: true,
      wifiValid: true,
      policyApplied: false,
      reason: 'No WiFi policy configured for this employee.',
    };
  }

  const policy = policyResult.policy;

  // Validate WiFi network
  if (!wifiSSID) {
    return {
      allowed: false,
      wifiValid: false,
      policyApplied: true,
      policyId: policy._id,
      policyScope: policyResult.scope,
      reason: 'WiFi network name not detected. Please ensure you are connected to office WiFi.',
    };
  }

  const wifiValidation = await validateWiFiNetwork(wifiSSID, wifiBSSID);

  if (!wifiValidation.valid) {
    // Get list of allowed networks for user-friendly error
    const allowedNetworks = await WiFiNetwork.find({
      _id: { $in: policy.allowedNetworks },
      isActive: true,
    }).select('ssid bssid location');

    return {
      allowed: false,
      wifiValid: false,
      policyApplied: true,
      policyId: policy._id,
      policyScope: policyResult.scope,
      reason: `Connected WiFi "${wifiSSID}" is not in the allowed list for your policy.`,
      allowedNetworks: allowedNetworks.map((n) => ({
        ssid: n.ssid,
        bssid: n.bssid,
        location: n.location,
      })),
    };
  }

  // Success - WiFi is valid
  return {
    allowed: true,
    wifiValid: true,
    policyApplied: true,
    policyId: policy._id,
    policyScope: policyResult.scope,
    reason: 'WiFi validation passed.',
  };
}

