/**
 * Mobile App APK Download Endpoint
 * GET /api/mobile-app/download
 * Serves the mobile app APK file for download
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import { getUserSession } from '@/lib/auth-helper';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    const session = await getUserSession(req, auth);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only authenticated employees, managers, HR, and admins can download
    const allowedRoles = ['employee', 'manager', 'hr', 'super_admin'];
    if (!allowedRoles.includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Path to the APK file - try multiple possible locations
    const possiblePaths = [
      path.join(process.cwd(), 'public', 'mobile-app.apk'),
      path.join(process.cwd(), 'public', 'hrms-mobile-app.apk'),
      path.join(process.cwd(), 'uploads', 'mobile-app.apk'),
    ];

    let apkPath: string | null = null;
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        apkPath = possiblePath;
        break;
      }
    }

    // Check if file exists
    if (!apkPath) {
      return NextResponse.json(
        { error: 'APK file not found. Please contact administrator.' },
        { status: 404 }
      );
    }

    // Read the file
    const fileBuffer = fs.readFileSync(apkPath);
    const fileStats = fs.statSync(apkPath);

    // Set appropriate headers for APK download
    const headers = new Headers();
    headers.set('Content-Type', 'application/vnd.android.package-archive');
    headers.set('Content-Disposition', `attachment; filename="hrms-mobile-app.apk"`);
    headers.set('Content-Length', fileStats.size.toString());
    headers.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('Error serving APK file:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get APK file info (version, size, etc.)
 * GET /api/mobile-app/info
 * Note: This function is not used in the route, but kept for reference
 */
export async function getAPKInfo() {
  try {
    const apkPath = path.join(process.cwd(), 'public', 'mobile-app.apk');

    if (!fs.existsSync(apkPath)) {
      return null;
    }

    const fileStats = fs.statSync(apkPath);

    // Version is read from package.json in the info route instead
    // to avoid build-time dependency on mobile-app directory
    return {
      exists: true,
      version: '1.0.0', // Default version, actual version read in info route
      size: fileStats.size,
      sizeFormatted: formatFileSize(fileStats.size),
      lastModified: fileStats.mtime.toISOString(),
      fileName: 'hrms-mobile-app.apk',
    };
  } catch (error) {
    console.error('Error getting APK info:', error);
    return null;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

