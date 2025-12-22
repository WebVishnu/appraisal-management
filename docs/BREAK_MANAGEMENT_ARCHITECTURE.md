# Break Management System Architecture

## Overview

Enterprise-grade break tracking system integrated with attendance management, providing HR full control over break policies while enabling accurate working hours calculation for payroll.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Employee Interface                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Check In    │→ │  Start Break │→ │  End Break   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                  │             │
│         └──────────────────┴──────────────────┘           │
│                            ↓                                 │
│                    ┌──────────────┐                          │
│                    │  Check Out   │                          │
│                    └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Break Management Service Layer                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Break      │  │   Policy     │  │  Validation  │     │
│  │   Service    │  │   Service    │  │   Service    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Attendance   │  │ BreakSession │  │ BreakPolicy  │     │
│  │   Records    │  │   Records    │  │   Records    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## State Machine

### Attendance States

```
[Checked Out]
    │
    │ checkIn()
    ↓
[Checked In] ────┐
    │            │
    │            │ startBreak()
    │            ↓
    │        [On Break]
    │            │
    │            │ endBreak()
    │            ↓
    │        [Checked In]
    │            │
    │            │ (can take more breaks)
    │            │
    └────────────┘
         │
         │ checkOut()
         ↓
    [Checked Out]
```

### Break Session States

```
[Not Started]
    │
    │ startBreak()
    ↓
[Active] ────┐
    │        │
    │        │ endBreak()
    │        ↓
    │    [Completed]
    │        │
    │        │ (auto-end on checkOut)
    │        ↓
    └─── [Auto-Completed]
```

## Break Flow

### Employee Break Flow

```
1. Employee checks in
   ↓
2. Employee starts break
   - System validates: break allowed?
   - System checks: policy limits?
   - System records: break start time
   ↓
3. Employee on break
   - Timer running
   - Status: "On Break"
   - Cannot check out
   ↓
4. Employee ends break
   - System records: break end time
   - System calculates: break duration
   - System validates: within limits?
   - Status: "Working"
   ↓
5. (Optional) More breaks
   ↓
6. Employee checks out
   - System calculates: total working hours
   - System calculates: total break time
   - System calculates: net payable hours
   - Any active breaks auto-ended
```

## Break Policy Structure

### Policy Configuration

```typescript
{
  name: "Standard Break Policy",
  scope: "global" | "department" | "role" | "shift" | "employee",
  scopeIds: ["dept_id", "role_id", ...],
  
  // Break Allowance
  allowBreaks: true,
  maxBreaksPerDay: 3,
  maxTotalBreakDuration: 60, // minutes
  maxDurationPerBreak: 30, // minutes
  
  // Break Types
  allowedBreakTypes: ["lunch", "tea", "personal"],
  mandatoryBreaks: ["lunch"], // Must take these breaks
  
  // Time Rules
  minWorkingHoursBeforeFirstBreak: 2, // hours
  gracePeriod: 5, // minutes overrun allowed
  
  // Payroll
  paidBreaks: ["lunch"], // These breaks are paid
  deductBreakTime: true, // Deduct from working hours
  
  // Enforcement
  autoFlagExcessiveBreaks: true,
  allowBreakOverrun: false,
  
  // Effective Dates
  effectiveFrom: Date,
  effectiveTo: Date | null,
  
  // Status
  isActive: true
}
```

## Database Schema

### BreakSession Model

```typescript
{
  _id: ObjectId,
  attendanceId: ObjectId (ref: Attendance),
  employeeId: ObjectId (ref: Employee),
  breakType: String (enum: ['lunch', 'tea', 'personal', 'custom']),
  startTime: Date,
  endTime: Date | null,
  duration: Number (minutes, calculated),
  status: Enum ['active', 'completed', 'auto_completed', 'cancelled'],
  isPaid: Boolean,
  policyId: ObjectId (ref: BreakPolicy),
  violationFlags: {
    exceededDuration: Boolean,
    exceededDailyLimit: Boolean,
    policyViolation: Boolean
  },
  correctedBy: ObjectId (ref: User, nullable),
  correctedAt: Date (nullable),
  correctionReason: String (nullable),
  createdAt: Date,
  updatedAt: Date
}
```

### BreakPolicy Model

```typescript
{
  _id: ObjectId,
  name: String,
  description: String,
  scope: Enum ['global', 'department', 'role', 'shift', 'employee'],
  scopeIds: [ObjectId],
  allowBreaks: Boolean,
  maxBreaksPerDay: Number,
  maxTotalBreakDuration: Number (minutes),
  maxDurationPerBreak: Number (minutes),
  allowedBreakTypes: [String],
  mandatoryBreaks: [String],
  minWorkingHoursBeforeFirstBreak: Number (hours),
  gracePeriod: Number (minutes),
  paidBreaks: [String],
  deductBreakTime: Boolean,
  autoFlagExcessiveBreaks: Boolean,
  allowBreakOverrun: Boolean,
  effectiveFrom: Date,
  effectiveTo: Date | null,
  isActive: Boolean,
  createdBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date
}
```

