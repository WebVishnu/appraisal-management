# HRMS Job Application Widget

An embeddable JavaScript widget that allows external candidates to apply for job positions without logging into the HRMS dashboard.

## Features

- ✅ No authentication required for candidates
- ✅ Lightweight and fast
- ✅ Responsive design (mobile-friendly)
- ✅ Resume upload support
- ✅ Easy to embed on any website
- ✅ Dark mode support

## Quick Start

### Option 1: Direct Script Include (Recommended)

Add the widget to your HTML page:

```html
<!-- Include CSS -->
<link rel="stylesheet" href="https://your-hrms-domain.com/widget/hrms-widget.css">

<!-- Add container where widget should appear -->
<div id="job-application-widget" 
     data-hrms-job-widget 
     data-job-token="YOUR_JOB_PUBLIC_TOKEN"
     data-api-url="https://your-hrms-domain.com/api/public/jobs">
</div>

<!-- Include JavaScript (must be after container) -->
<script src="https://your-hrms-domain.com/widget/hrms-widget.js"></script>
```

### Option 2: Programmatic Initialization

```html
<!-- Include CSS -->
<link rel="stylesheet" href="https://your-hrms-domain.com/widget/hrms-widget.css">

<!-- Add container -->
<div id="job-application-widget"></div>

<!-- Include JavaScript -->
<script src="https://your-hrms-domain.com/widget/hrms-widget.js"></script>

<script>
  new JobApplicationWidget({
    token: 'YOUR_JOB_PUBLIC_TOKEN',
    apiUrl: 'https://your-hrms-domain.com/api/public/jobs',
    container: '#job-application-widget'
  });
</script>
```

## Configuration

### Parameters

- `token` (required): The public token for the job requisition (obtained from HR dashboard)
- `apiUrl` (optional): Base URL for the API (defaults to `/api/public/jobs` on current domain)
- `container` (required): CSS selector or DOM element where widget should render

### Getting the Job Token

1. Log in to HRMS dashboard as HR user
2. Go to Hiring Pipeline → Job Requisitions
3. Click on a job requisition
4. Click "Generate Public Link" or "Copy Public Token"
5. Use the token in the widget

## Customization

The widget uses CSS classes prefixed with `hrms-` so you can override styles:

```css
/* Override submit button color */
.hrms-submit-btn {
  background: #your-color !important;
}

/* Override widget width */
.hrms-widget {
  max-width: 800px !important;
}
```

## API Requirements

The widget expects the following API endpoints:

- `GET /api/public/jobs/{token}` - Get job details
- `POST /api/public/jobs/{token}/apply` - Submit application

Both endpoints should be publicly accessible (no authentication required).

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

MIT

