import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const path = request.nextUrl.pathname;

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
  matcher: ['/dashboard/:path*'],
};
