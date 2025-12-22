# HRMS Job Application Widget - Usage Guide

## Overview

The HRMS Job Application Widget allows you to embed a job application form on any website, enabling external candidates to apply for positions without logging into the HRMS dashboard.

## Quick Start

### Step 1: Generate Public Token

1. Log in to the HRMS dashboard as an HR user
2. Navigate to **Hiring Pipeline → Job Requisitions**
3. Find the job requisition you want to share
4. Click the **Link icon** (🔗) in the Actions column
5. If no token exists, it will be generated automatically
6. Copy the token or embed code

### Step 2: Embed on Your Website

Add the following code to your HTML page where you want the application form to appear:

```html
<!-- Widget Container -->
<div id="job-application-widget" 
     data-hrms-job-widget 
     data-job-token="YOUR_JOB_PUBLIC_TOKEN"
     data-api-url="https://your-hrms-domain.com/api/public/jobs">
</div>

<!-- Include CSS -->
<link rel="stylesheet" href="https://your-hrms-domain.com/widget/hrms-widget.css">

<!-- Include JavaScript (must be after container) -->
<script src="https://your-hrms-domain.com/widget/hrms-widget.js"></script>
```

### Step 3: Replace Placeholders

- Replace `YOUR_JOB_PUBLIC_TOKEN` with the actual token from Step 1
- Replace `https://your-hrms-domain.com` with your HRMS instance URL
- If embedding on the same domain as HRMS, use relative paths: `/api/public/jobs` and `/widget/...`

## Configuration Options

### Data Attributes (Auto-initialization)

When using data attributes, the widget automatically initializes:

- `data-hrms-job-widget` - Enables auto-initialization
- `data-job-token` - The public token for the job requisition (required)
- `data-api-url` - Base URL for the API (optional, defaults to `/api/public/jobs`)

### Programmatic Initialization

For more control, initialize the widget programmatically:

```javascript
new JobApplicationWidget({
  token: 'YOUR_JOB_PUBLIC_TOKEN',
  apiUrl: 'https://your-hrms-domain.com/api/public/jobs',
  container: '#job-application-widget' // CSS selector or DOM element
});
```

## Styling Customization

The widget uses CSS classes prefixed with `hrms-` for easy customization:

```css
/* Customize submit button */
.hrms-submit-btn {
  background: #your-brand-color !important;
}

/* Adjust widget width */
.hrms-widget {
  max-width: 800px !important;
}

/* Customize form inputs */
.hrms-form-group input {
  border-color: #your-border-color !important;
}
```

## Features

- ✅ **No Authentication Required** - Candidates can apply directly
- ✅ **File Upload** - Resume upload support (PDF, DOC, DOCX, max 5MB)
- ✅ **Responsive Design** - Works on desktop and mobile
- ✅ **Dark Mode Support** - Automatically adapts to system preferences
- ✅ **Validation** - Client-side validation before submission
- ✅ **Error Handling** - User-friendly error messages

## Form Fields

The widget collects the following information:

**Required Fields:**
- First Name
- Last Name
- Email
- Phone Number
- Resume (file upload)

**Optional Fields:**
- LinkedIn Profile URL
- Portfolio/Website URL
- Current Company
- Years of Experience
- Notice Period (days)

## API Endpoints

The widget communicates with these endpoints:

- `GET /api/public/jobs/{token}` - Fetches job details
- `POST /api/public/jobs/{token}/apply` - Submits application

Both endpoints are publicly accessible (no authentication required).

## Security

- Each job requisition has a unique, secure token (64-character hex string)
- Tokens can be regenerated if compromised
- Public applications can be disabled per job requisition
- Application deadlines can be set
- Duplicate applications (same email) are prevented

## Troubleshooting

### Widget not loading?

1. Check that the JavaScript file is loaded (check browser console)
2. Verify the token is correct
3. Ensure the API URL is accessible
4. Check browser console for error messages

### Form submission fails?

1. Check network tab in browser dev tools
2. Verify file size is under 5MB
3. Ensure all required fields are filled
4. Check that job requisition is still open and accepting applications

### Styling issues?

1. Ensure CSS file is loaded before JavaScript
2. Check for CSS conflicts with your site's styles
3. Use browser dev tools to inspect computed styles
4. Override styles using `!important` if needed

## Support

For issues or questions, contact your HRMS administrator or check the HRMS documentation.

