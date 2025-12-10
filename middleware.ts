import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Get session token cookie
  const sessionTokenCookie = request.cookies.get('__Secure-authjs.session-token') || 
                             request.cookies.get('authjs.session-token') ||
                             request.cookies.get('next-auth.session-token');

  // Try to get token using getToken() first
  let token = null;
  try {
    token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
    });
    
    // If getToken() fails, fallback to fetching session from API
    if (!token && sessionTokenCookie) {
      const sessionUrl = new URL('/api/auth/session', request.url);
      const sessionResponse = await fetch(sessionUrl.toString(), {
        headers: {
          'Cookie': request.headers.get('cookie') || '',
        },
      });
      
      if (sessionResponse.ok) {
        const session = await sessionResponse.json();
        if (session?.user) {
          token = {
            sub: session.user.id,
            role: session.user.role,
            employeeId: session.user.employeeId,
          };
        }
      }
    }
  } catch (error) {
    // Silently fail and redirect to login if needed
  }

  // If not authenticated and trying to access protected route, redirect to login
  if (!token && path.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If authenticated, check role-based access
  if (token) {
    const role = token.role as string;

    // Admin routes
    if (path.startsWith('/dashboard/admin') && role !== 'super_admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // HR routes
    if (path.startsWith('/dashboard/hr') && role !== 'hr' && role !== 'super_admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Manager routes
    if (
      path.startsWith('/dashboard/manager') &&
      role !== 'manager' &&
      role !== 'super_admin' &&
      role !== 'hr'
    ) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Employee routes
    if (
      path.startsWith('/dashboard/employee') &&
      role !== 'employee' &&
      role !== 'super_admin' &&
      role !== 'hr'
    ) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    // Also match exact /dashboard path
    '/dashboard',
  ],
};
