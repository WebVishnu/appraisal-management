/**
 * Enterprise Authentication Service
 * Handles all authentication logic with security best practices
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import connectDB from '../mongodb';
import User from '../models/User';
import Session from '../models/Session';
import PasswordReset from '../models/PasswordReset';
import AuditLog from '../models/AuditLog';
import mongoose from 'mongoose';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60; // 30 days

// Account lockout settings - disabled in development mode
const isDevelopment = process.env.NODE_ENV === 'development';
const enableAccountLockout = process.env.ENABLE_ACCOUNT_LOCKOUT === 'true' || !isDevelopment;
const MAX_LOGIN_ATTEMPTS = enableAccountLockout ? 5 : Number.MAX_SAFE_INTEGER; // Effectively disabled in dev
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes
const BCRYPT_ROUNDS = 12;

interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface DeviceInfo {
  userAgent?: string;
  ipAddress?: string;
  deviceType?: string;
  platform?: string;
}

interface LoginResult {
  success: boolean;
  user?: any;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
  code?: string;
  remainingAttempts?: number;
}

class AuthService {
  /**
   * Authenticate user with email and password
   */
  async login(
    credentials: LoginCredentials,
    deviceInfo: DeviceInfo
  ): Promise<LoginResult> {
    await connectDB();

    const { email, password } = credentials;
    const normalizedEmail = email.toLowerCase().trim();

    // Find user with password field
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      await this.logAuditEvent({
        action: 'login_failure',
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        metadata: { email: normalizedEmail, reason: 'user_not_found' },
        success: false,
        errorMessage: 'Invalid credentials',
      });
      return {
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      };
    }

    // Check if account is locked (only if lockout is enabled)
    if (enableAccountLockout && user.lockedUntil && user.lockedUntil > new Date()) {
      await this.logAuditEvent({
        userId: user._id,
        action: 'login_failure',
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        metadata: { reason: 'account_locked' },
        success: false,
        errorMessage: 'Account is locked',
      });
      return {
        success: false,
        error: 'Account is temporarily locked due to multiple failed login attempts',
        code: 'ACCOUNT_LOCKED',
      };
    }
    
    // In development mode, unlock accounts that were previously locked
    if (!enableAccountLockout && user.status === 'locked') {
      user.status = 'active';
      user.lockedUntil = undefined;
      user.failedLoginAttempts = 0;
      await user.save();
    }

    // Check account status (but remember if it was locked before unlock)
    const wasLockedBeforeUnlock = user.status === 'locked';
    
    if (user.status !== 'active') {
      await this.logAuditEvent({
        userId: user._id,
        action: 'login_failure',
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        metadata: { reason: 'account_inactive', status: user.status },
        success: false,
        errorMessage: `Account is ${user.status}`,
      });
      return {
        success: false,
        error: `Account is ${user.status}`,
        code: 'ACCOUNT_INACTIVE',
      };
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // Increment failed attempts (only if lockout is enabled)
      if (enableAccountLockout) {
        user.failedLoginAttempts += 1;

        // Lock account if max attempts reached
        if (user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
          user.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION);
          user.status = 'locked';
          await this.logAuditEvent({
            userId: user._id,
            action: 'account_locked',
            ipAddress: deviceInfo.ipAddress,
            userAgent: deviceInfo.userAgent,
            metadata: { failedAttempts: user.failedLoginAttempts },
            success: true,
          });
        }

        await user.save();
      } else {
        // In development, just log the failed attempt without locking
        if (isDevelopment) {
          console.log('⚠️  Account lockout disabled in development mode');
        }
      }

      await this.logAuditEvent({
        userId: user._id,
        action: 'login_failure',
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        metadata: {
          failedAttempts: enableAccountLockout ? user.failedLoginAttempts : 0,
          remainingAttempts: enableAccountLockout ? MAX_LOGIN_ATTEMPTS - user.failedLoginAttempts : 'unlimited',
        },
        success: false,
        errorMessage: 'Invalid password',
      });

      return {
        success: false,
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
        remainingAttempts: enableAccountLockout ? Math.max(0, MAX_LOGIN_ATTEMPTS - user.failedLoginAttempts) : undefined,
      };
    }

    // Password is valid - reset failed attempts
    // If account was locked before unlock (in dev mode), ensure it's unlocked
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    if (wasLockedBeforeUnlock) {
      user.status = 'active';
    }
    user.lastLoginAt = new Date();
    user.lastLoginIP = deviceInfo.ipAddress;
    await user.save();

    // Generate tokens (include email in payload)
    const tokens = await this.generateTokens(
      user._id.toString(),
      user.email,
      user.role,
      user.employeeId?.toString()
    );

    // Create session
    await this.createSession(
      user._id,
      tokens.refreshToken,
      tokens.accessTokenId,
      deviceInfo,
      credentials.rememberMe || false
    );

    // Get user name if available
    let userName: string | undefined;
    if (user.employeeId) {
      const Employee = (await import('../models/Employee')).default;
      const employee = await Employee.findById(user.employeeId);
      userName = employee?.name;
    }

    // Log successful login
    await this.logAuditEvent({
      userId: user._id,
      action: 'login_success',
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
      deviceInfo: {
        deviceType: deviceInfo.deviceType,
        platform: deviceInfo.platform,
      },
      success: true,
    });

    return {
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        employeeId: user.employeeId?.toString(),
        name: userName,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY,
    };
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    employeeId?: string
  ): Promise<{ accessToken: string; refreshToken: string; accessTokenId: string }> {
    const accessTokenId = crypto.randomBytes(16).toString('hex');
    const refreshTokenId = crypto.randomBytes(32).toString('hex');

    const accessTokenPayload = {
      sub: userId,
      email,
      role,
      employeeId,
      type: 'access',
      jti: accessTokenId,
    };

    const refreshTokenPayload = {
      sub: userId,
      role,
      type: 'refresh',
      jti: refreshTokenId,
    };

    const accessToken = jwt.sign(accessTokenPayload, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = jwt.sign(refreshTokenPayload, JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    });

    // Hash refresh token for storage
    const hashedRefreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');

    return {
      accessToken,
      refreshToken,
      accessTokenId: hashedRefreshToken, // Store hashed version
    };
  }

  /**
   * Create a new session
   */
  private async createSession(
    userId: mongoose.Types.ObjectId,
    refreshToken: string,
    accessTokenId: string,
    deviceInfo: DeviceInfo,
    rememberMe: boolean
  ): Promise<void> {
    const hashedRefreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + (rememberMe ? REFRESH_TOKEN_EXPIRY * 1000 : 7 * 24 * 60 * 60 * 1000));

    await Session.create({
      userId,
      refreshToken: hashedRefreshToken,
      accessTokenId,
      deviceInfo,
      expiresAt,
      lastActivityAt: new Date(),
    });
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string, deviceInfo: DeviceInfo): Promise<LoginResult> {
    await connectDB();

    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;

      if (decoded.type !== 'refresh') {
        return {
          success: false,
          error: 'Invalid token type',
          code: 'INVALID_TOKEN',
        };
      }

      // Hash token to find in database
      const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');

      // Find session
      const session = await Session.findOne({
        refreshToken: hashedToken,
        revoked: false,
        expiresAt: { $gt: new Date() },
      });

      if (!session) {
        return {
          success: false,
          error: 'Invalid or expired refresh token',
          code: 'INVALID_TOKEN',
        };
      }

      // Update last activity
      session.lastActivityAt = new Date();
      await session.save();

      // Get user
      const user = await User.findById(decoded.sub);
      if (!user || user.status !== 'active') {
        return {
          success: false,
          error: 'User not found or inactive',
          code: 'USER_INACTIVE',
        };
      }

      // Generate new access token
      const accessTokenId = crypto.randomBytes(16).toString('hex');
      const accessToken = jwt.sign(
        {
          sub: user._id.toString(),
          role: user.role,
          employeeId: user.employeeId?.toString(),
          type: 'access',
          jti: accessTokenId,
        },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
      );

      // Update session with new access token ID
      session.accessTokenId = crypto.createHash('sha256').update(accessTokenId).digest('hex');
      await session.save();

      // Log token refresh
      await this.logAuditEvent({
        userId: user._id,
        action: 'token_refresh',
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        success: true,
      });

      return {
        success: true,
        accessToken,
        expiresIn: ACCESS_TOKEN_EXPIRY,
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'Invalid or expired refresh token',
        code: 'INVALID_TOKEN',
      };
    }
  }

  /**
   * Logout user - revoke session
   */
  async logout(refreshToken: string): Promise<{ success: boolean; error?: string }> {
    await connectDB();

    try {
      const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');

      const session = await Session.findOne({ refreshToken: hashedToken });
      if (session) {
        session.revoked = true;
        session.revokedAt = new Date();
        await session.save();

        await this.logAuditEvent({
          userId: session.userId,
          action: 'logout',
          success: true,
        });
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Logout failed' };
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string, ipAddress?: string): Promise<{ success: boolean; message: string }> {
    await connectDB();

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // Don't reveal if user exists for security
      return {
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      };
    }

    // Generate reset token
    const resetToken = PasswordReset.generateToken();
    const hashedToken = PasswordReset.hashToken(resetToken);

    // Create password reset record
    await PasswordReset.create({
      userId: user._id,
      token: hashedToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      ipAddress,
    });

    // TODO: Send email with reset link
    // await emailService.sendPasswordResetEmail(user.email, resetToken);

    await this.logAuditEvent({
      userId: user._id,
      action: 'password_reset_request',
      ipAddress,
      success: true,
    });

    return {
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    };
  }

  /**
   * Reset password with token
   */
  async resetPassword(
    token: string,
    newPassword: string,
    ipAddress?: string
  ): Promise<{ success: boolean; error?: string }> {
    await connectDB();

    const hashedToken = PasswordReset.hashToken(token);

    const resetRecord = await PasswordReset.findOne({
      token: hashedToken,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!resetRecord) {
      return {
        success: false,
        error: 'Invalid or expired reset token',
      };
    }

    // Validate password strength
    const passwordValidation = this.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return {
        success: false,
        error: passwordValidation.error,
      };
    }

    // Update user password
    const user = await User.findById(resetRecord.userId);
    if (!user) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.password = hashedPassword;
    user.passwordChangedAt = new Date();
    user.failedLoginAttempts = 0;
      user.lockedUntil = undefined;
    if (user.status === 'locked') {
      user.status = 'active';
    }
    await user.save();

    // Mark reset token as used
    resetRecord.used = true;
    resetRecord.usedAt = new Date();
    await resetRecord.save();

    // Revoke all existing sessions
    await Session.updateMany(
      { userId: user._id, revoked: false },
      { revoked: true, revokedAt: new Date() }
    );

    await this.logAuditEvent({
      userId: user._id,
      action: 'password_reset',
      ipAddress,
      success: true,
    });

    return { success: true };
  }

  /**
   * Validate password strength
   */
  private validatePassword(password: string): { valid: boolean; error?: string } {
    if (password.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters long' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one number' };
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one special character' };
    }
    return { valid: true };
  }

  /**
   * Log audit event
   */
  private async logAuditEvent(data: {
    userId?: mongoose.Types.ObjectId;
    action: string;
    ipAddress?: string;
    userAgent?: string;
    deviceInfo?: any;
    metadata?: any;
    success: boolean;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await AuditLog.create(data);
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw - audit logging should not break the flow
    }
  }

  /**
   * Hash password
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string): Promise<{ valid: boolean; payload?: any; error?: string }> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      return { valid: true, payload: decoded };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }
}

export const authService = new AuthService();

