# Shift & Roster Management Module - Architecture Documentation

## Overview

The Shift & Roster Management module provides comprehensive shift scheduling, assignment, and roster management capabilities integrated with the existing HR Management System. It seamlessly integrates with Attendance, Leave, and Payroll modules.

## Database Schemas

### 1. Shift Model (`lib/models/Shift.ts`)

**Purpose**: Defines shift templates with timing rules and configurations.

**Key Fields**:
- `name`: Unique shift identifier
- `shiftType`: `fixed` | `rotational` | `flexible`
- `startTime` / `endTime`: HH:mm format
- `gracePeriod`: Minutes allowed for late arrival
- `earlyExitGracePeriod`: Minutes allowed for early exit
- `minimumWorkingHours`: Minimum hours required (in minutes)
- `breakDuration`: Break duration in minutes
- `isBreakPaid`: Whether break time is paid
- `workingDays`: Array of days when shift is active
- `isNightShift`: Flag for shifts crossing midnight
- `isActive`: Active/archived status

**Indexes**:
- `name` (unique)
- `isActive` + `shiftType` (compound)

### 2. ShiftAssignment Model (`lib/models/ShiftAssignment.ts`)

**Purpose**: Assigns shifts to employees, teams, or departments.

**Key Fields**:
- `shiftId`: Reference to Shift
- `assignmentType`: `permanent` | `temporary`
- `assignmentScope`: `employee` | `team` | `department`
- `employeeId`: For employee-level assignments
- `teamManagerId`: For team-level assignments (uses manager as team identifier)
- `departmentRole`: For department-level assignments (uses role as department)
- `startDate` / `endDate`: For temporary assignments
- `effectiveDate`: When assignment becomes effective
- `assignedBy`: Audit field
- `reason`: Reason for assignment
- `isActive`: Active status

**Indexes**:
- `employeeId` + `isActive` + `effectiveDate`
- `teamManagerId` + `isActive`
- `shiftId` + `isActive`
- `startDate` + `endDate`

**Validation**:
- Ensures at least one assignment target is specified
- Temporary assignments require date range
- Date range validation

### 3. Roster Model (`lib/models/Roster.ts`)

**Purpose**: Stores daily shift assignments for rotational shifts.

**Key Fields**:
- `employeeId`: Employee reference
- `shiftId`: Shift for this date
- `date`: The date for this roster entry
- `weekNumber`: Week number (1-53)
- `month`: Month (1-12)
- `year`: Year
- `isWeeklyOff`: Weekly off flag
- `notes`: Additional notes
- `createdBy`: Audit field

**Indexes**:
- `employeeId` + `date` (unique compound)
- `employeeId` + `year` + `month`
- `employeeId` + `year` + `weekNumber`
- `date` + `shiftId`

### 4. ShiftSwap Model (`lib/models/ShiftSwap.ts`)

**Purpose**: Manages shift swap requests between employees.

**Key Fields**:
- `requesterId`: Employee requesting swap
- `requesteeId`: Employee being asked to swap
- `requesterDate` / `requesteeDate`: Dates to swap
- `requesterShiftId` / `requesteeShiftId`: Shifts on respective dates
- `reason`: Reason for swap
- `status`: `pending` | `approved` | `rejected` | `cancelled`
- `reviewedBy`: Manager who reviewed
- `reviewedAt`: Review timestamp
- `rejectionReason`: Reason if rejected

**Indexes**:
- `requesterId` + `status`
- `requesteeId` + `status`
- `status` + `createdAt`

## Business Logic Flows

### Shift Assignment Priority

When determining an employee's shift for a specific date, the system checks in this order:

1. **Roster Entry** (Highest Priority)
   - Check if a roster entry exists for the date
   - Used for rotational shifts and temporary overrides

2. **Temporary Assignment**
   - Check if employee has a temporary assignment covering the date
   - Validated against `startDate` and `endDate`

3. **Permanent Assignment**
   - Check if employee has a permanent assignment effective on/before the date

4. **Team Assignment**
   - Check if employee's manager has a team-level assignment
   - Applies to all team members

5. **Department Assignment**
   - Check if employee's role has a department-level assignment
   - Applies to all employees with that role

### Attendance Integration

**Check-in Process**:
1. Get assigned shift for today using priority order
2. Validate check-in time against shift start time + grace period
3. Mark as late if exceeds grace period
4. Store `shiftId` in attendance record

**Check-out Process**:
1. Retrieve attendance record with shift details
2. Validate check-out time against shift end time - grace period
3. Calculate working hours considering break duration
4. Mark as early exit if before minimum working hours
5. Determine status (present/half_day/absent) based on shift rules

### Conflict Detection

When assigning shifts, the system checks for:

1. **Leave Overlap**
   - Verifies no approved/pending leave exists for the date

2. **Weekly Off**
   - Checks if shift is active on the day of week

3. **Existing Roster**
   - Prevents duplicate roster entries for same date

4. **Double Shift Prevention**
   - Ensures employee doesn't have conflicting assignments

### Shift Swap Workflow

1. **Request Creation**:
   - Employee creates swap request with another employee
   - System validates both employees have shifts on respective dates
   - Request status: `pending`

