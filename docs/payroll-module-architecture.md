# Payroll Module Architecture

## Overview

The Payroll module is a comprehensive, attendance-driven salary management system that automatically calculates employee compensation based on attendance records, approved leaves, and assigned shifts. It ensures transparency, auditability, and deterministic calculations.

## Database Schemas

### 1. SalaryStructure
Defines salary configuration for employees or roles.

**Key Fields:**
- `employeeId` (ObjectId, optional): Employee-specific structure
- `role` (String, optional): Role-based structure
- `grossMonthlySalary` (Number): Base monthly salary
- `workingDaysRule`: `shift_based` | `calendar_days` | `fixed_days`
- `paidLeaveTypes` (Array): Leave types that don't deduct salary
- `unpaidLeaveTypes` (Array): Leave types that deduct salary
- `halfDayDeductionRule`: `half_day` | `proportional`
- `effectiveFrom` / `effectiveTo`: Validity period
- `version`: Version number for tracking changes
- `isActive`: Active status

**Features:**
- Versioned structures (changes create new versions)
- Employee-specific or role-based assignment
- Historical tracking via `previousVersionId`

### 2. Payroll
Stores calculated payroll for each employee per month.

**Key Fields:**
- `employeeId`, `payrollMonth`, `payrollYear`
- `salaryStructureId`: Reference to structure used
- `totalWorkingDays`, `presentDays`, `absentDays`, `halfDays`
- `paidLeaveDays`, `unpaidLeaveDays`, `lateArrivals`
- `payableDays`, `perDaySalary`, `grossPayable`
- `deductions`: `{ unpaidLeave, halfDay, latePenalty, total }`
- `netPayable`
- `status`: `draft` | `processed` | `locked`
- `anomalies` (Array): Detected issues during calculation
- `payslipGenerated`: Whether payslip has been generated

**States:**
- **Draft**: Initial calculation, can be modified
- **Processed**: Finalized, ready for review
- **Locked**: Immutable, cannot be modified

### 3. Payslip
Generated payslip document for each payroll.

**Key Fields:**
- `payrollId`: Reference to payroll record
- `employeeId`: Employee reference
- `employeeIdString`: Employee ID string (e.g., "EMP001")
- `payrollMonth`, `payrollYear`
- Salary breakdown (gross, deductions, net)
- Attendance summary
- `pdfUrl`: Base64-encoded PDF data
- `version`: Version number (for regenerated payslips)

### 4. PayrollAudit
Comprehensive audit trail for all payroll operations.

**Actions Tracked:**
- `salary_structure_created` / `updated` / `deactivated`
- `payroll_processed` / `locked` / `unlocked`
- `payslip_generated` / `regenerated`
- `manual_adjustment` (if implemented)

**Fields:**
- `action`, `description`, `changes` (before/after)
- `performedBy`, `performedAt`
- References to related entities

## Payroll Calculation Engine

### Calculation Flow

1. **Input Gathering:**
   - Fetch attendance records for the month
   - Fetch approved leaves for the month
   - Get assigned shifts for working days calculation

2. **Working Days Calculation:**
   - **Shift-based**: Count days with assigned shifts matching working days
   - **Calendar days**: Count all days excluding Sundays
   - **Fixed days**: Use configured fixed working days

3. **Day Classification:**
   - Present days (with attendance record, status = 'present')
   - Absent days (status = 'absent' or missing attendance on working day)
   - Half days (status = 'half_day')
   - Paid leave days (approved leave with paid leave type)
   - Unpaid leave days (approved leave with unpaid leave type)

4. **Payable Days Calculation:**
   ```
   payableDays = presentDays + paidLeaveDays + (halfDays * 0.5)
   ```

5. **Salary Calculation:**
   ```
   perDaySalary = grossMonthlySalary / totalWorkingDays
   grossPayable = payableDays * perDaySalary
   ```

6. **Deductions:**
   ```
   unpaidLeaveDeduction = unpaidLeaveDays * perDaySalary
   halfDayDeduction = halfDays * perDaySalary * 0.5 (if half_day rule)
   totalDeductions = unpaidLeaveDeduction + halfDayDeduction + latePenalty
   ```

7. **Net Payable:**
   ```
   netPayable = grossPayable - totalDeductions
   ```

### Anomaly Detection

The system detects and flags:
- Missing attendance records on working days
- Attendance/leave days exceeding total working days
- Inconsistent data patterns

## API Endpoints

### Salary Structure Management
- `GET /api/payroll/salary-structure` - List structures
- `POST /api/payroll/salary-structure` - Create structure
- `GET /api/payroll/salary-structure/[id]` - Get structure
- `PUT /api/payroll/salary-structure/[id]` - Update (creates new version)
- `DELETE /api/payroll/salary-structure/[id]` - Deactivate

