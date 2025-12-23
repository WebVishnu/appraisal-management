# WiFi-Based Attendance System - Implementation Guide

## Overview

This document describes the complete implementation of the WiFi-restricted attendance validation system for the HRMS.

## Architecture

### Database Models

1. **WiFiNetwork** (`lib/models/WiFiNetwork.ts`)
   - Stores approved WiFi networks
   - Fields: SSID, BSSID (optional), location, priority, active status
   - Indexed for efficient lookups

2. **WiFiPolicy** (`lib/models/WiFiPolicy.ts`)
   - Defines attendance rules
   - Scope: company, office, department, shift, employee
   - Time-based rules support
   - Override permissions

3. **AttendanceAttemptLog** (`lib/models/AttendanceAttemptLog.ts`)
   - Complete audit trail
   - Logs all attempts (success/failure)
   - WiFi information at time of attempt
   - Device information

4. **AttendanceOverride** (`lib/models/AttendanceOverride.ts`)
   - Exception management
   - Approval workflow
   - Temporary/permanent overrides

### API Endpoints

#### WiFi Management (HR/Admin)
- `GET /api/wifi/networks` - List networks
- `POST /api/wifi/networks` - Create network
- `PUT /api/wifi/networks` - Update network
- `DELETE /api/wifi/networks` - Delete network

#### WiFi Policies
- `GET /api/wifi/policies` - List policies
- `POST /api/wifi/policies` - Create policy
- `PUT /api/wifi/policies` - Update policy
- `DELETE /api/wifi/policies` - Delete policy

#### Validation
- `POST /api/wifi/validate` - Pre-validate WiFi (mobile app)

#### Attendance (Updated)
- `POST /api/attendance/check-in` - Now includes WiFi validation
- `POST /api/attendance/check-out` - Now includes WiFi validation

### Mobile App Components

1. **WiFi Detection** (`lib/wifi-detection.ts`)
   - Uses `expo-network` for connection detection
   - Note: SSID/BSSID detection requires native modules on iOS
   - Real-time network monitoring

2. **WiFi Status Card** (`components/WiFiStatusCard.tsx`)
   - Visual status indicator
   - Shows allowed networks
   - Clear error messages

3. **Attendance Screen** (Updated)
   - WiFi validation before check-in/out
   - Real-time status updates
   - Disabled buttons when invalid

### Web Dashboard

**WiFi Management** (`components/hr/wifi-management-client.tsx`)
- Network CRUD operations
- Policy management
- Compliance monitoring (coming soon)

## Security Features

1. **Server-Side Validation**
   - Never trust client
   - All validation on server
   - Audit logging

2. **BSSID Validation**
   - Optional MAC address validation
   - Prevents SSID spoofing
   - Higher security level

3. **Policy Enforcement**
   - Multi-level policies
   - Scope-based rules
   - Time-based restrictions

4. **Override Tracking**
   - All overrides require approval
   - Audit trail
   - Usage tracking

## Setup Instructions

### 1. Install Dependencies

**Mobile App:**
```bash
cd mobile-app
npm install expo-network
```

**Dashboard:**
No additional dependencies required (uses existing packages)

### 2. Database Migration

The models will be created automatically on first use. No manual migration needed.

### 3. Configure WiFi Networks

1. Navigate to HR Dashboard → WiFi Management
2. Add approved WiFi networks:
   - Enter SSID (required)
   - Enter BSSID (optional, for higher security)
   - Set location and priority
   - Mark as active

### 4. Create Policies

1. Go to Policies tab
2. Create policy:
   - Set scope (company/department/shift/employee)
   - Select allowed networks
   - Configure override permissions
   - Set time-based rules (optional)

### 5. Mobile App Configuration

**iOS Note:**
- iOS requires special entitlements to access SSID
- Add to `app.json`:
```json
{
  "ios": {
    "infoPlist": {
      "NSLocationWhenInUseUsageDescription": "We need location access to detect WiFi network for attendance validation."
    }
  }
}
```

**Android:**
- Requires `ACCESS_WIFI_STATE` permission (handled by expo-network)
- SSID detection works out of the box

### 6. Testing

1. **Add Test Network:**
   - Connect to office WiFi
   - Note the SSID (and BSSID if available)
   - Add to approved networks

2. **Test Check-In:**
   - Open mobile app
   - Go to Attendance screen
   - Verify WiFi status shows "WiFi Valid"
   - Attempt check-in

3. **Test Invalid WiFi:**
   - Connect to mobile hotspot
   - Verify status shows "WiFi Not Allowed"
   - Verify check-in button is disabled

## Edge Cases Handled

1. **WiFi Disconnects During Attempt**
   - Real-time monitoring
   - Validation re-runs on connection change
   - Clear error messages

2. **Mobile Data Detection**
   - Detects cellular connection
   - Blocks attendance
   - Clear messaging

3. **Network Changes**
   - Monitors connection changes
   - Re-validates automatically
   - Updates UI in real-time

4. **Offline Mode**
   - Attendance blocked
   - Clear error message
   - Retry when online

5. **Permission Denied**
   - Graceful handling
   - Clear instructions
   - Fallback behavior

## Limitations & Future Enhancements

### Current Limitations

1. **iOS SSID Detection**
   - Requires location permissions
   - May need native module for full support
   - Consider using QR code fallback

2. **BSSID Availability**
   - Not always available on all devices
   - SSID-only validation as fallback

### Future Enhancements

1. **QR Code Fallback**
   - For network detection failures
   - Office-specific QR codes
   - Time-limited tokens

2. **Geo-fencing Integration**
   - Combine WiFi + location
   - More robust validation
   - Office boundary detection

3. **Device Binding**
   - Limit devices per employee
   - Prevent account sharing
   - Device fingerprinting

4. **Auto Check-Out**
   - Detect WiFi disconnect
   - Auto check-out after grace period
   - Configurable rules

5. **Compliance Dashboard**
   - Violation tracking
   - Pattern detection
   - Reporting and analytics

## Troubleshooting

### WiFi Not Detected

1. Check permissions (iOS location, Android WiFi state)
2. Verify expo-network is installed
3. Check device WiFi is actually connected
4. Review console logs for errors

### Validation Always Fails

1. Verify network is added to approved list
2. Check policy is active and applies to employee
3. Verify BSSID matches (if using BSSID validation)
4. Check server logs for validation errors

### Mobile App Crashes

1. Ensure expo-network is installed
2. Check for TypeScript errors
3. Verify all imports are correct
4. Review console for runtime errors

## API Response Examples

### WiFi Validation Success
```json
{
  "allowed": true,
  "wifiValid": true,
  "policyApplied": true,
  "reason": "WiFi validation passed."
}
```

### WiFi Validation Failure
```json
{
  "allowed": false,
  "wifiValid": false,
  "policyApplied": true,
  "reason": "Connected WiFi 'Home-WiFi' is not in the allowed list.",
  "allowedNetworks": [
    {
      "ssid": "Office-WiFi",
      "location": "Main Office"
    }
  ]
}
```

## Support

For issues or questions:
1. Check this documentation
2. Review server logs
3. Check mobile app console
4. Verify database records
5. Contact development team

