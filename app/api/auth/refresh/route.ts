/**
 * Token Refresh Endpoint
 * POST /api/auth/refresh
 */

import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/services/auth-service';
import { tokenRefreshRateLimit } from '@/lib/middleware/rate-limit';
import { getDeviceInfo } from '@/lib/utils/device-info';

export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await tokenRefreshRateLimit(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await req.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Refresh token is required',
          code: 'MISSING_TOKEN',
        },
        { status: 400 }
      );
    }

    const deviceInfo = getDeviceInfo(req);
    const result = await authService.refreshToken(refreshToken, deviceInfo);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          code: result.code,
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
      },
    });
  } catch (error: any) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred during token refresh',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

