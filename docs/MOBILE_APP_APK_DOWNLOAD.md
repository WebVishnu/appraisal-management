# Mobile App APK Download Feature

This document explains how the mobile app APK download feature works and how to set it up.

## Overview

The HRMS dashboard now includes a feature that allows employees to download the mobile app APK directly from their dashboard. This provides a convenient way to distribute the app without requiring employees to use app stores or external links.

## Features

- ✅ **Secure Download**: Only authenticated users can download the APK
- ✅ **Role-Based Access**: Employees, Managers, HR, and Admins can access
- ✅ **APK Information**: Shows version, size, and last modified date
- ✅ **User-Friendly UI**: Clean card interface on employee dashboard
- ✅ **Installation Instructions**: Built-in guide for Android installation

## Setup Instructions

### Step 1: Build the APK

Follow the guide in `mobile-app/BUILD_APK_GUIDE.md` to build your APK file.

Quick command:
```bash
cd mobile-app
eas build --platform android --profile production
```

### Step 2: Place APK in Public Folder

After building, download the APK and place it in:
```
dashboard/public/mobile-app.apk
```

The system will also check these alternative locations:
- `dashboard/public/hrms-mobile-app.apk`
- `dashboard/uploads/mobile-app.apk`

### Step 3: Verify Setup

1. Start your dashboard server
2. Log in as an employee
3. Navigate to the employee dashboard
4. You should see the "Mobile App" card with download option

## API Endpoints

### GET `/api/mobile-app/info`
Returns information about the available APK:
- Version
- File size
- Last modified date
- Download URL

**Authentication**: Required (Employee, Manager, HR, Admin)

### GET `/api/mobile-app/download`
Serves the APK file for download.

**Authentication**: Required (Employee, Manager, HR, Admin)

**Response**: Binary APK file with appropriate headers

## UI Components

### MobileAppDownloadCard
Located at: `dashboard/components/employee/mobile-app-download-card.tsx`

Features:
- Fetches APK info on load
- Shows version, size, and update date
- Download button with loading state
- Installation instructions
- Error handling for missing APK

### Integration
The card is automatically displayed on the employee dashboard at:
`dashboard/components/employee/employee-dashboard-client.tsx`

## Security

- **Authentication Required**: All endpoints require valid session
- **Role-Based Access**: Only authorized roles can download
- **File Validation**: Checks file existence before serving
- **Secure Headers**: Proper content-type and disposition headers

## Troubleshooting

### APK Not Found
- Ensure APK is in `dashboard/public/mobile-app.apk`
- Check file permissions
- Verify file name matches exactly

### Download Fails
- Check server logs for errors
- Verify authentication is working
- Ensure file size is reasonable (< 100MB recommended)

### Version Not Showing
- Check `mobile-app/package.json` version field
- Verify package.json path is accessible from API route

## Updating the APK

1. Build new APK with updated version
2. Replace `dashboard/public/mobile-app.apk`
3. Update version in `mobile-app/package.json`
4. Increment `versionCode` in `mobile-app/app.json`

## Future Enhancements

Possible improvements:
- Version comparison (notify if update available)
- QR code for easy mobile download
- iOS IPA support
- Download analytics
- Multiple version management

