import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const method = request.method;
  const url = request.url;
  
  // Debug logging - get all cookies
  const allCookies = request.cookies.getAll();
  const cookieNames = allCookies.map(cookie => cookie.name);
  const nextAuthCookies = cookieNames.filter(name => 
    name.includes('next-auth') || name.includes('authjs')
  );

  console.log('[MIDDLEWARE] Request received:', {
    path,
    method,
    url,
    timestamp: new Date().toISOString(),
    hasCookies: allCookies.length > 0,
    cookieCount: allCookies.length,
    cookieNames,
    nextAuthCookies,
  });

  // Get the session token cookie value for debugging
  const sessionTokenCookie = request.cookies.get('__Secure-authjs.session-token') || 
                             request.cookies.get('authjs.session-token') ||
                             request.cookies.get('next-auth.session-token');
  
  console.log('[MIDDLEWARE] Session token cookie:', {
    found: !!sessionTokenCookie,
    name: sessionTokenCookie?.name || null,
    valueLength: sessionTokenCookie?.value?.length || null,
  });

  // Use getToken() which is Edge Runtime compatible
  // For NextAuth v5, getToken() should handle JWE token decryption
  let token = null;
  try {
    token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
    });
  } catch (error) {
    console.log('[MIDDLEWARE] Error getting token:', error);
    console.log('[MIDDLEWARE] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
    });
  }

  console.log('[MIDDLEWARE] Token check:', {
    hasToken: !!token,
    tokenSub: token?.sub || null,
    tokenRole: token?.role || null,
    tokenExp: token?.exp || null,
    hasSecret: !!process.env.NEXTAUTH_SECRET,
    secretLength: process.env.NEXTAUTH_SECRET?.length || 0,
  });

  // If not authenticated and trying to access protected route, redirect to login
  if (!token && path.startsWith('/dashboard')) {
    console.log('[MIDDLEWARE] No token found, redirecting to login');
    const redirectUrl = new URL('/login', request.url);
    console.log('[MIDDLEWARE] Redirect URL:', redirectUrl.toString());
    return NextResponse.redirect(redirectUrl);
  }

  // If authenticated, check role-based access
  if (token) {
    const role = token.role as string;
    console.log('[MIDDLEWARE] User authenticated, checking role access:', {
      role,
      path,
      userId: token.sub,
    });

    // Admin routes
    if (path.startsWith('/dashboard/admin') && role !== 'super_admin') {
      console.log('[MIDDLEWARE] Access denied to admin route, redirecting to dashboard');
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // HR routes
    if (path.startsWith('/dashboard/hr') && role !== 'hr' && role !== 'super_admin') {
      console.log('[MIDDLEWARE] Access denied to HR route, redirecting to dashboard');
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Manager routes
    if (
      path.startsWith('/dashboard/manager') &&
      role !== 'manager' &&
      role !== 'super_admin' &&
      role !== 'hr'
    ) {
      console.log('[MIDDLEWARE] Access denied to manager route, redirecting to dashboard');
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Employee routes
    if (
      path.startsWith('/dashboard/employee') &&
      role !== 'employee' &&
      role !== 'super_admin' &&
      role !== 'hr'
    ) {
      console.log('[MIDDLEWARE] Access denied to employee route, redirecting to dashboard');
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    console.log('[MIDDLEWARE] Access granted, allowing request to proceed');
  }

  console.log('[MIDDLEWARE] Request allowed, proceeding');
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    // Also match exact /dashboard path
    '/dashboard',
  ],
};
