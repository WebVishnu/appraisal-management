# Break Management System - User Guide

## Overview

This guide explains how HR manages break policies and how employees start/end breaks using both the **Dashboard (Web)** and **Mobile App**.

---

## 👔 HR Management (Dashboard - Web)

### 1. Break Policy Management

**Location:** `Dashboard → HR → Break Policies`

#### Creating a Break Policy

1. Navigate to **HR Dashboard → Break Policies**
2. Click **"Create New Policy"**
3. Fill in the policy details:
   - **Name**: Policy name (e.g., "Standard Office Policy")
   - **Scope**: Choose from:
     - **Global**: Applies to all employees
     - **Department**: Select specific departments
     - **Role**: Select specific roles
     - **Shift**: Select specific shifts
     - **Employee**: Select specific employees
   - **Break Settings**:
     - Allow breaks: Yes/No
     - Max breaks per day: Number (e.g., 3)
     - Max total break duration: Minutes (e.g., 60)
     - Max duration per break: Minutes (e.g., 30)
   - **Break Types**: Select allowed types (lunch, tea, personal, custom)
   - **Mandatory Breaks**: Breaks that must be taken (e.g., lunch)
   - **Time Rules**:
     - Minimum working hours before first break
     - Grace period for overrun (minutes)
   - **Payroll Settings**:
     - Paid breaks: Which break types are paid
     - Deduct break time: Whether to deduct from working hours
   - **Enforcement**:
     - Auto-flag excessive breaks
     - Allow break overrun
   - **Effective Dates**: From and To dates
4. Click **"Save Policy"**

#### Viewing/Editing Policies

1. Navigate to **HR Dashboard → Break Policies**
2. View all policies in a table
3. Click **"Edit"** to modify a policy
4. Click **"Deactivate"** to disable a policy (soft delete)

#### Policy Priority

Policies are applied in this order (most specific first):
1. Employee-specific
2. Shift-specific
3. Role-specific
4. Department-specific
5. Global

### 2. Viewing Employee Breaks

**Location:** `Dashboard → HR → Attendance → View Breaks`

#### Daily Break Overview

1. Navigate to **HR Dashboard → Attendance**
2. Click on an employee's attendance record
3. View **"Break Details"** section showing:
   - All breaks taken that day
   - Break start/end times
   - Break durations
   - Total break time
   - Violations (if any)

#### Break Analytics Dashboard

1. Navigate to **HR Dashboard → Break Analytics**
2. View:
   - **Daily Summary**: Total breaks taken, average break time
   - **Department-wise**: Break usage by department
   - **Violations**: Employees exceeding break limits
   - **Trends**: Break usage over time

### 3. Managing Break Violations

**Location:** `Dashboard → HR → Attendance → Break Violations`

#### Viewing Violations

1. Navigate to **HR Dashboard → Break Violations**
2. See list of:
   - Excessive break duration
   - Exceeded daily break limit
   - Policy violations
3. Filter by:
   - Date range
   - Department
   - Employee
   - Violation type

#### Correcting Breaks

1. Click on a violation
2. Click **"Correct Break"**
3. Enter:
   - **Reason**: Why correction is needed
   - **Action**: Adjust duration, mark as paid/unpaid, etc.
4. Click **"Save Correction"**
5. Correction is logged in audit trail

---

## 👤 Employee Usage

### Mobile App

#### Starting a Break

1. Open the **Mobile App**
2. Navigate to **Attendance** tab
3. Ensure you're **Checked In**
4. In the **"Breaks"** section, tap:
   - **"Start Lunch"** (for lunch break)
   - **"Start Tea/Coffee"** (for tea break)
   - **"Start Personal"** (for personal break)
5. Break timer starts automatically
6. Status shows: **"On [Break Type] Break"** with live timer

#### Ending a Break

1. While on break, tap **"End Break"**
2. Break ends and duration is recorded
3. You return to **"Working"** status
4. Break appears in **"Today's Breaks"** list

#### Viewing Break Summary

1. In **Attendance** tab, scroll to **"Breaks"** section
2. View:
   - **Active Break**: Current break with timer (if any)
   - **Today's Breaks**: List of completed breaks
   - **Total Break Time**: Sum of all breaks today
   - **Remaining**: Time and count remaining (if limited)

#### Check-Out During Break

- If you try to check out while on break:
  - System warns: "You are currently on a break"
  - Break is **automatically ended** when you check out
  - Check-out proceeds normally

### Dashboard (Web)

#### Starting a Break

1. Navigate to **Dashboard → Employee → Attendance**
2. Ensure you're **Checked In**
3. In the **"Break Management"** section:
   - Click **"Start Break"** dropdown
   - Select break type (Lunch, Tea, Personal)
   - Click **"Start"**
4. Break timer appears with live countdown

#### Ending a Break

1. While on break, click **"End Break"** button
2. Break ends and is recorded
3. Break appears in **"Today's Breaks"** table

#### Viewing Break History

1. Navigate to **Dashboard → Employee → Attendance**
2. Scroll to **"Break History"** section
3. View:
   - Today's breaks with start/end times
   - Break durations
   - Total break time
   - Remaining break allowance

---

## 🔄 Break Flow Examples

### Example 1: Standard Work Day

