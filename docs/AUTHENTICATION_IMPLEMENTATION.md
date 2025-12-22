# Authentication System Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing and using the enterprise authentication system.

## Setup

### 1. Environment Variables

Add to `.env.local`:

```env
NEXTAUTH_SECRET=your-secret-key-here-min-32-chars
JWT_SECRET=your-jwt-secret-key-here-min-32-chars
MONGODB_URI=your-mongodb-connection-string
```

### 2. Database Migration

The system uses the following models:
- `User` (enhanced with security fields)
- `Session` (new)
- `PasswordReset` (new)
- `AuditLog` (new)

Run your application to auto-create these collections, or use a migration script.

### 3. Install Dependencies

```bash
npm install jsonwebtoken @types/jsonwebtoken
```

## Usage Examples

### Web Login (Next.js)

```typescript
// app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe: false }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Login failed');
        return;
      }

      // Store tokens securely
      // For web: Use HttpOnly cookies (recommended) or localStorage
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
```

### Protected API Route

```typescript
// app/api/protected/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/rbac';

export async function GET(req: NextRequest) {
  // Apply authentication middleware
  const authResponse = await requireAuth()(req);
  if (authResponse) {
    return authResponse; // Unauthorized
  }

  // Get user from request (attached by middleware)
  const user = (req as any).user;

  return NextResponse.json({
    success: true,
    data: {
      message: `Hello ${user.email}`,
      role: user.role,
    },
  });
}
```

### Role-Based Protected Route

```typescript
// app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireHR } from '@/lib/middleware/rbac';

export async function GET(req: NextRequest) {
  // Only HR and Super Admin can access
  const authResponse = await requireHR(req);
  if (authResponse) {
    return authResponse;
  }

  const user = (req as any).user;
  
  // Your protected logic here
  return NextResponse.json({ success: true, data: [] });
}
```

### Token Refresh

```typescript
// lib/auth-client.ts
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refreshToken');
  
  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (data.success) {
      localStorage.setItem('accessToken', data.data.accessToken);
      return data.data.accessToken;
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
  }

  return null;
}
```

### Logout

```typescript
export async function logout() {
  const refreshToken = localStorage.getItem('refreshToken');
  
  if (refreshToken) {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  }

  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  window.location.href = '/login';
}
```

## Security Best Practices

### 1. Token Storage

**Web (Recommended):**
- Use HttpOnly cookies for refresh tokens
- Use secure, same-site cookies
- Store access tokens in memory or short-lived localStorage

**Mobile:**
- Use Expo SecureStore or React Native Keychain
- Never store tokens in AsyncStorage (unencrypted)

### 2. Token Refresh Strategy

```typescript
// Intercept API calls and refresh token if needed
async function apiCall(url: string, options: RequestInit = {}) {
  let accessToken = localStorage.getItem('accessToken');
  
  // Try the request
  let response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  // If 401, try refreshing token
  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    
    if (newToken) {
      // Retry with new token
      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${newToken}`,
        },
      });
    } else {
      // Refresh failed, redirect to login
      logout();
      throw new Error('Session expired');
    }
  }

  return response;
}
```

### 3. Password Reset Flow

```typescript
// Request password reset
const response = await fetch('/api/auth/forgot-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@company.com' }),
});

// User receives email with reset link
// Link contains: /reset-password?token=xxx

// Reset password
const resetResponse = await fetch('/api/auth/reset-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: 'reset-token-from-url',
    password: 'NewSecurePass123!',
    confirmPassword: 'NewSecurePass123!',
  }),
});
```

## Testing

### Test Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "hr@company.com",
    "password": "password123"
  }'
```

### Test Protected Route

```bash
curl -X GET http://localhost:3000/api/protected \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Monitoring

### View Audit Logs

```typescript
// Get login attempts
const logs = await AuditLog.find({
  action: 'login_failure',
  createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
}).sort({ createdAt: -1 });
```

### Check Active Sessions

```typescript
// Get user's active sessions
const sessions = await Session.find({
  userId: user._id,
  revoked: false,
  expiresAt: { $gt: new Date() },
});
```

## Troubleshooting

### Common Issues

1. **"Invalid token" errors**
   - Check JWT_SECRET matches
   - Verify token hasn't expired
   - Ensure token format is correct

2. **Rate limiting too aggressive**
   - Adjust limits in `rate-limit.ts`
   - Use Redis for distributed rate limiting

3. **Sessions not persisting**
   - Check MongoDB connection
   - Verify session cleanup isn't too aggressive

4. **Password reset not working**
   - Check email service configuration
   - Verify token expiration time
   - Check spam folder

## Production Checklist

- [ ] Change JWT_SECRET to strong random value
- [ ] Enable HTTPS only
- [ ] Configure CORS properly
- [ ] Set up Redis for rate limiting
- [ ] Configure email service for password resets
- [ ] Set up monitoring/alerting for failed logins
- [ ] Enable audit log retention policy
- [ ] Test all authentication flows
- [ ] Set up backup for session data
- [ ] Configure session cleanup job
- [ ] Review and test rate limiting
- [ ] Set up security headers
- [ ] Enable CSRF protection (web)
- [ ] Test password strength requirements
- [ ] Verify account lockout works
- [ ] Test token refresh flow
- [ ] Verify logout invalidates sessions

