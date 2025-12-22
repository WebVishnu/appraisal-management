# Break Management System - Complete Flow

## 📋 System Overview

The Break Management System allows:
- **HR**: Manage break policies, view analytics, correct violations
- **Employees**: Start/end breaks via Mobile App or Web Dashboard
- **System**: Automatic validation, calculation, and payroll integration

---

## 🔄 Complete User Flows

### Flow 1: HR Creates Break Policy

```
HR Dashboard (Web)
    ↓
Navigate to: HR → Break Policies
    ↓
Click: "Create New Policy"
    ↓
Fill Form:
  - Name: "Standard Office Policy"
  - Scope: Global/Department/Role/Shift/Employee
  - Max Breaks: 3 per day
  - Max Duration: 60 minutes total
  - Max Per Break: 30 minutes
  - Allowed Types: Lunch, Tea, Personal
  - Paid Breaks: Lunch
  - Effective Dates
    ↓
Click: "Save Policy"
    ↓
Policy Active → Applied to Employees
```

### Flow 2: Employee Starts Break (Mobile App)

```
Mobile App
    ↓
Open: Attendance Tab
    ↓
Check Status: Must be "Checked In"
    ↓
View: "Breaks" Section
    ↓
Tap: "Start Lunch" / "Start Tea" / "Start Personal"
    ↓
System Validates:
  ✓ Checked in?
  ✓ Not already on break?
  ✓ Within break limit?
  ✓ Break type allowed?
    ↓
Break Started:
  - Status: "On Break"
  - Timer: Starts counting
  - Button: Changes to "End Break"
    ↓
Break Active → Timer Running
```

### Flow 3: Employee Ends Break (Mobile App)

```
While on Break
    ↓
Tap: "End Break"
    ↓
System:
  - Records end time
  - Calculates duration
  - Validates against policy
  - Flags violations (if any)
    ↓
Break Ended:
  - Status: "Working"
  - Break added to "Today's Breaks"
  - Timer stops
  - Remaining time updated
```

### Flow 4: Employee Starts Break (Web Dashboard)

```
Web Dashboard
    ↓
Navigate to: Employee → Attendance
    ↓
Check Status: Must be "Checked In"
    ↓
View: "Break Management" Panel
    ↓
Click: "Start Break" Dropdown
    ↓
Select: Break Type (Lunch/Tea/Personal)
    ↓
Click: "Start"
    ↓
Break Started:
  - Live timer appears
  - Status updates
  - "End Break" button enabled
```

### Flow 5: Check-Out with Active Break

```
Employee on Break
    ↓
Tries to Check Out
    ↓
System Detects: Active Break
    ↓
Auto-Actions:
  - Ends break automatically
  - Calculates break duration
  - Status: "auto_completed"
    ↓
Check-Out Proceeds:
  - Records check-out time
  - Calculates net working hours
  - Deducts unpaid breaks
  - Finalizes attendance
```

### Flow 6: HR Views Break Analytics

```
HR Dashboard (Web)
    ↓
Navigate to: HR → Break Analytics
    ↓
View Dashboard:
  - Total breaks today/week/month
  - Average break duration
  - Breaks by department
  - Breaks by type
  - Violations list
    ↓
Filter Options:
  - Date range
  - Department
  - Employee
  - Violation type
    ↓
Export Reports:
  - CSV export
  - PDF reports
```

### Flow 7: HR Corrects Break Violation

```
HR Dashboard (Web)
    ↓
Navigate to: HR → Break Violations
    ↓
View: List of Violations
    ↓
Click: Specific Violation
    ↓
View Details:
  - Employee name
  - Break type
  - Duration
  - Policy limit
  - Violation reason
    ↓
Click: "Correct Break"
    ↓
Enter:
  - Reason: "Justified - emergency"
  - Action: Adjust duration / Clear violation
    ↓
Save Correction:
  - Break updated
  - Audit log created
  - Attendance recalculated
```

---

## 🎯 Key Features by Role

### HR/Admin Features

