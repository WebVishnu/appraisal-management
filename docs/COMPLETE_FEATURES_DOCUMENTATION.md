# HR Management System - Complete Features Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [User Roles & Access Control](#user-roles--access-control)
3. [Authentication & Security](#authentication--security)
4. [Employee Management](#employee-management)
5. [Attendance Management](#attendance-management)
6. [Leave Management](#leave-management)
7. [Shift & Roster Management](#shift--roster-management)
8. [Performance Appraisal System](#performance-appraisal-system)
9. [Work Reports & Productivity](#work-reports--productivity)
10. [Notifications System](#notifications-system)
11. [Dashboard & Analytics](#dashboard--analytics)
12. [Reporting & Export](#reporting--export)

---

## System Overview

The HR Management System is a comprehensive, role-based human resources management platform built with Next.js 16, React 19, TypeScript, MongoDB, and NextAuth.js. It provides end-to-end HR management capabilities including employee management, attendance tracking, leave management, shift scheduling, performance appraisals, and productivity analytics.

### Technology Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: NextAuth.js with credentials provider
- **Password Security**: bcrypt for password hashing
- **Validation**: Zod for input validation
- **UI Components**: Radix UI, Lucide React icons, Recharts for data visualization

---

## User Roles & Access Control

The system supports four distinct user roles with granular access control:

### 1. Super Admin
- **Full System Access**: Complete administrative control
- **User Management**: Create, update, delete HR users and Managers
- **View All Reports**: Access to all system reports and analytics
- **System Configuration**: Manage system-wide settings

### 2. HR (Human Resources)
- **Employee Management**: Full CRUD operations on employee records
- **Appraisal Cycle Management**: Create and manage performance appraisal cycles
- **Attendance Oversight**: View and correct attendance records for all employees
- **Leave Management**: Approve/reject leave requests, manage leave balances
- **Shift & Roster Management**: Create shifts, assign employees, manage rosters
- **Work Report Review**: Review and approve employee work reports
- **Analytics Access**: View productivity analytics and team performance metrics
- **Reports**: Generate and view comprehensive HR reports

### 3. Manager
- **Team Management**: View and manage team members
- **Team Reviews**: Conduct performance reviews for team members
- **Team Attendance**: View attendance records for team members
- **Leave Approval**: Approve/reject leave requests from team members
- **Work Report Review**: Review, approve, or return team member work reports
- **Team Roster**: View and manage team shift rosters
- **Goals Management**: Set and track team goals
- **Calendar View**: View team calendar with leaves, shifts, and events
- **Team Analytics**: View productivity metrics for team members

### 4. Employee
- **Self-Service Portal**: Access personal dashboard and information
- **Attendance Tracking**: Check in/check out, view attendance history
- **Leave Requests**: Apply for leaves, view leave balance, track leave status
- **Self Reviews**: Submit self-assessment during appraisal cycles
- **Work Reports**: Submit daily/weekly work reports
- **Performance History**: View historical performance appraisals and ratings
- **Shift View**: View assigned shifts and roster
- **Notifications**: Receive notifications for important updates

---

## Authentication & Security

### Authentication Features
- **Credential-Based Login**: Email and password authentication
- **Session Management**: Secure session handling with NextAuth.js
- **Password Security**: 
  - Bcrypt hashing (10 rounds)
  - Default password generation for new employees (employeeId@123)
- **Route Protection**: Middleware-based route protection
- **Role-Based Access Control**: Enforced on both frontend and backend

### Security Features
- **Input Validation**: Zod schemas validate all API inputs
- **Data Isolation**: 
  - Employees can only access their own data
  - Managers can only access their team's data
  - HR/Admin have organization-wide access
- **Audit Trails**: Track who created/modified records (createdBy, updatedBy fields)
- **Type Safety**: Full TypeScript implementation for type safety

---

## Employee Management

### Features
- **Employee CRUD Operations**
  - Create new employees with unique employee ID
  - Update employee information (name, email, role, manager)
  - Deactivate/reactivate employees
  - Delete employees (with cascade to user accounts)
- **Employee Profile Management**
  - Employee ID (unique identifier)
  - Name, Email, Role
  - Manager assignment (hierarchical structure)
  - Active/Inactive status
  - Timestamps (created, updated)
- **User Account Integration**
  - Automatic user account creation for new employees
  - Role assignment based on employee role
  - Account activation/deactivation sync
- **Team Management**
  - View team members (for managers)
  - Hierarchical employee structure
  - Manager-employee relationships

### API Endpoints
- `GET /api/employees` - List all employees (HR/Admin only)
- `POST /api/employees` - Create new employee (HR/Admin only)
- `PUT /api/employees` - Update employee (HR/Admin only)
- `DELETE /api/employees` - Delete employee (HR/Admin only)
- `GET /api/employees/[id]` - Get employee details
- `GET /api/employees/me` - Get current user's employee record
- `GET /api/employees/team` - Get team members (Manager only)

---

## Attendance Management

### Core Features
- **Check-In/Check-Out System**
  - One check-in per day per employee
  - Automatic late detection based on shift timing
  - Early exit detection
  - Working hours calculation
- **Shift Integration**
  - Automatic shift detection for check-in
  - Grace period handling (configurable per shift)
  - Night shift support (crosses midnight)
- **Attendance Status**
  - Present
  - Absent
  - Half Day
  - Missed Checkout
- **Manual Corrections** (HR/Admin only)
  - Edit attendance records
  - Correct check-in/check-out times
  - Add notes
  - Change status
  - Track who made corrections (audit trail)
- **Attendance Tracking**
  - Daily attendance records
  - Date range filtering
  - Employee-specific filtering
  - Status-based filtering

### Attendance Calculations
- **Working Hours**: Calculated from check-in to check-out (handles night shifts)
- **Late Detection**: Based on shift start time + grace period
- **Early Exit Detection**: Based on minimum working hours requirement
- **Status Determination**: Automatic status assignment based on attendance data

### API Endpoints
- `POST /api/attendance/check-in` - Employee check-in
- `POST /api/attendance/check-out` - Employee check-out
- `GET /api/attendance` - Get attendance records (role-based filtering)
- `POST /api/attendance` - Create manual attendance record (HR/Admin only)
- `PUT /api/attendance` - Update attendance record (HR/Admin only)

### Data Model
- Employee ID (reference)
- Date
- Check-in time
- Check-out time (optional)
- Working hours (calculated, in minutes)
- Status (present/absent/half_day/missed_checkout)
- Is Late (boolean)
- Is Early Exit (boolean)
- Notes
- Shift ID (reference)
- Corrected By (audit)
- Corrected At (audit)

---

## Leave Management

### Leave Types
- **Paid Leave**: Paid time off
- **Unpaid Leave**: Unpaid time off
- **Sick Leave**: Medical leave
- **Casual Leave**: Casual time off
- **Annual Leave**: Annual vacation leave

### Leave Features
- **Leave Application**
  - Apply for leave with start/end dates
  - Specify leave type
  - Provide reason
  - Half-day support (0.5 days minimum)
  - Automatic working days calculation (excludes weekends)
- **Leave Approval Workflow**
  - Pending → Approved/Rejected
  - Manager approval required
  - HR can approve/reject any leave
  - Rejection reason tracking
  - Cancellation support (by employee for pending leaves)
- **Leave Balance Management**
  - Track leave balances by type and year
  - Automatic balance deduction on approval
  - Balance restoration on cancellation
  - Manual balance adjustment (HR/Admin only)
  - Available days calculation (total - used)
- **Leave Integration**
  - Automatic attendance record creation for approved leaves
  - Leave-attendance synchronization
  - Overlapping leave detection
- **Leave Balance Tracking**
  - Total days allocated
  - Used days
  - Available days (auto-calculated)
  - Year-based tracking
  - Notes and audit trail

### API Endpoints
- `GET /api/leaves` - Get leave requests (role-based filtering)
- `POST /api/leaves` - Create leave request
- `PUT /api/leaves/[id]` - Approve/reject/cancel leave
- `DELETE /api/leaves/[id]` - Delete leave (HR/Admin or employee for pending)
- `GET /api/leaves/balance` - Get leave balance
- `PUT /api/leaves/balance` - Update leave balance (HR/Admin only)

### Data Model
- Employee ID
- Leave Type
- Start Date
- End Date
- Number of Days (calculated, supports 0.5 days)
- Reason
- Status (pending/approved/rejected/cancelled)
- Applied By (user reference)
- Approved By (user reference, audit)
- Approved At (timestamp)
- Rejection Reason

---

## Shift & Roster Management

### Shift Management
- **Shift Types**
  - Fixed Shift: Same schedule every day
  - Rotational Shift: Rotates on a schedule
  - Flexible Shift: Variable timing
- **Shift Configuration**
  - Name
  - Start Time (HH:mm format)
  - End Time (HH:mm format)
  - Grace Period (minutes for late arrival)
  - Early Exit Grace Period (minutes)
  - Minimum Working Hours (minutes)
  - Break Duration (minutes)
  - Paid/Unpaid Break
  - Working Days (Monday-Sunday selection)
  - Night Shift Support (crosses midnight)
  - Active/Archived Status
- **Shift Assignment**
  - Permanent Assignment: Ongoing shift assignment
  - Temporary Assignment: Date-range based assignment
  - Assignment Scope:
    - Individual Employee
    - Team (by manager)
    - Department (by role)
  - Effective Date tracking
  - Assignment reason/notes
  - Active/Inactive status

### Roster Management
- **Roster Creation**
  - Daily roster entries
  - Weekly roster support (with week number)
  - Monthly roster support (with month number)
  - Year-based organization
- **Roster Features**
  - Assign shifts to employees for specific dates
  - Weekly off marking
  - Notes support
  - Bulk roster creation
  - Roster viewing by date range
- **Shift Swap System**
  - Employee-initiated shift swap requests
  - Request another employee to swap shifts
  - Manager approval required
  - Status tracking (pending/approved/rejected/cancelled)
  - Rejection reason support
  - Date and shift tracking for both parties

### API Endpoints
- `GET /api/shifts` - List all shifts
- `POST /api/shifts` - Create shift (HR only)
- `GET /api/shifts/[id]` - Get shift details
- `PUT /api/shifts/[id]` - Update shift (HR only)
- `DELETE /api/shifts/[id]` - Delete shift (HR only)
- `GET /api/shifts/assignments` - Get shift assignments
- `POST /api/shifts/assignments` - Create shift assignment (HR only)
- `DELETE /api/shifts/assignments/[id]` - Remove assignment (HR only)
- `GET /api/shifts/roster` - Get roster entries
- `POST /api/shifts/roster` - Create roster entry (HR only)
- `PUT /api/shifts/roster/[id]` - Update roster entry (HR only)
- `DELETE /api/shifts/roster/[id]` - Delete roster entry (HR only)
- `GET /api/shifts/swaps` - Get shift swap requests
- `POST /api/shifts/swaps` - Create swap request (Employee)
- `PUT /api/shifts/swaps/[id]` - Approve/reject swap (Manager/HR)

---

## Performance Appraisal System

### Appraisal Cycle Management
- **Cycle Creation** (HR/Admin only)
  - Cycle name
  - Start date and end date
  - Status management (draft → open_self_review → open_manager_review → closed)
  - Custom competencies definition
- **Competency Types**
  - Rating-based competencies (1-5 scale, configurable max rating)
  - Text-based competencies (free-form responses)
- **Cycle Status Flow**
  1. **Draft**: Created but not active
  2. **Open for Self Review**: Employees can submit self-assessments
  3. **Open for Manager Review**: Managers can review team members
  4. **Closed**: Finalized, view-only

### Review Process
- **Self Review** (Employee)
  - Submit during "open_self_review" phase
  - Fill competencies (rating or text)
  - One submission per cycle
  - Can update before manager review phase
- **Manager Review** (Manager)
  - Review team members' self-assessments
  - Provide ratings and feedback
  - Submit during "open_manager_review" phase
  - View team's review status
- **Review Status**
  - Not Started
  - In Progress
  - Submitted
- **Final Ratings**
  - Average rating calculation
  - Viewable after cycle closure
  - Historical performance tracking

### API Endpoints
- `GET /api/cycles` - List all cycles (HR/Admin only)
- `POST /api/cycles` - Create cycle (HR/Admin only)
- `PUT /api/cycles` - Update cycle (HR/Admin only)
- `DELETE /api/cycles` - Delete cycle (HR/Admin only)
- `GET /api/cycles/active` - Get active cycles
- `GET /api/reviews/self` - Get self reviews (Employee)
- `POST /api/reviews/self` - Submit/update self review (Employee)
- `GET /api/reviews/manager` - Get manager reviews (Manager)
- `POST /api/reviews/manager` - Submit/update manager review (Manager)
- `GET /api/reviews/team-self` - Get team self reviews (Manager)

---

## Work Reports & Productivity

### Work Report Features
- **Report Types**
  - Daily Reports: Single day work report
  - Weekly Reports: Multi-day work report (with end date)
- **Report Status**
  - Draft: Being prepared
  - Submitted: Awaiting manager review
  - Approved: Manager approved
  - Returned: Returned for revision
- **Task Management**
  - Multiple tasks per report
  - Task categories:
    - Development
    - Testing
    - Meeting
    - Support
    - Learning
    - Documentation
    - Other
  - Task details:
    - Title
    - Description
    - Time spent (minutes)
    - Status (completed/in_progress/blocked)
    - Blocker reason (if blocked)
- **Report Content**
  - Key achievements
  - Challenges faced
  - Support needed
  - Self productivity rating (1-5 scale)
- **Auto-Filled Metadata**
  - Employee name, role
  - Manager information
  - Shift information
  - Attendance status
- **Manager Review**
  - Task-level comments
  - Overall feedback
  - Manager productivity rating (1-5 scale)
  - Flags:
    - Under-utilized
    - Overloaded
    - Needs Support
    - Excellent
  - Approval/rejection
  - Return reason (if returned)
- **Calculated Metrics**
  - Total work hours (auto-calculated from tasks)
  - Task completion count
  - Blocked tasks count
  - Productivity score (system-generated)
- **Attendance Integration**
  - Attendance mismatch detection
  - Correlation between attendance and productivity

### Productivity Analytics (HR/Admin only)
- **Organization-Level Metrics**
  - Total reports
  - Total employees reporting
  - Average productivity score
  - Total work hours
  - Average work hours per report
  - Task completion rate
  - Blocked tasks count
- **Team-Level Analytics**
  - Team productivity overview
  - Team member comparisons
  - Manager-specific analytics
- **Employee Analytics**
  - Individual productivity trends
  - High performers identification
  - Burnout risk detection
  - Work hours analysis
- **Attendance-Productivity Correlation**
  - Attendance status vs productivity
  - Work hours vs attendance hours comparison
  - Pattern detection

### API Endpoints
- `GET /api/reports/work` - Get work reports (role-based filtering)
- `POST /api/reports/work` - Create work report (Employee)
- `GET /api/reports/work/[id]` - Get work report details
- `PUT /api/reports/work/[id]` - Update work report (Employee)
- `DELETE /api/reports/work/[id]` - Delete work report (Employee/HR)
- `POST /api/reports/work/[id]/review` - Review work report (Manager/HR)
- `GET /api/reports/work/analytics` - Get productivity analytics (HR/Admin only)

---

## Notifications System

### Notification Types
- **Cycle Started**: Appraisal cycle has started
- **Cycle Deadline**: Appraisal cycle deadline approaching
- **Review Pending**: Review submission pending
- **Review Submitted**: Review has been submitted
- **Cycle Closed**: Appraisal cycle has been closed
- **Reminder**: General reminders

### Notification Features
- **User-Specific Notifications**
  - Targeted to specific users
  - Link to related content
  - Read/unread status
  - Timestamp tracking
- **Notification Management**
  - Mark as read
  - Delete notifications
  - Filter by type
  - View all notifications
- **Real-Time Updates**
  - Notification bell indicator
  - Unread count display
  - Notification panel

### API Endpoints
- `GET /api/notifications` - Get user notifications
- `POST /api/notifications` - Create notification (system)
- `DELETE /api/notifications` - Delete notification

---

## Dashboard & Analytics

### Super Admin Dashboard
- **User Management Overview**
  - Quick access to user management
  - System reports access
- **System-Wide Statistics**
  - Total users
  - System health metrics

### HR Dashboard
- **Overview Statistics**
  - Total employees (active/all)
  - Active appraisal cycles
  - Total cycles
  - Pending self reviews
  - Pending manager reviews
  - Average rating
- **Completion Rates**
  - Self review completion percentage
  - Manager review completion percentage
- **Cycles by Status**
  - Draft cycles count
  - Open for self review count
  - Open for manager review count
  - Closed cycles count
- **Recent Activity**
  - Self reviews submitted (last 7 days)
  - Manager reviews submitted (last 7 days)
  - Total submissions
- **Rating Distribution**
  - Distribution across rating scale (1-5)
  - Visual charts
- **Leave Statistics**
  - Pending leaves
  - Approved leaves
  - Rejected leaves
  - Recent leaves
- **Work Report Statistics**
  - Pending reports
  - Approved reports
  - Returned reports
  - Recent reports
- **Attendance Statistics**
  - Today's check-ins
  - This month's attendance
- **Quick Actions**
  - Create employee
  - Create cycle
  - View reports

### Manager Dashboard
- **Team Overview**
  - Team size
  - Active team members
- **Pending Actions**
  - Pending leave approvals
  - Pending work report reviews
  - Pending appraisal reviews
- **Team Statistics**
  - Team attendance summary
  - Team leave summary
  - Team productivity metrics
- **Recent Activity**
  - Recent team submissions
  - Recent approvals
- **Quick Access**
  - Team calendar
  - Team roster
  - Team goals

### Employee Dashboard
- **Personal Statistics**
  - Attendance summary (this month)
  - Leave balance summary
  - Pending leave requests
  - Upcoming leaves
- **Performance**
  - Current appraisal cycle status
  - Recent ratings
  - Performance history link
- **Work Reports**
  - Recent work reports
  - Pending submissions
  - Approved reports count
- **Notifications**
  - Unread notifications count
  - Recent notifications
- **Quick Actions**
  - Check in/out
  - Apply for leave
  - Submit work report
  - View shifts

### API Endpoints
- `GET /api/dashboard/stats` - Get dashboard statistics (HR/Admin)
- `GET /api/manager/dashboard` - Get manager dashboard data
- `GET /api/employee/dashboard` - Get employee dashboard data

---

## Reporting & Export

### Report Types
- **Appraisal Reports**
  - Filter by cycle
  - Filter by manager
  - Filter by employee
  - View detailed review data
  - Rating summaries
- **Attendance Reports**
  - Date range filtering
  - Employee filtering
  - Status filtering
  - Export capabilities
- **Leave Reports**
  - Leave summary by employee
  - Leave balance reports
  - Leave approval statistics
- **Work Report Analytics**
  - Productivity reports
  - Task completion reports
  - Team performance comparisons
- **HR Reports**
  - Employee reports
  - Performance reports
  - Attendance reports
  - Leave reports

### Report Features
- **Filtering Options**
  - Date range selection
  - Employee selection
  - Department/role filtering
  - Status filtering
  - Cycle filtering
- **Data Visualization**
  - Charts and graphs
  - Trend analysis
  - Comparative analysis
- **Export Capabilities** (Ready for extension)
  - PDF export
  - Excel export
  - CSV export

### API Endpoints
- `GET /api/reports` - Get reports with filters (HR/Admin only)

---

## Additional Features

### Theme Support
- **Dark/Light Mode**: System-wide theme toggle
- **Theme Persistence**: User preference saved

### UI/UX Features
- **Responsive Design**: Mobile-friendly interface
- **Loading States**: Skeleton loaders for better UX
- **Error Handling**: User-friendly error messages
- **Empty States**: Helpful empty state messages
- **Status Badges**: Visual status indicators
- **Toast Notifications**: Success/error feedback

### Data Management
- **Pagination**: Efficient data loading
- **Search & Filter**: Advanced filtering capabilities
- **Sorting**: Multi-column sorting
- **Bulk Operations**: Ready for bulk actions

### Integration Features
- **Leave-Attendance Integration**: Automatic attendance record creation for leaves
- **Shift-Attendance Integration**: Shift-based attendance validation
- **Work Report-Attendance Integration**: Attendance mismatch detection

---

## Database Models

### Core Models
1. **User**: Authentication and user accounts
2. **Employee**: Employee information and hierarchy
3. **Attendance**: Daily attendance records
4. **Leave**: Leave requests and approvals
5. **LeaveBalance**: Leave balance tracking
6. **Shift**: Shift definitions
7. **ShiftAssignment**: Shift assignments to employees/teams
8. **Roster**: Daily roster entries
9. **ShiftSwap**: Shift swap requests
10. **AppraisalCycle**: Performance appraisal cycles
11. **SelfReview**: Employee self-assessments
12. **ManagerReview**: Manager performance reviews
13. **WorkReport**: Daily/weekly work reports
14. **Notification**: User notifications

### Model Relationships
- User ↔ Employee (one-to-one)
- Employee ↔ Manager (many-to-one)
- Employee ↔ Attendance (one-to-many)
- Employee ↔ Leave (one-to-many)
- Employee ↔ LeaveBalance (one-to-many)
- Employee ↔ ShiftAssignment (many-to-many)
- Employee ↔ Roster (one-to-many)
- Employee ↔ WorkReport (one-to-many)
- AppraisalCycle ↔ SelfReview (one-to-many)
- AppraisalCycle ↔ ManagerReview (one-to-many)

---

## API Architecture

### RESTful API Design
- Standard HTTP methods (GET, POST, PUT, DELETE)
- Consistent response formats
- Error handling with appropriate status codes
- Role-based access control on all endpoints

### Authentication
- NextAuth.js session-based authentication
- Protected routes with middleware
- Role verification on API endpoints

### Data Validation
- Zod schema validation
- Input sanitization
- Type safety with TypeScript

---

## Future Enhancement Opportunities

### Planned Features (Not Yet Implemented)
- Email notifications for cycle status changes
- PDF/Excel export for reports
- Advanced analytics dashboards
- Multi-language support
- File uploads for supporting documents
- Performance improvement suggestions
- Mobile app support
- Calendar integration (Google Calendar, Outlook)
- Slack/Teams integration
- Automated reminders
- Bulk import/export
- Advanced reporting with custom queries
- Document management
- Employee onboarding workflow
- Exit interview management

---

## Summary

This HR Management System provides a comprehensive solution for managing all aspects of human resources, from basic employee information to complex performance appraisals and productivity analytics. The system is designed with scalability, security, and user experience in mind, supporting multiple user roles with appropriate access controls and features.

### Key Strengths
- **Comprehensive Coverage**: All major HR functions in one system
- **Role-Based Access**: Granular permissions for different user types
- **Integration**: Seamless integration between different modules
- **Analytics**: Rich analytics and reporting capabilities
- **User-Friendly**: Intuitive interface with modern UI/UX
- **Scalable Architecture**: Built for growth and expansion
- **Type Safety**: Full TypeScript implementation
- **Security**: Robust authentication and authorization

### System Capabilities
- ✅ Employee Management (CRUD)
- ✅ Attendance Tracking (Check-in/out, Manual corrections)
- ✅ Leave Management (Application, Approval, Balance tracking)
- ✅ Shift & Roster Management (Shifts, Assignments, Swaps)
- ✅ Performance Appraisals (Cycles, Self/Manager Reviews)
- ✅ Work Reports (Daily/Weekly, Manager Review, Analytics)
- ✅ Notifications System
- ✅ Dashboard & Analytics (Role-specific)
- ✅ Reporting (Multiple report types)
- ✅ User Management (Super Admin)
- ✅ Theme Support (Dark/Light mode)

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**System Version**: 0.1.0
