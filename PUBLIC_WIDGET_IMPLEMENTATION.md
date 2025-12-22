# Public Job Application Widget - Implementation Summary

## Overview

This implementation allows external candidates to apply for job positions through an embeddable widget that can be placed on any website, without requiring login to the HRMS dashboard.

## What Was Implemented

### 1. Database Schema Updates ✅

**File**: `dashboard/lib/models/JobRequisition.ts`

Added fields to JobRequisition model:
- `publicToken` - Unique secure token for public access (64-char hex)
- `allowPublicApplications` - Enable/disable public applications flag
- `publicApplicationDeadline` - Optional deadline for public applications
- Token is excluded from queries by default for security (use `.select('+publicToken')`)

### 2. Public API Endpoints ✅

**File**: `dashboard/app/api/public/jobs/[token]/apply/route.ts`

**GET `/api/public/jobs/{token}`**
- Fetches job details for public viewing
- No authentication required
- Validates token and checks if applications are open
- Returns job title, description, requirements, location, etc.

**POST `/api/public/jobs/{token}/apply`**
- Accepts candidate applications
- No authentication required
- Validates resume upload (base64 or URL)
- Creates candidate record with status 'applied'
- Prevents duplicate applications (same email)

### 3. Token Generation & Management ✅

**File**: `dashboard/lib/utils/interview.ts`

Added function:
- `generatePublicJobToken()` - Generates secure 64-character hex token

**File**: `dashboard/app/api/interviews/job-requisitions/route.ts`

Updated PUT endpoint to support:
- `generatePublicToken: true` - Generate new public token
- `allowPublicApplications: boolean` - Enable/disable public applications
- `publicApplicationDeadline: string` - Set application deadline

### 4. Embeddable Widget Package ✅

**Location**: `dashboard/packages/job-application-widget/`

**Files Created**:
- `src/widget.js` - Main widget JavaScript (self-contained, no dependencies)
- `src/styles.css` - Widget styling (responsive, dark mode support)
- `package.json` - Package metadata
- `README.md` - Package documentation
- `USAGE.md` - Usage guide

**Widget Features**:
- Auto-initialization via data attributes
- Programmatic initialization option
- File upload with base64 conversion
- Form validation
- Error handling
- Success/error messaging
- Responsive design
- Dark mode support

### 5. Widget Distribution Files ✅

**Location**: `dashboard/public/widget/`

**Files**:
- `hrms-widget.js` - Widget JavaScript (accessible at `/widget/hrms-widget.js`)
- `hrms-widget.css` - Widget CSS (accessible at `/widget/hrms-widget.css`)

### 6. HR Dashboard UI ✅

**File**: `dashboard/components/hr/hiring-pipeline/job-requisitions-tab.tsx`

Added features:
- Link icon button in Actions column for each job requisition
- Public Link Dialog showing:
  - Public token (with copy button)
  - Public API URL (with copy button)
  - Widget embed code (with copy button)
  - Usage instructions
- Auto-generates token if doesn't exist
- Toast notifications for copy actions

### 7. Example Demo Page ✅

**File**: `dashboard/public/examples/widget-demo.html`

Complete example page demonstrating:
- Widget embedding
- Setup instructions
- Embed code examples
- Accessible at `/examples/widget-demo.html`

## How to Use

### For HR Users:

1. **Generate Public Token**:
   - Go to Hiring Pipeline → Job Requisitions
   - Click the link icon (🔗) on a job requisition
   - Token is generated automatically if it doesn't exist

2. **Share Widget**:
   - Copy the widget embed code from the dialog
   - Share with your website team
   - They paste it into your website HTML

### For Website Developers:

1. **Get Token**: From HR team (via dashboard)

2. **Embed Widget**:
   ```html
   <div id="job-application-widget" 
        data-hrms-job-widget 
        data-job-token="TOKEN_HERE"
        data-api-url="/api/public/jobs">
   </div>
   <link rel="stylesheet" href="/widget/hrms-widget.css">
   <script src="/widget/hrms-widget.js"></script>
   ```

3. **Customize**: Override CSS classes prefixed with `hrms-`

## Security Features

- ✅ Secure token generation (crypto.randomBytes)
- ✅ Token excluded from default queries
- ✅ Public applications can be disabled per job
- ✅ Application deadlines supported
- ✅ Duplicate application prevention
- ✅ File size validation (5MB max)
- ✅ File type validation (PDF, DOC, DOCX)

## API Flow

```
1. HR generates public token for job requisition
   ↓
2. Widget loads job details via GET /api/public/jobs/{token}
   ↓
3. Candidate fills form and uploads resume
   ↓
4. Widget converts resume to base64
   ↓
5. Widget submits via POST /api/public/jobs/{token}/apply
   ↓
6. API creates Candidate record with status 'applied'
   ↓
7. Candidate appears in HRMS dashboard for review
```

## Testing Checklist

- [x] Job requisition model updated with public fields
- [x] Public API endpoints created (GET and POST)
- [x] Token generation function added
- [x] Job requisitions API updated to handle token generation
- [x] Widget JavaScript created
- [x] Widget CSS created
- [x] Widget files copied to public directory
- [x] HR dashboard UI updated with token management
- [x] Example demo page created
- [x] Documentation created

## Next Steps (Optional Enhancements)

1. **Email Notifications**: Send confirmation email to candidates
2. **Resume Parsing**: Auto-extract candidate information from resume
3. **Multi-language Support**: Support for multiple languages
4. **Custom Fields**: Allow HR to add custom application fields
5. **Analytics**: Track widget views and conversion rates
6. **CAPTCHA**: Add CAPTCHA to prevent spam
7. **Social Login**: Allow candidates to apply with LinkedIn

## Files Modified/Created

### Modified:
- `dashboard/lib/models/JobRequisition.ts`
- `dashboard/lib/utils/interview.ts`
- `dashboard/app/api/interviews/job-requisitions/route.ts`
- `dashboard/components/hr/hiring-pipeline/job-requisitions-tab.tsx`

### Created:
- `dashboard/app/api/public/jobs/[token]/apply/route.ts`
- `dashboard/packages/job-application-widget/src/widget.js`
- `dashboard/packages/job-application-widget/src/styles.css`
- `dashboard/packages/job-application-widget/package.json`
- `dashboard/packages/job-application-widget/README.md`
- `dashboard/packages/job-application-widget/USAGE.md`
- `dashboard/public/widget/hrms-widget.js`
- `dashboard/public/widget/hrms-widget.css`
- `dashboard/public/examples/widget-demo.html`

## Notes

- Widget files are served from `/public/widget/` directory (Next.js serves `/public` at root)
- API endpoints are at `/api/public/jobs/{token}` and `/api/public/jobs/{token}/apply`
- Demo page is accessible at `/examples/widget-demo.html`
- All endpoints are publicly accessible (no authentication)
- Tokens are secure 64-character hexadecimal strings

