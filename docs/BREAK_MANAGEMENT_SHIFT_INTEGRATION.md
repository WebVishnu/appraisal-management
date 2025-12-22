# Break Management Integration with Shift & Roster Management

## Overview

Break management has been fully integrated into the existing **Shift & Roster Management** system in the HR Dashboard. All break functionality is accessible from the same interface, maintaining consistency and ease of use.

## Integration Points

### 1. Shift Management Tab

**Location:** `HR Dashboard → Shift & Roster Management → Shifts Tab`

**Break-Related Features:**
- View break duration configured for each shift
- See if breaks are paid or unpaid per shift
- Break information displayed in shift cards:
  ```
  Break: 60 min (Paid/Unpaid)
  ```

**How it works:**
- Each shift has `breakDuration` and `isBreakPaid` fields
- These are displayed in the shift card
- Break policies can be assigned to specific shifts (see Break Policies tab)

### 2. Break Policies Tab (NEW)

**Location:** `HR Dashboard → Shift & Roster Management → Break Policies Tab`

**Features:**
- **Analytics Dashboard**: 
  - Total breaks taken (last 7 days)
  - Total break time
  - Average break duration
  - Violations count

- **Policy Management**:
  - Create break policies
  - Edit existing policies
  - Deactivate policies
  - View all active policies

- **Policy Configuration**:
  - **Scope**: Global, Department, Role, **Shift**, Employee
  - **Break Limits**: Max breaks per day, max duration, max per break
  - **Break Types**: Lunch, Tea, Personal, Custom
  - **Mandatory Breaks**: Which breaks must be taken
  - **Paid Breaks**: Which breaks are paid
  - **Time Rules**: Min working hours before first break, grace period
  - **Enforcement**: Auto-flag violations, allow overrun

- **Shift-Based Policies**:
  - When scope is "Shift", you can select specific shifts
  - Policy applies only to employees assigned to those shifts
  - Perfect for shift-specific break rules

### 3. Roster Management

**Location:** `HR Dashboard → Shift & Roster Management → Roster Tab`

**Break Integration:**
- When creating roster entries, break policies are automatically applied
- Break policies are determined by:
  1. Shift-specific policy (if exists)
  2. Employee's assigned shift
  3. Department/role/global policies (fallback)

**Manager Roster View:**
- Managers can see team roster with shift assignments
- Break information available when viewing attendance details
- Break violations visible in team attendance reports

## User Flows

### Flow 1: HR Creates Shift-Specific Break Policy

```
1. Navigate to: Shift & Roster Management → Break Policies Tab
2. Click: "Create Break Policy"
3. Configure:
   - Name: "Night Shift Break Policy"
   - Scope: "Shift"
   - Select Shifts: [Night Shift, Late Night Shift]
   - Max Breaks: 4 per day
   - Max Duration: 90 minutes
   - Allowed Types: Lunch, Tea, Personal
   - Paid Breaks: All
4. Save Policy
5. Policy applies to all employees on selected shifts
```

### Flow 2: View Break Analytics

```
1. Navigate to: Shift & Roster Management → Break Policies Tab
2. View Analytics Cards:
   - Total Breaks (last 7 days)
   - Total Break Time
   - Average Duration
   - Violations Count
3. Use data to:
   - Identify patterns
   - Adjust policies
   - Review violations
```

### Flow 3: Assign Break Policy to Shift

```
1. Create/Edit Shift in Shifts Tab
2. Note: Break duration and paid status in shift config
3. Go to Break Policies Tab
4. Create policy with scope = "Shift"
5. Select the shift(s) in scopeIds
6. Policy automatically applies to employees on those shifts
```

## Break Policy Priority (Shift Context)

When an employee is on a shift, break policies are resolved in this order:

1. **Shift-Specific Policy** (highest priority)
   - Policy with scope = "shift" and shiftId in scopeIds
   - Applies to all employees on that shift