```
09:00 AM - Check In
11:00 AM - Start Tea Break (15 min)
11:15 AM - End Tea Break
01:00 PM - Start Lunch Break (30 min)
01:30 PM - End Lunch Break
05:00 PM - Check Out
Total Break Time: 45 minutes
Net Working Hours: 7 hours 15 minutes
```

### Example 2: With Violation

```
09:00 AM - Check In
12:00 PM - Start Lunch Break
12:45 PM - End Lunch Break (45 min - exceeds 30 min limit)
⚠️ Violation Flagged: "Break duration exceeded"
HR can review and correct if needed
```

### Example 3: Multiple Breaks

```
09:00 AM - Check In
10:30 AM - Start Tea Break (10 min)
10:40 AM - End Tea Break
01:00 PM - Start Lunch Break (30 min)
01:30 PM - End Lunch Break
03:00 PM - Start Personal Break (5 min)
03:05 PM - End Personal Break
06:00 PM - Check Out
Total Breaks: 3
Total Break Time: 45 minutes
```

---

## 📊 Break Policy Examples

### Policy 1: Standard Office Policy

- **Scope**: Global
- **Max Breaks**: 3 per day
- **Max Total Duration**: 60 minutes
- **Max Per Break**: 30 minutes
- **Allowed Types**: Lunch, Tea, Personal
- **Paid Breaks**: Lunch
- **Deduct Time**: Yes (unpaid breaks deducted)

### Policy 2: Flexible Work Policy

- **Scope**: Department (Engineering)
- **Max Breaks**: 5 per day
- **Max Total Duration**: 90 minutes
- **Max Per Break**: 20 minutes
- **Allowed Types**: All
- **Paid Breaks**: All
- **Deduct Time**: No

### Policy 3: Strict Policy

- **Scope**: Role (Intern)
- **Max Breaks**: 2 per day
- **Max Total Duration**: 30 minutes
- **Max Per Break**: 15 minutes
- **Allowed Types**: Lunch only
- **Mandatory**: Lunch break
- **Deduct Time**: Yes

---

## ⚠️ Common Scenarios

### Scenario 1: Forgot to End Break

**What happens:**
- Break continues until check-out
- Break is auto-ended on check-out
- Status: `auto_completed`
- Duration calculated from start to check-out time

**Solution:**
- Employee can end break manually before check-out
- HR can correct if needed

### Scenario 2: Exceeded Break Limit

**What happens:**
- System flags violation
- Break is still recorded
- HR is notified
- Employee sees warning

**HR Action:**
- Review violation
- Correct if justified
- Add notes explaining reason

### Scenario 3: Policy Changed Mid-Day

**What happens:**
- Policy at break start time is used
- New policy applies to future breaks
- Existing breaks unaffected

---

## 🔐 Permissions

### HR/Admin
- ✅ Create/edit/delete break policies
- ✅ View all employee breaks
- ✅ Correct break entries
- ✅ View break analytics
- ✅ Override violations

### Manager
- ✅ View team member breaks
- ✅ View break analytics (team only)
- ❌ Cannot create policies
- ❌ Cannot correct breaks

### Employee
- ✅ Start/end own breaks
- ✅ View own break history
- ❌ Cannot edit past breaks
- ❌ Cannot view others' breaks

---

## 📱 Mobile App Features

### Real-Time Break Timer
- Live countdown while on break
- Shows: Hours, Minutes, Seconds
- Updates every second

### Break Status Indicator
- **Working**: Green indicator
- **On Break**: Blue indicator with timer
- **Break Ended**: Gray indicator

### Break Summary Card
- Total break time today
- Remaining break time (if limited)
- Number of breaks taken
- Policy limits displayed

---

## 🌐 Dashboard Features

### Break Management Panel
- Start/End break buttons
- Break type selector
- Live break timer
- Break history table

### Break Analytics (HR)
- Daily/weekly/monthly reports
- Department comparisons
- Violation trends
- Average break times

### Break Policy Editor
- Visual policy builder
- Scope selector with search
- Real-time validation
- Policy preview

---

## 🎯 Best Practices

### For HR
1. **Set Clear Policies**: Define break rules clearly
2. **Regular Reviews**: Review violations weekly
3. **Fair Corrections**: Document all corrections
4. **Policy Updates**: Communicate policy changes

### For Employees
1. **End Breaks Promptly**: Don't forget to end breaks
2. **Respect Limits**: Stay within policy limits
3. **Use Appropriate Types**: Select correct break type
4. **Check Remaining Time**: Monitor remaining allowance

---

## 📞 Support

If you encounter issues:
1. Check break policy settings
2. Verify you're checked in
3. Check remaining break allowance
4. Contact HR for policy questions
5. Report technical issues to IT

---

## 🔄 System Behavior

### Automatic Actions
- ✅ Auto-end break on check-out
- ✅ Calculate break duration
- ✅ Flag violations
- ✅ Update working hours
- ✅ Log all break actions

### Validation Rules
- ✅ Must be checked in to start break
- ✅ Cannot start break if already on break
- ✅ Cannot check out while on break (auto-ends)
- ✅ Respects policy limits
- ✅ Validates break types

---

This system ensures accurate break tracking, fair policy enforcement, and seamless integration with payroll calculations.

