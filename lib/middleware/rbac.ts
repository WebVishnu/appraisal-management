/**
 * Role-Based Access Control Middleware
 * Protects routes and API endpoints based on user roles
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import connectDB from '../mongodb';
import User from '../models/User';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'fallback-secret-change-in-production';

export type UserRole = 'super_admin' | 'hr' | 'manager' | 'employee';

interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  employeeId?: string;
}

interface RBACConfig {
  allowedRoles?: UserRole[];
  requireEmployeeId?: boolean;
}

/**
 * Extract and verify JWT token from request
 */
export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  try {
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (decoded.type !== 'access') {
      return null;
    }

    // Check if user still exists and is active
    await connectDB();
    const user = await User.findById(decoded.sub);

    if (!user || user.status !== 'active') {
      return null;
    }

    return {
      id: decoded.sub,
      email: decoded.email || user.email,
      role: decoded.role || user.role,
      employeeId: decoded.employeeId || user.employeeId?.toString(),
    };
  } catch (error) {
    return null;
  }
}

/**
 * RBAC Middleware
 * Protects routes based on user roles
 */
export function requireAuth(config: RBACConfig = {}) {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    const user = await getAuthUser(req);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // Check role permissions
    if (config.allowedRoles && !config.allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions',
          code: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    // Check if employee ID is required
    if (config.requireEmployeeId && !user.employeeId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Employee ID required',
          code: 'EMPLOYEE_ID_REQUIRED',
        },
        { status: 403 }
      );
    }

    // Attach user to request (for use in route handlers)
    (req as any).user = user;
    return null; // Allow request to continue
  };
}

/**
 * Role-specific middleware helpers
 */
export const requireSuperAdmin = requireAuth({ allowedRoles: ['super_admin'] });
export const requireHR = requireAuth({ allowedRoles: ['super_admin', 'hr'] });
export const requireManager = requireAuth({ allowedRoles: ['super_admin', 'hr', 'manager'] });
export const requireEmployee = requireAuth({ allowedRoles: ['super_admin', 'hr', 'manager', 'employee'] });
export const requireEmployeeId = requireAuth({ requireEmployeeId: true });

/**
 * Check if user has permission for a specific action
 */
export function hasPermission(userRole: UserRole, requiredRole: UserRole | UserRole[]): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    super_admin: 4,
    hr: 3,
    manager: 2,
    employee: 1,
  };

  const userLevel = roleHierarchy[userRole];
  const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  
  return requiredRoles.some(role => userLevel >= roleHierarchy[role]);
}

/**
 * Get user role from request
 */
export async function getUserRole(req: NextRequest): Promise<UserRole | null> {
  const user = await getAuthUser(req);
  return user?.role || null;
}

