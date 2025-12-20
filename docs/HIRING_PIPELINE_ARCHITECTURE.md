# Hiring Pipeline Architecture

## Overview

The Hiring Pipeline is an end-to-end Applicant Tracking System (ATS) integrated with the HRMS. It manages the complete candidate journey from application to employee onboarding.

## Flow Diagram

```
Job Requisition → Candidate Application → Interview Rounds → Feedback → Offer → Onboarding → Active Employee
```

## Database Schema

### Core Entities

1. **JobRequisition** - Job openings with interview round templates
2. **Candidate** - Applicant records with status tracking
3. **Interview** - Scheduled interview sessions
4. **InterviewFeedback** - Structured evaluation from interviewers
5. **Offer** - Job offers with approval workflow
6. **InterviewAuditLog** - Complete audit trail

### Relationships

```
JobRequisition (1) ──→ (N) Candidate
Candidate (1) ──→ (N) Interview
Interview (1) ──→ (N) InterviewFeedback
Candidate (1) ──→ (1) Offer
Offer (1) ──→ (1) OnboardingRequest
OnboardingRequest (1) ──→ (1) Employee
```

## State Machine

### Candidate Status Flow

```
applied → screening → shortlisted → interview_scheduled → interview_in_progress 
→ interview_completed → offer_pending → offer_sent → offer_accepted → selected
```

**Terminal States:**
- `selected` - Converted to onboarding
- `rejected` - Rejected at any stage
- `withdrawn` - Candidate withdrew

**Special States:**
- `on_hold` - Temporarily paused (can resume from any previous state)

### Valid Transitions

See `lib/utils/candidate-state-machine.ts` for complete transition rules.

## API Endpoints

### Job Requisitions
- `GET /api/interviews/job-requisitions` - List all requisitions
- `POST /api/interviews/job-requisitions` - Create new requisition
- `PUT /api/interviews/job-requisitions` - Update requisition

### Candidates
- `GET /api/interviews/candidates` - List candidates (with filters)
- `POST /api/interviews/candidates` - Add new candidate
- `PUT /api/interviews/candidates` - Update candidate (status, details)

### Interviews
- `GET /api/interviews/interviews` - List interviews (calendar view)
- `POST /api/interviews/interviews` - Schedule interview
- `PUT /api/interviews/interviews` - Update interview (reschedule, cancel, complete)

### Feedback
- `GET /api/interviews/feedback` - Get feedback (role-based access)
- `POST /api/interviews/feedback` - Create/update feedback (draft)
- `PUT /api/interviews/feedback` - Submit feedback (final)

### Offers
- `GET /api/interviews/offers` - List offers
- `POST /api/interviews/offers` - Create offer
- `PUT /api/interviews/offers` - Update offer (approve, send, accept/reject via token)

## Role-Based Access Control

### HR / Recruiter
- Full access to all candidates, interviews, offers
- Can create job requisitions
- Can schedule interviews
- Can create and approve offers
- Can view all feedback

### Hiring Manager
- View candidates for their job requisitions
- View interviews for their positions
- Approve offers (if in approval workflow)
- View consolidated feedback

### Interviewer
- View assigned interviews
- Submit feedback for assigned interviews
- Cannot see other interviewers' feedback before submission
- View own submitted feedback

### Candidate (External)
- View interview details via secure link
- Accept/reject offers via secure token link

## Interview Feedback System

### Features
- **Blind Feedback**: Interviewers cannot see others' feedback before submitting
- **Immutable After Submission**: Feedback locked once submitted
- **Structured Evaluation**:
  - Technical Skills (1-5 rating)
  - Problem Solving (1-5 rating)
  - Communication (1-5 rating)
  - Culture Fit (1-5 rating)
  - Overall Recommendation (Strong Yes / Yes / Hold / No)
- **Weighted Scoring**: Configurable criteria with weightage
- **Auto-calculation**: Overall score calculated from ratings

### Feedback Submission Flow
1. Interviewer creates draft feedback
2. Can save multiple times (version tracking)
3. Submit final feedback (immutable)
4. HR/Manager can view all feedbacks after submission
5. Candidate overall score recalculated