#### 1. Policy Management
- ✅ Create break policies
- ✅ Edit existing policies
- ✅ Deactivate policies
- ✅ Set policy scope (global/dept/role/shift/employee)
- ✅ Configure break limits
- ✅ Define paid/unpaid breaks

#### 2. Break Monitoring
- ✅ View all employee breaks
- ✅ Daily/weekly/monthly reports
- ✅ Department-wise analytics
- ✅ Break type distribution
- ✅ Average break duration

#### 3. Violation Management
- ✅ View violations
- ✅ Filter by type/date/employee
- ✅ Correct break entries
- ✅ Add correction notes
- ✅ Audit trail

#### 4. Analytics Dashboard
- ✅ Break usage trends
- ✅ Violation patterns
- ✅ Department comparisons
- ✅ Export reports

### Employee Features

#### Mobile App
- ✅ Start break (Lunch/Tea/Personal)
- ✅ End break
- ✅ View active break timer
- ✅ See today's breaks
- ✅ Check remaining break time
- ✅ View break history

#### Web Dashboard
- ✅ Start/end break
- ✅ View break summary
- ✅ See break history
- ✅ Check policy limits

---

## 📊 Data Flow

### Break Start Flow

```
Employee Action
    ↓
API: POST /api/attendance/break/start
    ↓
BreakService.validateBreakStart()
  - Check attendance status
  - Check policy limits
  - Validate break type
    ↓
BreakService.startBreak()
  - Create BreakSession
  - Set status: "active"
  - Record start time
  - Link to attendance
    ↓
Update Attendance
  - Add break to breaks array
    ↓
Return Response
  - Break session details
  - Remaining breaks/time
```

### Break End Flow

```
Employee Action
    ↓
API: POST /api/attendance/break/end
    ↓
BreakService.endBreak()
  - Find active break
  - Set end time
  - Calculate duration
  - Validate against policy
  - Flag violations (if any)
    ↓
Update BreakSession
  - Status: "completed"
  - Duration calculated
  - Violation flags set
    ↓
BreakService.updateAttendanceBreakTotals()
  - Recalculate total break time
  - Update net working hours
    ↓
Return Response
  - Break details
  - Total break time
  - Remaining time
```

### Check-Out Flow (with Break)

```
Employee Checks Out
    ↓
API: POST /api/attendance/check-out
    ↓
Check for Active Break
    ↓
BreakService.autoEndBreakOnCheckout()
  - Find active break
  - Set end time = check-out time
  - Status: "auto_completed"
  - Calculate duration
    ↓
BreakService.updateAttendanceBreakTotals()
  - Calculate total break time
  - Calculate net working hours
  - Deduct unpaid breaks
    ↓
Save Attendance
  - Check-out time
  - Working hours (net)
  - Break totals
```

---

## 🔐 Security & Permissions

### Role-Based Access

| Action | Employee | Manager | HR | Admin |
|--------|----------|---------|----|----|
| Start own break | ✅ | ✅ | ✅ | ✅ |
| End own break | ✅ | ✅ | ✅ | ✅ |
| View own breaks | ✅ | ✅ | ✅ | ✅ |
| View team breaks | ❌ | ✅ | ✅ | ✅ |
| View all breaks | ❌ | ❌ | ✅ | ✅ |
| Create policy | ❌ | ❌ | ✅ | ✅ |
| Edit policy | ❌ | ❌ | ✅ | ✅ |
| Correct breaks | ❌ | ❌ | ✅ | ✅ |
| View analytics | ❌ | ❌ | ✅ | ✅ |

### Validation Rules

1. **Break Start**
   - Must be checked in
   - Not already on break
   - Within daily break limit
   - Within total break time limit
   - Break type allowed
   - Minimum working hours met (if configured)

2. **Break End**
   - Must have active break
   - Duration within limit (with grace)
   - Total time within daily limit

3. **Policy Application**
   - Most specific policy wins
   - Effective date checked
   - Active status verified

---

## 📱 Mobile App UI Flow

### Attendance Screen