### BreakType Model

```typescript
{
  _id: ObjectId,
  name: String (unique),
  code: String (unique, enum: ['lunch', 'tea', 'personal', 'custom']),
  displayName: String,
  defaultDuration: Number (minutes, nullable),
  isPaid: Boolean (default),
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Updated Attendance Model

```typescript
// Add to existing Attendance model:
{
  // ... existing fields ...
  breaks: [ObjectId] (ref: BreakSession),
  totalBreakDuration: Number (minutes),
  netWorkingHours: Number (minutes, calculated),
  breakViolations: {
    exceededDailyLimit: Boolean,
    excessiveBreaks: Boolean,
    policyViolations: [String]
  }
}
```

## API Endpoints

### Employee Endpoints

#### POST /api/attendance/break/start
Start a break session

**Request:**
```json
{
  "breakType": "lunch",
  "notes": "Optional notes"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "breakSession": {
      "id": "break_id",
      "startTime": "2024-01-15T12:00:00Z",
      "breakType": "lunch",
      "status": "active"
    },
    "remainingBreaks": 2,
    "remainingBreakTime": 45
  }
}
```

#### POST /api/attendance/break/end
End current break session

**Request:**
```json
{
  "breakSessionId": "break_id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "breakSession": {
      "id": "break_id",
      "startTime": "2024-01-15T12:00:00Z",
      "endTime": "2024-01-15T12:30:00Z",
      "duration": 30,
      "status": "completed"
    },
    "totalBreakTime": 30,
    "remainingBreakTime": 30
  }
}
```

#### GET /api/attendance/break/today
Get today's break summary

**Response:**
```json
{
  "success": true,
  "data": {
    "activeBreak": {
      "id": "break_id",
      "startTime": "2024-01-15T12:00:00Z",
      "breakType": "lunch",
      "duration": 15
    },
    "completedBreaks": [
      {
        "id": "break_id_1",
        "breakType": "tea",
        "startTime": "2024-01-15T10:00:00Z",
        "endTime": "2024-01-15T10:15:00Z",
        "duration": 15
      }
    ],
    "totalBreakTime": 30,
    "remainingBreaks": 2,
    "remainingBreakTime": 30,
    "policy": {
      "maxBreaksPerDay": 3,
      "maxTotalBreakDuration": 60
    }
  }
}
```

### HR Management Endpoints

#### GET /api/breaks/policies
Get all break policies

#### POST /api/breaks/policies
Create break policy

#### PUT /api/breaks/policies/:id
Update break policy

#### GET /api/breaks/analytics
Get break usage analytics

#### POST /api/breaks/:id/correct
HR override/correct break entry

## Business Logic

### Break Validation Rules

1. **Pre-Start Validation:**
   - Must be checked in
   - Not already on break
   - Within allowed break count
   - Within total break time limit
   - Minimum working hours met (if configured)

2. **During Break:**
   - Cannot check out
   - Timer running
   - Status visible

3. **End Break Validation:**
   - Break duration within limit
   - Total break time within daily limit
   - Policy compliance

4. **Check-Out Validation:**
   - Auto-end any active breaks
   - Calculate net working hours
   - Flag violations

### Working Hours Calculation

```
Total Time = Check Out - Check In
Total Break Time = Sum of all break durations
Net Working Hours = Total Time - Total Break Time (if deductBreakTime = true)
                    OR
                   = Total Time (if deductBreakTime = false)

Payable Hours = Net Working Hours (excluding unpaid breaks)
```

### Payroll Integration

```typescript
// Paid breaks are included in working hours
// Unpaid breaks are deducted

if (policy.deductBreakTime) {
  paidBreakTime = breaks.filter(b => b.isPaid).reduce(sum, duration);
  unpaidBreakTime = breaks.filter(b => !b.isPaid).reduce(sum, duration);
  
  netWorkingHours = totalTime - unpaidBreakTime;
  payableHours = netWorkingHours; // Includes paid breaks
} else {
  payableHours = totalTime; // All breaks paid
}
```

## Edge Cases

### 1. Missed Break End
- **Scenario:** Employee forgets to end break
- **Solution:** Auto-end on check-out, flag for review

### 2. App Force Close
- **Scenario:** App closes while on break
- **Solution:** Break continues, can resume and end on app restart

### 3. Multiple Devices
- **Scenario:** Employee uses multiple devices
- **Solution:** Only one active break allowed, prevent duplicate starts

### 4. Policy Change Mid-Day
- **Scenario:** HR changes policy during work day
- **Solution:** Apply policy active at break start time

### 5. Check-Out During Break
- **Scenario:** Employee tries to check out while on break
- **Solution:** Auto-end break, then allow check-out

## Security & Audit

- All break actions logged
- HR corrections require justification
- Employees cannot edit past breaks
- Policy changes are versioned
- Full audit trail for compliance

