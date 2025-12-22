/**
 * Reset Password Endpoint
 * POST /api/auth/reset-password
 */

import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/services/auth-service';
import { getDeviceInfo } from '@/lib/utils/device-info';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, password, confirmPassword } = body;

    if (!token || !password || !confirmPassword) {
      return NextResponse.json(
        {
          success: false,
          error: 'Token, password, and confirm password are required',
          code: 'MISSING_FIELDS',
        },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        {
          success: false,
          error: 'Passwords do not match',
          code: 'PASSWORD_MISMATCH',
        },
        { status: 400 }
      );
    }

    const deviceInfo = getDeviceInfo(req);
    const result = await authService.resetPassword(token, password, deviceInfo.ipAddress);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Password reset failed',
          code: 'RESET_FAILED',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully. Please login with your new password.',
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred during password reset',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

