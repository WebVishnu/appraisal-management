/**
 * Device Information Utility
 * Extracts device information from request headers
 */

import { NextRequest } from 'next/server';

export interface DeviceInfo {
  userAgent?: string;
  ipAddress?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  platform?: string;
  browser?: string;
  os?: string;
}

export function getDeviceInfo(req: NextRequest): DeviceInfo {
  const userAgent = req.headers.get('user-agent') || undefined;
  const ipAddress =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    undefined;

  let deviceType: DeviceInfo['deviceType'] = 'unknown';
  let platform: string | undefined;
  let browser: string | undefined;
  let os: string | undefined;

  if (userAgent) {
    // Detect device type
    if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
      deviceType = 'mobile';
    } else if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
      deviceType = 'tablet';
    } else {
      deviceType = 'desktop';
    }

    // Detect OS
    if (/windows/i.test(userAgent)) {
      os = 'Windows';
    } else if (/macintosh|mac os x/i.test(userAgent)) {
      os = 'macOS';
    } else if (/linux/i.test(userAgent)) {
      os = 'Linux';
    } else if (/android/i.test(userAgent)) {
      os = 'Android';
    } else if (/ios|iphone|ipad|ipod/i.test(userAgent)) {
      os = 'iOS';
    }

    // Detect browser
    if (/chrome/i.test(userAgent) && !/edg/i.test(userAgent)) {
      browser = 'Chrome';
    } else if (/firefox/i.test(userAgent)) {
      browser = 'Firefox';
    } else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
      browser = 'Safari';
    } else if (/edg/i.test(userAgent)) {
      browser = 'Edge';
    } else if (/opera|opr/i.test(userAgent)) {
      browser = 'Opera';
    }

    // Detect platform
    if (/mobile|android|iphone/i.test(userAgent)) {
      platform = 'mobile';
    } else {
      platform = 'web';
    }
  }

  return {
    userAgent,
    ipAddress,
    deviceType,
    platform,
    browser,
    os,
  };
}

