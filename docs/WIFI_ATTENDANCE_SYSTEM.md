# WiFi-Based Attendance Validation System

## Overview

Enterprise-grade WiFi-restricted attendance system that ensures employees can only mark attendance when connected to approved office WiFi networks.

## Architecture

### Database Models

1. **WiFiNetwork** - Stores allowed WiFi networks
   - SSID (network name)
   - BSSID (MAC address) - optional for higher security
   - Location mapping
   - Active/inactive status

2. **WiFiPolicy** - Defines attendance rules
   - Scope: company, office, department, shift, employee
   - Required WiFi validation
   - Allowed networks list
   - Override permissions

3. **AttendanceAttemptLog** - Audit trail
   - All attendance attempts (success/failure)
   - WiFi information at time of attempt
   - Validation results
   - Device information

4. **AttendanceOverride** - Exception management
   - Temporary/permanent remote attendance
   - Approval workflow
   - Usage tracking

### API Endpoints

#### WiFi Management (HR/Admin only)
- `GET /api/wifi/networks` - List all networks
- `POST /api/wifi/networks` - Create network
- `PUT /api/wifi/networks` - Update network
- `DELETE /api/wifi/networks` - Delete network

#### WiFi Policies
- `GET /api/wifi/policies` - List policies
- `POST /api/wifi/policies` - Create policy
- `PUT /api/wifi/policies` - Update policy
- `DELETE /api/wifi/policies` - Delete policy

#### Attendance Overrides
- `GET /api/wifi/overrides` - List overrides
- `POST /api/wifi/overrides` - Request override
- `PUT /api/wifi/overrides` - Approve/reject override

#### Validation
- `POST /api/wifi/validate` - Validate WiFi before attendance (mobile app)

### Mobile App Flow

1. **WiFi Detection**
   - Uses `expo-network` or native modules
   - Detects SSID and BSSID (if available)
   - Monitors connection status in real-time

2. **Pre-validation**
   - Before check-in/out, validates WiFi
   - Shows clear status to user
   - Disables buttons if invalid

3. **Attendance Submission**
   - Sends WiFi info with check-in/out request
   - Server validates again
   - Logs attempt for audit

### Security Measures

1. **BSSID Validation** - Prevents SSID spoofing
2. **Server-side Validation** - Never trust client
3. **Audit Logging** - All attempts logged
4. **Override Tracking** - All overrides require approval
5. **Policy Enforcement** - Multi-level policy system

### Edge Cases Handled

- WiFi disconnects during attempt
- Mobile data detection
- Network changes mid-session
- Offline mode
- Permission denied
- Hotspot spoofing attempts

## Implementation Status

✅ Database models created
✅ WiFi validation utilities
✅ Check-in endpoint updated
✅ Check-out endpoint updated
✅ WiFi management APIs
✅ Mobile app WiFi detection
✅ HR dashboard UI
✅ Override management APIs
✅ WiFi management page integrated