### Payroll Processing
- `GET /api/payroll/process` - List payrolls (role-based filtering)
- `POST /api/payroll/process` - Process payroll for month
- `GET /api/payroll/[id]` - Get single payroll
- `PUT /api/payroll/[id]` - Lock/unlock payroll

### Payslip Management
- `GET /api/payroll/payslip/[id]` - Get payslip (id can be payrollId or payslipId)
- `POST /api/payroll/payslip/[id]` - Generate/regenerate payslip

### Dashboard
- `GET /api/payroll/dashboard` - Get dashboard statistics (HR only)

## Role-Based Access Control

### Admin/HR
- Full access to all payroll operations
- Create/update salary structures
- Process and lock payrolls
- Generate payslips
- View audit logs

### Employee
- Read-only access to own payroll records
- View salary breakdown
- Download own payslips
- No edit or dispute actions

### Manager
- No payroll access (as per requirements)

## Payroll Processing Workflow

1. **Select Period**: Choose month and year
2. **Preview**: System fetches attendance and leave data
3. **Calculate**: Automatic calculation for all active employees
4. **Review**: Check for anomalies and discrepancies
5. **Process**: Mark payrolls as "processed"
6. **Generate Payslips**: Create PDF payslips
7. **Lock**: Finalize and prevent modifications

## Payslip Generation

- Uses `jsPDF` library for PDF generation
- Includes:
  - Employee details
  - Payroll period
  - Salary breakdown
  - Deductions breakdown
  - Attendance summary
- Stored as base64 data URL in database
- Versioned (regeneration creates new version)
- Immutable after generation (can regenerate but old version preserved)

## Edge Case Handling

### Employee Joined Mid-Month
- Working days calculated from join date
- Salary prorated automatically

### Employee Inactive During Period
- Only active employees processed
- Inactive employees skipped

### Missing Attendance Data
- Flagged as anomaly
- Treated as absent if on working day

### Shift Changes Within Month
- Uses assigned shift for each day
- Handles multiple shift assignments correctly

### Leave Overlapping Payroll Cycle
- Leave days counted correctly
- Handles partial month leaves

## Security & Audit

- All operations logged in `PayrollAudit`
- Salary structure changes versioned
- Payroll locked after processing prevents tampering
- Role-based access strictly enforced
- No manual salary overrides without audit trail

## Integration Points

### Attendance Module
- Reads attendance records for calculation
- Validates attendance data

### Leave Management
- Reads approved leaves
- Distinguishes paid vs unpaid leaves

### Shift & Roster Management
- Uses assigned shifts for working days calculation
- Handles shift-based working days rule

### Employee Management
- Uses employee data for payroll assignment
- Filters active employees only

## Future Enhancements

1. **Tax Calculations**: Add PF, ESI, TDS calculations
2. **Bonus & Incentives**: Support for variable pay components
3. **Payroll Disputes**: Employee dispute submission workflow
4. **Automated Processing**: Scheduled monthly payroll processing
5. **Email Notifications**: Automatic payslip email delivery
6. **Export Functionality**: Bulk export payroll data

## File Structure

```
lib/
  models/
    SalaryStructure.ts
    Payroll.ts
    Payslip.ts
    PayrollAudit.ts
  utils/
    payroll.ts (calculation engine)

app/
  api/
    payroll/
      salary-structure/
        route.ts
        [id]/route.ts
      process/
        route.ts
      [id]/route.ts
      payslip/
        [id]/route.ts
      dashboard/
        route.ts
  dashboard/
    hr/
      payroll/
        page.tsx
    employee/
      payroll/
        page.tsx

components/
  hr/
    payroll-management-client.tsx
  employee/
    payroll-client.tsx
```

## Usage Guide

### For HR/Admin

1. **Create Salary Structure:**
   - Navigate to Payroll → Salary Structures
   - Click "Create Salary Structure"
   - Select employee or role
   - Configure salary and rules
   - Set effective date

2. **Process Payroll:**
   - Navigate to Payroll → Dashboard
   - Select month and year
   - Click "Process Payroll"
   - Review anomalies
   - Generate payslips
   - Lock payrolls

### For Employees

1. **View Payroll:**
   - Navigate to Payroll
   - Select month/year
   - View salary breakdown
   - Download payslip

## Notes

- Payroll calculations are deterministic and reproducible
- All data is read-only from source modules (attendance, leave, shifts)
- Historical payrolls remain unchanged after locking
- Salary structure changes create new versions, preserving history
- Audit logs provide complete traceability