2. **Approval Process**:
   - Manager or requestee can approve/reject
   - On approval, rosters are automatically updated
   - Request status: `approved` or `rejected`

3. **Cancellation**:
   - Only requester can cancel pending requests
   - Request status: `cancelled`

## API Endpoints

### Shift Management

- `GET /api/shifts` - List all shifts (with filters)
- `POST /api/shifts` - Create new shift (HR/Admin only)
- `GET /api/shifts/[id]` - Get single shift
- `PUT /api/shifts/[id]` - Update shift (HR/Admin only)
- `DELETE /api/shifts/[id]` - Archive shift (HR/Admin only)

### Shift Assignments

- `GET /api/shifts/assignments` - List assignments (with filters)
- `POST /api/shifts/assignments` - Create assignment (HR/Admin only)
- `DELETE /api/shifts/assignments/[id]` - Deactivate assignment (HR/Admin only)

### Roster Management

- `GET /api/shifts/roster` - Get roster entries (role-based filtering)
- `POST /api/shifts/roster` - Create roster entry(ies) (single or bulk)
- `PUT /api/shifts/roster/[id]` - Update roster entry
- `DELETE /api/shifts/roster/[id]` - Delete roster entry

### Shift Swaps

- `GET /api/shifts/swaps` - Get swap requests (role-based filtering)
- `POST /api/shifts/swaps` - Create swap request (Employee only)
- `PUT /api/shifts/swaps/[id]` - Review swap request (approve/reject/cancel)

## Edge Cases & Handling

### 1. Night Shifts Crossing Midnight

**Problem**: Shift end time is next day (e.g., 22:00 - 06:00)

**Solution**:
- `isNightShift` flag identifies night shifts
- `getShiftEndTime()` calculates correct end date
- Check-out validation accounts for next-day end time
- Working hours calculation handles date crossing

### 2. Multiple Assignment Conflicts

**Problem**: Employee may have multiple assignments (permanent + temporary)

**Solution**:
- Priority system ensures roster > temporary > permanent
- Conflict detection prevents overlapping assignments
- System warns when creating conflicting assignments

### 3. Shift Changes Mid-Day

**Problem**: Shift assignment changes after check-in

**Solution**:
- Attendance record stores `shiftId` at check-in time
- Check-out uses stored shift, not current assignment
- Prevents validation issues from mid-day changes

### 4. Missing Shift Assignment

**Problem**: Employee has no assigned shift for a date

**Solution**:
- System falls back to default shift (09:00 - 18:00)
- HR receives alerts for unassigned employees
- Dashboard shows unassigned employee warnings

### 5. Bulk Roster Creation Failures

**Problem**: Some employees in bulk assignment may have conflicts

**Solution**:
- Bulk creation continues for valid employees
- Returns list of successful creations and errors
- Allows partial success with detailed error reporting

### 6. Shift Swap Approval Race Condition

**Problem**: Multiple managers approve same swap simultaneously

**Solution**:
- Database-level status validation
- Only pending swaps can be approved
- Atomic update prevents double approval

### 7. Leave Integration

**Problem**: Leave dates overlap with shift assignments

**Solution**:
- Conflict detection checks leave status
- Roster creation validates against approved/pending leaves
- Leave system marks attendance as "on leave"

## Integration Points

### Attendance Module

- **Check-in/out validation**: Uses assigned shift rules
- **Late/early detection**: Shift-specific grace periods
- **Working hours calculation**: Considers shift break duration
- **Status determination**: Based on shift minimum hours

### Leave Module

- **Conflict detection**: Prevents shift assignment during leave
- **Leave balance calculation**: Considers shift hours for half-day leaves
- **Attendance marking**: Leave days marked in attendance

### Payroll Module (Future)

- **Shift adherence data**: Exposed via API
- **Overtime calculation**: Based on shift hours
- **Break time handling**: Paid vs unpaid breaks

## Dashboard Requirements

### Employee Dashboard

- Today's shift display
- Upcoming shifts (next 7 days)
- Shift history
- Pending swap requests
- Shift adherence summary

### Manager Dashboard

- Team shift calendar (weekly/monthly view)
- Shift adherence reports
- Pending swap approvals
- Team coverage overview
- Unassigned employee alerts

### HR/Admin Dashboard

- Organization-wide shift distribution
- Shift violation trends
- Unassigned employee alerts
- Shift utilization analytics
- Assignment audit logs

## Scalability Considerations

1. **Indexing**: All frequently queried fields are indexed
2. **Bulk Operations**: Roster creation supports bulk operations
3. **Caching**: Shift assignments can be cached for performance
4. **Pagination**: List endpoints support pagination
5. **Archival**: Old rosters can be archived for performance

## Security & Permissions

- **HR/Admin**: Full access to all shift operations
- **Manager**: Can view team rosters, approve swaps
- **Employee**: Can view own shifts, request swaps
- **Audit Logging**: All assignments tracked with `assignedBy` field

## Future Enhancements

1. **Shift Templates**: Pre-defined shift patterns
2. **Auto-Roster Generation**: AI-based roster optimization
3. **Shift Preferences**: Employee shift preferences
4. **Overtime Tracking**: Automatic overtime calculation
5. **Shift Analytics**: Advanced reporting and insights

