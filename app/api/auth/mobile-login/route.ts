import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/services/auth-service';
import { loginRateLimit } from '@/lib/middleware/rate-limit';
import { getDeviceInfo } from '@/lib/utils/device-info';

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = await loginRateLimit(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await req.json();
    const { email, password, rememberMe } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Get device information
    const deviceInfo = getDeviceInfo(req);

    // Use enterprise auth service
    const result = await authService.login(
      { email, password, rememberMe },
      deviceInfo
    );

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          code: result.code,
          remainingAttempts: result.remainingAttempts,
        },
        { status: 401 }
      );
    }

    // Return tokens and user data
    return NextResponse.json({
      token: result.accessToken, // For backward compatibility
      refreshToken: result.refreshToken,
      user: result.user,
      expiresIn: result.expiresIn,
    });
  } catch (error: any) {
    console.error('Mobile login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
