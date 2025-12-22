# Enterprise Authentication System Architecture

## Overview

This document outlines the complete authentication and authorization system for the HRMS platform, designed for enterprise-scale deployment with security as the primary concern.

## Architecture Diagram

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Web Client   │         │  Mobile Client   │         │   API Gateway   │
│  (Next.js)     │────────▶│  (React Native)  │────────▶│   (Next.js)     │
└────────────────┘         └──────────────────┘         └─────────────────┘
                                                               │
                                                               ▼
                    ┌──────────────────────────────────────────────────┐
                    │         Authentication Service Layer            │
                    │  ┌──────────────┐  ┌─────────────────────────┐ │
                    │  │   Login      │  │   Token Management      │ │
                    │  │   Service    │  │   Service               │ │
                    │  └──────────────┘  └─────────────────────────┘ │
                    │  ┌──────────────┐  ┌─────────────────────────┐ │
                    │  │   RBAC       │  │   Session Management    │ │
                    │  │   Service    │  │   Service               │ │
                    │  └──────────────┘  └─────────────────────────┘ │
                    └──────────────────────────────────────────────────┘
                                                               │
                    ┌──────────────────────────────────────────────────┐
                    │              Data Layer                          │
                    │  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
                    │  │  Users   │  │ Sessions │  │  Audit Logs │ │
                    │  │  Table   │  │  Table   │  │   Table     │ │
                    │  └──────────┘  └──────────┘  └──────────┘ │
                    │  ┌──────────┐  ┌──────────┐                │
                    │  │  Roles   │  │ Password │                │
                    │  │  Table   │  │  Resets  │                │
                    │  └──────────┘  └──────────┘                │
                    └──────────────────────────────────────────────────┘
```

## Authentication Flow

### Standard Login Flow

```
1. User enters email + password
   ↓
2. Client sends POST /api/auth/login
   ↓
3. Server validates:
   - Email format
   - Account exists & active
   - Password matches (bcrypt)
   - Account not locked
   ↓
4. Rate limiting check
   ↓
5. Generate tokens:
   - Access Token (JWT, 15min expiry)
   - Refresh Token (JWT, 30 days expiry)
   ↓
6. Store session in database
   ↓
7. Log successful login
   ↓
8. Return tokens + user data
   ↓
9. Client stores tokens securely
   ↓
10. Redirect to role-based dashboard
```

### Token Refresh Flow

```
1. Access token expires
   ↓
2. Client sends POST /api/auth/refresh
   ↓
3. Server validates refresh token
   ↓
4. Check session still valid
   ↓
5. Generate new access token
   ↓
6. Return new token
```

### Logout Flow

```
1. User clicks logout
   ↓
2. Client sends POST /api/auth/logout
   ↓
3. Server invalidates:
   - Refresh token
   - Session record
   ↓
4. Client clears tokens
   ↓
5. Redirect to login
```

## Security Architecture

### Password Security

- **Hashing**: bcrypt with cost factor 12
- **Minimum Requirements**: 8+ chars, 1 uppercase, 1 lowercase, 1 number
- **Storage**: Never store plaintext passwords
- **Reset**: Time-limited tokens (15 minutes)

### Token Security

- **Algorithm**: HS256 (HMAC-SHA256)
- **Access Token**: Short-lived (15 minutes)
- **Refresh Token**: Long-lived (30 days), stored in database
- **Storage**:
  - Web: HttpOnly cookies (CSRF protected)
  - Mobile: SecureStore (encrypted)
- **Rotation**: Refresh tokens rotated on use

### Rate Limiting

- **Login Attempts**: 5 per 15 minutes per IP
- **Password Reset**: 3 per hour per email
- **Token Refresh**: 10 per minute per token
- **Implementation**: Redis-based rate limiting

### Account Protection

- **Lockout**: After 5 failed attempts, 30-minute lockout
- **Unlock**: Automatic after timeout or admin intervention
- **Monitoring**: Failed attempts logged with IP/device

## Database Schema

### Users Table

```typescript
{
  _id: ObjectId,
  email: String (unique, lowercase, indexed),
  password: String (hashed),
  role: Enum ['super_admin', 'hr', 'manager', 'employee'],
  employeeId: ObjectId (ref: Employee),
  status: Enum ['invited', 'active', 'disabled', 'locked', 'password_reset_required'],
  failedLoginAttempts: Number (default: 0),
  lockedUntil: Date (nullable),
  lastLoginAt: Date (nullable),
  lastLoginIP: String (nullable),
  passwordChangedAt: Date,
  emailVerified: Boolean (default: false),
  createdAt: Date,
  updatedAt: Date
}
```

### Sessions Table

```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User, indexed),
  refreshToken: String (hashed, unique, indexed),
  accessTokenId: String (indexed),
  deviceInfo: {
    userAgent: String,
    ipAddress: String,
    deviceType: String,
    platform: String
  },
  expiresAt: Date (indexed),
  lastActivityAt: Date,
  revoked: Boolean (default: false),
  revokedAt: Date (nullable),
  createdAt: Date
}
```

### Password Resets Table

```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User, indexed),
  token: String (hashed, unique, indexed),
  expiresAt: Date (indexed),
  used: Boolean (default: false),
  usedAt: Date (nullable),
  ipAddress: String,
  createdAt: Date
}
```

### Audit Logs Table

```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User, indexed),
  action: Enum ['login_success', 'login_failure', 'logout', 'password_reset', 'token_refresh', 'account_locked'],
  ipAddress: String,
  userAgent: String,
  deviceInfo: Object,
  metadata: Object,
  success: Boolean,
  errorMessage: String (nullable),
  createdAt: Date (indexed)
}
```

## API Endpoints

### POST /api/auth/login

**Request:**
```json
{
  "email": "user@company.com",
  "password": "SecurePass123",
  "rememberMe": false
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@company.com",
      "role": "employee",
      "name": "John Doe",
      "employeeId": "emp_id"
    },
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token",
    "expiresIn": 900
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Invalid credentials",
  "code": "INVALID_CREDENTIALS",
  "remainingAttempts": 3
}
```

### POST /api/auth/logout

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### POST /api/auth/refresh

**Request:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new_jwt_access_token",
    "expiresIn": 900
  }
}
```

