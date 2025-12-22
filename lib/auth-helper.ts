import { NextRequest } from 'next/server';
import { decode } from 'next-auth/jwt';
import jwt from 'jsonwebtoken';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'fallback-secret-change-in-production';

/**
 * Helper function to authenticate mobile JWT tokens
 * Can be used in API routes to verify mobile app requests
 * Supports both new auth service tokens and legacy NextAuth tokens
 */
export async function authenticateMobileToken(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { authenticated: false, error: 'No authorization header' };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Try to verify with new auth service (JWT_SECRET)
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      // Check if it's an access token (new format)
      if (decoded.type === 'access') {
        return {
          authenticated: true,
          user: {
            id: decoded.sub,
            email: decoded.email,
            role: decoded.role,
            employeeId: decoded.employeeId,
          },
        };
      }
    } catch (jwtError) {
      // If JWT verification fails, try NextAuth decoder (legacy tokens)
    }

    // Fallback to NextAuth decoder for legacy tokens
    const decoded = await decode({
      token,
      secret: authOptions.secret!,
      salt: '', // JWT strategy doesn't use salt, empty string for compatibility
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
 * Helper to get user session (supports both NextAuth and mobile tokens)
 */
export async function getUserSession(req: NextRequest, auth: () => Promise<any>) {
  // Try mobile token first
  const mobileAuth = await authenticateMobileToken(req);
  if (mobileAuth.authenticated && mobileAuth.user) {
    return {
      user: mobileAuth.user,
    };
  }

  // Fall back to NextAuth session
  const session = await auth();
  if (session?.user) {
    return session;
  }

  return null;
}

