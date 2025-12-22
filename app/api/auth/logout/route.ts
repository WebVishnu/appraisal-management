/**
 * Logout Endpoint
 * POST /api/auth/logout
 */

import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/services/auth-service';

export async function POST(req: NextRequest) {
  try {
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

    const result = await authService.logout(refreshToken);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Logout failed',
          code: 'LOGOUT_FAILED',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    console.error('Logout error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred during logout',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

