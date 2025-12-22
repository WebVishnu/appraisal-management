import { NextRequest } from 'next/server';
import { decode } from 'next-auth/jwt';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

/**
 * Helper function to authenticate mobile JWT tokens
 * Can be used in API routes to verify mobile app requests
 */
export async function authenticateMobileToken(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { authenticated: false, error: 'No authorization header' };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Decode and verify the token using NextAuth's decoder
    const decoded = await decode({
      token,
      secret: authOptions.secret!,
      salt: authOptions.secret!, // Use secret as salt for JWT decoding
    });

    if (!decoded) {
      return { authenticated: false, error: 'Invalid token' };
    }

    // Check if token is expired
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return { authenticated: false, error: 'Token expired' };
    }

    // Return user information from token
    return {
      authenticated: true,
      user: {
        id: decoded.sub!,
        email: decoded.email as string,
        role: decoded.role as string,
        employeeId: decoded.employeeId as string | undefined,
      },
    };
  } catch (error) {
    return { authenticated: false, error: 'Token verification failed' };
  }
}

/**
 * Middleware helper that works with both NextAuth sessions and mobile tokens
 * First tries NextAuth session, then falls back to mobile token
 */
export async function authenticateRequest(req: NextRequest) {
  // Try mobile token first (for API routes)
  const mobileAuth = await authenticateMobileToken(req);
  if (mobileAuth.authenticated) {
    return mobileAuth;
  }

  // For web requests, NextAuth session will be handled by the auth() function
  // in the route handlers themselves
  return { authenticated: false, error: 'Not authenticated' };
}

