# Shift & Roster Management - Usage Guide

## Where to Find Everything

### For HR/Admin Users

#### 1. **Shift Management Page**
**Location**: `/dashboard/hr/shifts`  
**Access**: Click "Shift & Roster" in the sidebar (under HR menu)

**What you can do here:**
- **Shifts Tab**: Create, edit, and archive shift templates
  - Click "Create Shift" button
  - Fill in shift details (name, times, grace periods, breaks, working days)
  - Edit existing shifts by clicking the edit icon
  - Archive shifts by clicking the delete icon

- **Assignments Tab**: Assign shifts to employees, teams, or departments
  - Click "Assign Shift" button
  - Choose assignment type (Permanent or Temporary)
  - Choose scope (Employee, Team, or Department)
  - For temporary assignments, specify date range
  - System automatically checks for conflicts

- **Roster Tab**: Create daily shift schedules (for rotational shifts)
  - Click "Create Roster" button
  - Select multiple employees
  - Choose date range
  - Select shift for those dates
  - System creates roster entries for all selected dates

### For Managers

#### 2. **Team Roster Page**
**Location**: `/dashboard/manager/roster`  
**Access**: Click "Team Roster" in the sidebar (under Manager menu)

**What you can do here:**
- View team members' shift schedules
- See weekly/monthly calendar view
- Approve/reject shift swap requests from team members
- Filter by date range
- See pending swap requests at the top

### For Employees

#### 3. **My Shifts Page**
**Location**: `/dashboard/employee/shifts`  
**Access**: Click "My Shifts" in the sidebar (under Employee menu)

**What you can do here:**
- View today's assigned shift
- See upcoming shifts (next 7 days)
- View permanent shift assignment
- Request shift swaps with other employees
- View pending swap requests

#### 4. **Attendance Page** (Enhanced)
**Location**: `/dashboard/employee/attendance`  
**Access**: Click "Attendance" in the sidebar

**What's new:**
- Shows today's assigned shift at the top
- Check-in/out times are validated against your shift
- Late/early detection uses your shift's grace period

## Complete Workflow

### Scenario 1: Setting Up Shifts for New Employees

1. **HR creates shifts** (if not already created):
   - Go to `/dashboard/hr/shifts`
   - Click "Shifts" tab
   - Click "Create Shift"
   - Fill in details (e.g., "Morning Shift", 9 AM - 6 PM)
   - Save

2. **HR assigns shift to employee**:
   - Go to "Assignments" tab
   - Click "Assign Shift"
   - Select shift
   - Choose "Permanent" assignment type
   - Choose "Employee" scope
   - Select employee
   - Set effective date
   - Save

3. **Employee sees their shift**:
   - Employee goes to `/dashboard/employee/shifts`
   - Sees their permanent assignment
   - Can view today's shift and upcoming schedule

### Scenario 2: Rotational Shifts (Weekly Rotation)

1. **HR creates roster for the month**:
   - Go to `/dashboard/hr/shifts`
   - Click "Roster" tab
   - Click "Create Roster"
   - Select employees
   - Choose date range (e.g., entire month)
   - Select shift for those dates
   - Save
   - System creates roster entries for all dates

2. **For different weeks, create separate rosters**:
   - Create roster for Week 1 with Morning Shift
   - Create roster for Week 2 with Evening Shift
   - System handles overlaps (roster has highest priority)

### Scenario 3: Employee Wants to Swap Shifts

1. **Employee requests swap**:
   - Go to `/dashboard/employee/shifts`
   - Click "Request Shift Swap"
   - Select coworker
   - Choose dates to swap
   - Add reason
   - Submit

2. **Manager approves**:
   - Go to `/dashboard/manager/roster`
   - See pending swap request
   - Review details
   - Click "Approve" or "Reject"
   - System automatically updates both employees' rosters

### Scenario 4: Temporary Shift Change