## Offer Management

### Offer Creation
1. HR creates offer (draft)
2. Approval workflow triggered (if required)
3. Default workflow: HR → Hiring Manager → Finance
4. All approvals → Offer status: `approved`
5. HR sends offer → Status: `sent`

### Offer Acceptance
1. Candidate receives secure link with token
2. Can accept, reject, or counter-offer
3. On acceptance:
   - Offer status: `accepted`
   - Candidate status: `offer_accepted` → `selected`
   - **Automatic conversion to onboarding**

## Candidate to Onboarding Conversion

### Automatic Conversion Flow

When offer is accepted:

1. **Onboarding Request Created**
   - Pre-filled with candidate data
   - Job requisition details mapped
   - Offer compensation structure included
   - Secure token generated

2. **Candidate Status Updated**
   - Status: `selected`
   - `onboardingRequestId` linked
   - `convertedAt` timestamp

3. **Offer Linked**
   - `convertedToOnboardingRequestId` set
   - `convertedAt` timestamp

4. **Onboarding Invitation Sent**
   - Email with secure link
   - Token expiry: 30 days

### Data Mapping

| Candidate Field | Onboarding Field |
|----------------|------------------|
| firstName, lastName | firstName, lastName |
| email | email |
| phoneNumber | mobileNumber |
| offer.startDate | dateOfJoining |
| offer.department | department |
| offer.jobTitle | designation |
| jobRequisition.hiringManagerId | reportingManagerId |
| offer.location | workLocation |
| offer.compensation | (mapped to compensation form) |

### Onboarding Approval

When HR approves onboarding:
1. Employee record created
2. User account created
3. **Candidate record updated**:
   - `convertedToEmployeeId` set
   - `convertedAt` timestamp
4. Job requisition `positionsFilled` incremented
5. Salary structure created (if new employee)
6. Leave balances initialized

## Interview Scheduling

### Features
- Conflict detection (interviewer availability)
- Multiple interviewers (panel interviews)
- Multiple modes: In-person, Video, Telephonic
- Calendar integration (Google Meet, Zoom links)
- Automated email notifications
- Rescheduling with reason tracking
- No-show tracking

### Scheduling Rules
- Cannot schedule if interviewer has conflict
- Must complete previous round before next (if mandatory)
- Reschedule count tracked (max 3 recommended)

## Decision Engine

### Auto-Scoring
- Weighted average from all feedbacks
- Configurable passing score per round
- Overall candidate score (0-100)

### Decision States
- **Move to Next Round**: All mandatory rounds completed, passing score
- **Reject**: Failing score or negative recommendation
- **Hold**: Mixed feedback, needs discussion
- **Select**: All rounds passed, positive feedback

### Conflicting Feedback Detection
- Highlight when interviewers disagree
- Flag for HR/Manager review
- Requires manual decision

## Audit Logging

### Tracked Actions
- Candidate created/updated/status changed
- Interview scheduled/rescheduled/cancelled/completed
- Feedback submitted/updated
- Offer created/approved/sent/accepted/rejected
- Onboarding converted
- Decision made

### Audit Log Fields
- Action type
- Previous value / New value
- Performed by (user + role)
- Timestamp
- IP address (for security)
- Metadata (context data)

## Edge Cases Handled

### No-Show
- Interview marked as `no_show`
- Reason captured
- Can reschedule or reject

### Rescheduling
- Original time stored
- Reschedule count incremented
- Reason required
- Conflict check on new time

### Conflicting Feedback
- Highlighted in dashboard
- Requires HR/Manager review
- Manual decision required

### Offer Expiry
- Automatic expiry check
- Status updated to `expired`
- Candidate can be moved to `on_hold` or `rejected`

### Multiple Offers
- Only one active offer per candidate
- Previous offers archived
- Audit trail maintained

## Security & Compliance

### Data Protection
- Role-based access control
- Interview feedback visible only to authorized roles
- Secure tokens for offer/onboarding links
- Token expiry enforcement