2. **Employee-Specific Policy**
   - Policy with scope = "employee" and employeeId in scopeIds

3. **Role-Specific Policy**
   - Policy with scope = "role" matching employee's role

4. **Department-Specific Policy**
   - Policy with scope = "department" matching employee's department

5. **Global Policy** (lowest priority)
   - Policy with scope = "global"
   - Applies to all employees

## Integration Benefits

### 1. Centralized Management
- All shift, roster, and break management in one place
- No need to navigate between different sections
- Consistent UI/UX

### 2. Shift-Aware Policies
- Break policies can be tied to specific shifts
- Different break rules for different shifts
- Example: Night shifts get longer breaks

### 3. Analytics Integration
- Break analytics visible alongside shift management
- Easy to correlate break usage with shift patterns
- Identify shift-specific break trends

### 4. Roster Integration
- Break policies automatically apply when creating rosters
- No separate break configuration needed
- Seamless workflow

## API Endpoints Used

### Break Policies
- `GET /api/breaks/policies` - List all policies
- `POST /api/breaks/policies` - Create policy
- `PUT /api/breaks/policies/:id` - Update policy
- `DELETE /api/breaks/policies/:id` - Deactivate policy

### Break Analytics
- `GET /api/breaks/analytics` - Get analytics data
  - Query params: `startDate`, `endDate`, `departmentId`

### Employee Breaks
- `GET /api/breaks/employee/:employeeId` - View employee breaks
  - Query params: `startDate`, `endDate`

## UI Components

### Break Policies Tab
- **Location**: `components/hr/break-policies-tab.tsx`
- **Features**:
  - Analytics cards
  - Policy list with edit/delete
  - Create/Edit policy dialog
  - Shift selection for shift-scoped policies

### Shift Management Integration
- Break information shown in shift cards
- Break policies can reference shifts
- Shift selection in policy creation

### Roster Integration
- Break policies apply automatically
- Break information available in attendance views
- Violations visible in roster reports

## Configuration Examples

### Example 1: Standard Office Shift Policy
```json
{
  "name": "Standard Office Break Policy",
  "scope": "shift",
  "scopeIds": ["morning_shift_id", "afternoon_shift_id"],
  "maxBreaksPerDay": 3,
  "maxTotalBreakDuration": 60,
  "maxDurationPerBreak": 30,
  "allowedBreakTypes": ["lunch", "tea", "personal"],
  "paidBreaks": ["lunch"],
  "deductBreakTime": true
}
```

### Example 2: Night Shift Policy
```json
{
  "name": "Night Shift Break Policy",
  "scope": "shift",
  "scopeIds": ["night_shift_id"],
  "maxBreaksPerDay": 4,
  "maxTotalBreakDuration": 90,
  "maxDurationPerBreak": 30,
  "allowedBreakTypes": ["lunch", "tea", "personal"],
  "paidBreaks": ["lunch", "tea"],
  "deductBreakTime": false
}
```

## Best Practices

1. **Shift-Specific Policies**
   - Create separate policies for different shift types
   - Night shifts may need different break rules
   - Flexible shifts may need more break allowance

2. **Policy Hierarchy**
   - Use global policy as default
   - Override with shift-specific policies where needed
   - Keep policies simple and clear

3. **Analytics Review**
   - Regularly review break analytics
   - Adjust policies based on actual usage
   - Monitor violations and patterns

4. **Roster Planning**
   - Consider break policies when creating rosters
   - Ensure employees have appropriate break allowances
   - Account for break time in shift planning

## Summary

Break management is now fully integrated into the Shift & Roster Management system:

✅ **Break Policies Tab** - Manage all break policies
✅ **Shift Integration** - Policies can be shift-specific
✅ **Analytics Dashboard** - View break usage and violations
✅ **Roster Integration** - Policies apply automatically
✅ **Centralized Management** - Everything in one place

The system maintains the existing workflow while adding powerful break management capabilities seamlessly.