1. **HR creates temporary assignment**:
   - Go to `/dashboard/hr/shifts`
   - Click "Assignments" tab
   - Click "Assign Shift"
   - Choose "Temporary" assignment type
   - Select employee and shift
   - Set start and end dates
   - Save

2. **System automatically uses temporary assignment**:
   - For dates in the range, temporary assignment applies
   - After end date, returns to permanent assignment
   - Roster entries override temporary assignments

## Integration with Attendance

### Automatic Shift Detection

When an employee checks in:
1. System looks up assigned shift using priority:
   - Roster entry (if exists for today)
   - Temporary assignment (if date is in range)
   - Permanent assignment
   - Team assignment
   - Department assignment

2. Validates check-in time:
   - Compares against shift start time + grace period
   - Marks as late if exceeds grace period

3. Stores shift reference:
   - Saves shiftId in attendance record
   - Used for check-out validation

### Check-Out Validation

When checking out:
1. Retrieves shift from attendance record
2. Validates check-out time:
   - Compares against shift end time - grace period
   - Marks as early exit if before minimum hours
3. Calculates working hours:
   - Considers break duration
   - Accounts for paid/unpaid breaks

## Navigation Structure

```
HR Dashboard
├── Shift & Roster (/dashboard/hr/shifts)
│   ├── Shifts Tab (Create/Edit shifts)
│   ├── Assignments Tab (Assign to employees/teams)
│   └── Roster Tab (Create daily schedules)
│
Manager Dashboard
└── Team Roster (/dashboard/manager/roster)
    ├── View team schedules
    └── Approve swap requests
│
Employee Dashboard
├── My Shifts (/dashboard/employee/shifts)
│   ├── View today's shift
│   ├── View upcoming shifts
│   └── Request swaps
└── Attendance (/dashboard/employee/attendance)
    └── Shows today's shift (integrated)
```

## Key Features

### 1. Priority System
Shifts are resolved in this order (highest to lowest):
- Roster Entry
- Temporary Assignment
- Permanent Assignment
- Team Assignment
- Department Assignment

### 2. Conflict Detection
System automatically checks for:
- Leave overlaps
- Weekly offs
- Double shift assignments

### 3. Night Shift Support
- Handles shifts crossing midnight (e.g., 10 PM - 6 AM)
- Correctly calculates working hours
- Validates check-out on next day

### 4. Bulk Operations
- Create rosters for multiple employees at once
- Create rosters for date ranges
- Partial success handling (continues even if some fail)

## Tips for Best Practices

1. **Create shifts first**: Before assigning, create all shift templates
2. **Use permanent assignments**: For employees with fixed shifts
3. **Use rosters**: For rotational shifts or temporary overrides
4. **Check conflicts**: System warns, but review before bulk operations
5. **Monitor swaps**: Managers should review swap requests promptly

## Troubleshooting

### Employee sees "No shift assigned"
- Check if shift is assigned (permanent/temporary)
- Check if roster entry exists for today
- Check if assignment is active
- Default fallback: 9 AM - 6 PM

### Shift swap not working
- Ensure both employees have shifts on respective dates
- Check if request is pending (not already approved/rejected)
- Verify manager has permission to approve

### Attendance shows wrong shift
- Attendance stores shift at check-in time
- If shift changes mid-day, check-out uses stored shift
- This prevents validation issues

## API Endpoints Reference

- `GET /api/shifts` - List all shifts
- `POST /api/shifts` - Create shift (HR only)
- `PUT /api/shifts/[id]` - Update shift (HR only)
- `DELETE /api/shifts/[id]` - Archive shift (HR only)
- `GET /api/shifts/assignments` - List assignments
- `POST /api/shifts/assignments` - Create assignment (HR only)
- `GET /api/shifts/roster` - Get roster entries
- `POST /api/shifts/roster` - Create roster (single or bulk)
- `GET /api/shifts/swaps` - Get swap requests
- `POST /api/shifts/swaps` - Create swap request (Employee only)
- `PUT /api/shifts/swaps/[id]` - Review swap (Manager/Employee)

