/**
 * Mobile App APK Info Endpoint
 * GET /api/mobile-app/info
 * Returns information about the available APK file
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../auth/[...nextauth]/route';
import { getUserSession } from '@/lib/auth-helper';
import fs from 'fs';
import path from 'path';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export async function GET(req: NextRequest) {
  try {
    const session = await getUserSession(req, auth);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only authenticated users can check APK info
    const allowedRoles = ['employee', 'manager', 'hr', 'super_admin'];
    if (!allowedRoles.includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Path to the APK file
    const apkPath = path.join(process.cwd(), 'public', 'mobile-app.apk');

    if (!fs.existsSync(apkPath)) {
      return NextResponse.json({
        exists: false,
        message: 'APK file not available',
      });
    }

    const fileStats = fs.statSync(apkPath!);

    // Try to read version from package.json
    let version = '1.0.0';
    try {
      const packageJsonPath = path.join(process.cwd(), '..', 'mobile-app', 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        version = packageJson.version || '1.0.0';
      }
    } catch (error) {
      console.error('Error reading package.json:', error);
    }

    return NextResponse.json({
      exists: true,
      version,
      size: fileStats.size,
      sizeFormatted: formatFileSize(fileStats.size),
      lastModified: fileStats.mtime.toISOString(),
      fileName: 'hrms-mobile-app.apk',
      downloadUrl: '/api/mobile-app/download',
    });
  } catch (error: any) {
    console.error('Error getting APK info:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