```
┌─────────────────────────────┐
│     Attendance Tab          │
├─────────────────────────────┤
│  Today's Attendance         │
│  ┌─────────────────────┐   │
│  │ Check In: 09:00 AM  │   │
│  │ Status: Working     │   │
│  └─────────────────────┘   │
│                             │
│  Breaks Section             │
│  ┌─────────────────────┐   │
│  │ 45 min today        │   │
│  │ • 15 min remaining  │   │
│  │                     │   │
│  │ [Start Lunch]       │   │
│  │ [Start Tea]         │   │
│  │ [Start Personal]   │   │
│  └─────────────────────┘   │
│                             │
│  OR (if on break)           │
│  ┌─────────────────────┐   │
│  │ On Lunch Break       │   │
│  │ 00:15:30            │   │
│  │ [End Break]         │   │
│  └─────────────────────┘   │
│                             │
│  Today's Breaks:            │
│  • Tea: 10:30-10:45 (15m)  │
│  • Lunch: 12:00-12:30 (30m)│
└─────────────────────────────┘
```

---

## 🌐 Web Dashboard UI Flow

### Employee Attendance Page

```
┌─────────────────────────────────┐
│  Employee → Attendance          │
├─────────────────────────────────┤
│  Today's Status                 │
│  Check In: 09:00 AM             │
│  Status: Working                │
│                                 │
│  Break Management               │
│  ┌───────────────────────────┐ │
│  │ Start Break: [Dropdown ▼] │ │
│  │   - Lunch                 │ │
│  │   - Tea                   │ │
│  │   - Personal              │ │
│  │ [Start]                   │ │
│  └───────────────────────────┘ │
│                                 │
│  OR (if on break)               │
│  ┌───────────────────────────┐ │
│  │ On Lunch Break            │ │
│  │ Timer: 00:15:30           │ │
│  │ [End Break]               │ │
│  └───────────────────────────┘ │
│                                 │
│  Break History                  │
│  ┌───────────────────────────┐ │
│  │ Date | Type | Duration    │ │
│  │ Today| Tea  | 15 min      │ │
│  │ Today| Lunch| 30 min      │ │
│  └───────────────────────────┘ │
└─────────────────────────────────┘
```

### HR Break Policy Page

```
┌─────────────────────────────────┐
│  HR → Break Policies             │
├─────────────────────────────────┤
│  [Create New Policy]             │
│                                 │
│  Policies List                   │
│  ┌───────────────────────────┐ │
│  │ Name | Scope | Status     │ │
│  │ Standard| Global | Active │ │
│  │ Engineering| Dept | Active│ │
│  └───────────────────────────┘ │
│                                 │
│  Policy Editor                   │
│  ┌───────────────────────────┐ │
│  │ Name: [___________]       │ │
│  │ Scope: [Global ▼]        │ │
│  │ Max Breaks: [3]           │ │
│  │ Max Duration: [60] min   │ │
│  │ Allowed Types: [✓] Lunch │ │
│  │              [✓] Tea     │ │
│  │              [ ] Personal│ │
│  │ [Save Policy]            │ │
│  └───────────────────────────┘ │
└─────────────────────────────────┘
```

---

## 🔄 Integration Points

### 1. Attendance System
- Breaks linked to attendance records
- Working hours calculated with breaks
- Status updates reflect break state

### 2. Payroll System
- Net working hours = Total - Unpaid breaks
- Paid breaks included in hours
- Break time deducted automatically

### 3. Policy System
- Policies applied dynamically
- Priority-based resolution
- Effective date enforcement

### 4. Audit System
- All break actions logged
- Corrections tracked
- Policy changes recorded

---

## ✅ Summary

**HR manages breaks through:**
- Web Dashboard → Break Policies (create/edit policies)
- Web Dashboard → Break Analytics (view reports)
- Web Dashboard → Break Violations (correct entries)

**Employees use breaks through:**
- Mobile App → Attendance Tab → Breaks Section
- Web Dashboard → Employee → Attendance → Break Management

**System automatically:**
- Validates break requests
- Calculates durations
- Flags violations
- Updates working hours
- Integrates with payroll

The system is fully integrated, secure, and provides complete visibility for HR while offering a seamless experience for employees.