### POST /api/auth/forgot-password

**Request:**
```json
{
  "email": "user@company.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

### POST /api/auth/reset-password

**Request:**
```json
{
  "token": "reset_token",
  "password": "NewSecurePass123",
  "confirmPassword": "NewSecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

### GET /api/auth/verify

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@company.com",
      "role": "employee"
    },
    "valid": true
  }
}
```

## Role-Based Access Control (RBAC)

### Role Hierarchy

```
Super Admin
  ├── Full system access
  ├── User management
  └── System configuration

HR / Admin
  ├── Employee management
  ├── Payroll access
  ├── Reports access
  └── Limited admin functions

Manager
  ├── Team management
  ├── Team reports
  ├── Team attendance
  └── Performance reviews

Employee
  ├── Own profile
  ├── Own attendance
  ├── Own reports
  └── Own payroll
```

### Permission Matrix

| Feature | Super Admin | HR | Manager | Employee |
|---------|------------|----|---------|----------| 
| User Management | ✅ | ✅ | ❌ | ❌ |
| All Employees | ✅ | ✅ | ❌ | ❌ |
| Team Members | ✅ | ✅ | ✅ | ❌ |
| Own Data | ✅ | ✅ | ✅ | ✅ |
| Payroll Admin | ✅ | ✅ | ❌ | ❌ |
| System Config | ✅ | ❌ | ❌ | ❌ |

## Security Best Practices

### 1. Password Requirements
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character
- Not in common password list
- Not similar to email/username

### 2. Token Management
- Short-lived access tokens (15 min)
- Long-lived refresh tokens (30 days)
- Token rotation on refresh
- Secure storage (HttpOnly cookies / SecureStore)
- Token revocation on logout

### 3. Rate Limiting
- Login: 5 attempts per 15 minutes
- Password reset: 3 per hour
- API calls: 100 per minute per user
- Progressive delays on failures

### 4. Account Security
- Account lockout after 5 failures
- Automatic unlock after 30 minutes
- Admin can manually unlock
- Password change required on first login
- Password expiration (90 days, optional)

### 5. Audit & Monitoring
- All authentication events logged
- IP address tracking
- Device fingerprinting
- Failed attempt alerts
- Suspicious activity detection

## Implementation Checklist

- [x] Database schema design
- [x] Password hashing (bcrypt)
- [x] JWT token generation
- [x] Session management
- [x] Rate limiting
- [x] Account lockout
- [x] Password reset flow
- [x] Audit logging
- [x] RBAC middleware
- [x] Token refresh mechanism
- [x] Secure token storage
- [x] CSRF protection (web)
- [x] Input validation
- [x] Error handling
- [x] Mobile authentication support

## Future Enhancements

1. **Multi-Factor Authentication (MFA)**
   - TOTP (Google Authenticator)
   - SMS OTP
   - Email OTP
   - Backup codes

2. **Single Sign-On (SSO)**
   - Google Workspace
   - Microsoft Azure AD
   - SAML 2.0
   - OAuth 2.0

3. **Advanced Security**
   - Device fingerprinting
   - Geolocation verification
   - Biometric authentication
   - Risk-based authentication

4. **Session Management**
   - Active sessions view
   - Remote logout
   - Session timeout warnings
   - Concurrent session limits