### Audit Trail
- Complete history of all actions
- Immutable logs
- GDPR compliant (data retention policies)

### Indian IT Act Compliance
- Secure data storage
- Access logging
- Data export capabilities

## Scalability Considerations

### Database Indexes
- Candidate: status, jobRequisitionId, assignedRecruiterId
- Interview: candidateId, primaryInterviewerId, scheduledStartTime
- Feedback: interviewId, interviewerId, isSubmitted
- Offer: candidateId, status, offerValidUntil

### Performance
- Pagination on list endpoints
- Efficient queries with proper indexes
- Caching for frequently accessed data (future)

### Future Enhancements
- Email notifications (SMTP integration)
- Calendar sync (Google Calendar API)
- Video interview integration (Zoom/Google Meet API)
- Resume parsing (AI/ML)
- Automated screening questions
- Bulk operations

## Integration Points

### With Existing HRMS Modules

1. **Onboarding Module**
   - Automatic conversion on offer acceptance
   - Data pre-filling
   - Status synchronization

2. **Employee Module**
   - Employee creation on onboarding approval
   - Manager assignment
   - Department mapping

3. **Payroll Module**
   - Salary structure creation
   - Compensation data mapping

4. **Leave Module**
   - Leave balance initialization
   - Leave types assignment

## API Usage Examples

### Create Job Requisition
```typescript
POST /api/interviews/job-requisitions
{
  "jobTitle": "Senior Software Engineer",
  "department": "Engineering",
  "location": "Bangalore",
  "employmentType": "full_time",
  "description": "...",
  "requirements": "...",
  "requiredSkills": ["React", "Node.js"],
  "experienceRange": { "min": 5, "max": 8 },
  "hiringManagerId": "...",
  "interviewRounds": [
    {
      "roundName": "HR Screening",
      "roundOrder": 1,
      "roundType": "hr_screening",
      "requiredInterviewers": 1,
      "evaluationCriteria": [...],
      "isMandatory": true
    }
  ]
}
```

### Schedule Interview
```typescript
POST /api/interviews/interviews
{
  "candidateId": "...",
  "roundName": "Technical Round",
  "roundOrder": 2,
  "roundType": "technical",
  "scheduledStartTime": "2025-02-15T10:00:00Z",
  "scheduledEndTime": "2025-02-15T11:00:00Z",
  "mode": "video",
  "interviewLink": "https://meet.google.com/...",
  "interviewers": ["..."],
  "primaryInterviewerId": "..."
}
```

### Submit Feedback
```typescript
POST /api/interviews/feedback
{
  "interviewId": "...",
  "technicalSkillsRating": 4,
  "problemSolvingRating": 5,
  "communicationRating": 4,
  "cultureFitRating": 5,
  "overallRecommendation": "strong_yes",
  "overallComments": "Excellent candidate...",
  "recommendation": "hire",
  "confidenceLevel": "high"
}
```

### Accept Offer (Public Endpoint)
```typescript
PUT /api/interviews/offers
{
  "token": "secure-token-from-email",
  "candidateResponse": "accepted"
}
```

## Testing Checklist

- [ ] Job requisition creation and updates
- [ ] Candidate application and status transitions
- [ ] Interview scheduling with conflict detection
- [ ] Feedback submission and immutability
- [ ] Offer creation and approval workflow
- [ ] Offer acceptance and automatic onboarding conversion
- [ ] State machine validation
- [ ] Role-based access control
- [ ] Audit logging
- [ ] Edge cases (no-show, reschedule, expiry)

## Future Roadmap

1. **AI/ML Integration**
   - Resume parsing and ranking
   - Automated screening
   - Interview question suggestions

2. **Communication**
   - Email templates
   - SMS notifications
   - WhatsApp integration

3. **Analytics**
   - Time-to-hire metrics
   - Source effectiveness
   - Interviewer performance

4. **Mobile App**
   - Interviewer mobile app
   - Candidate mobile portal

5. **Integrations**
   - LinkedIn integration
   - Job boards (Naukri, Indeed)
   - Background verification services

