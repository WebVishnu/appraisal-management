import { NextRequest, NextResponse } from 'next/server';
import { decode } from 'next-auth/jwt';
import { authOptions } from '../[...nextauth]/route';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';

/**
 * Verify mobile JWT token and return user session
 * This endpoint allows the mobile app to verify tokens and get fresh user data
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Decode and verify the token
    const decoded = await decode({
      token,
      secret: authOptions.secret!,
      salt: '', // JWT strategy doesn't use salt, empty string for compatibility
    });

    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Check if token is expired
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return NextResponse.json(
        { error: 'Token expired' },
        { status: 401 }
      );
    }

    // Get fresh user data from database
    await connectDB();
    const user = await User.findById(decoded.sub);

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'User not found or inactive' },
        { status: 401 }
      );
    }

    // Get user name if available (check Employee model)
    let userName: string | undefined;
    if (decoded.employeeId) {
      const Employee = (await import('@/lib/models/Employee')).default;
      const employee = await Employee.findById(decoded.employeeId);
      userName = employee?.name;
    }

    // Return session data
    return NextResponse.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        employeeId: user.employeeId?.toString() || undefined,
        name: userName,
      },
      expires: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error: any) {
    console.error('Token verification error:', error);
    return NextResponse.json(
      { error: 'Invalid token' },
      { status: 401 }
    );
  }
}

/**
 * GET endpoint to verify token from Authorization header
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Decode and verify the token
    const decoded = await decode({
      token,
      secret: authOptions.secret!,
      salt: '', // JWT strategy doesn't use salt, empty string for compatibility
    });

    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Check if token is expired
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return NextResponse.json(
        { error: 'Token expired' },
        { status: 401 }
      );
    }

    // Get fresh user data from database
    await connectDB();
    const user = await User.findById(decoded.sub);

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'User not found or inactive' },
        { status: 401 }
      );
    }

    // Get user name if available (check Employee model)
    let userName: string | undefined;
    if (decoded.employeeId) {
      const Employee = (await import('@/lib/models/Employee')).default;
      const employee = await Employee.findById(decoded.employeeId);
      userName = employee?.name;
    }

    // Return session data
    return NextResponse.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        employeeId: user.employeeId?.toString() || undefined,
        name: userName,
      },
      expires: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error: any) {
    console.error('Token verification error:', error);
    return NextResponse.json(
      { error: 'Invalid token' },
      { status: 401 }
    );
  }
}

