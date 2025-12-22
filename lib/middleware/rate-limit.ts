/**
 * Rate Limiting Middleware
 * Prevents brute force attacks and API abuse
 */

import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;
}

// Check if rate limiting is enabled
// Disabled in development mode unless explicitly enabled via env
const isDevelopment = process.env.NODE_ENV === 'development';
const rateLimitEnabled = process.env.ENABLE_RATE_LIMIT === 'true' || !isDevelopment;

// In-memory store (use Redis in production)
const requestStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(config: RateLimitConfig) {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    // Skip rate limiting in development mode (unless explicitly enabled)
    if (!rateLimitEnabled) {
      if (isDevelopment) {
        console.log('⚠️  Rate limiting disabled in development mode');
      }
      return null; // Allow all requests
    }
    const identifier = getIdentifier(req);
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get or create entry
    let entry = requestStore.get(identifier);

    // Clean up expired entries
    if (entry && entry.resetTime < now) {
      requestStore.delete(identifier);
      entry = undefined;
    }

    if (!entry) {
      entry = {
        count: 1,
        resetTime: now + config.windowMs,
      };
      requestStore.set(identifier, entry);
      return null; // Allow request
    }

    // Increment count
    entry.count += 1;

    if (entry.count > config.maxRequests) {
      return NextResponse.json(
        {
          success: false,
          error: config.message || 'Too many requests, please try again later',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((entry.resetTime - now) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((entry.resetTime - now) / 1000)),
            'X-RateLimit-Limit': String(config.maxRequests),
            'X-RateLimit-Remaining': String(Math.max(0, config.maxRequests - entry.count)),
            'X-RateLimit-Reset': String(entry.resetTime),
          },
        }
      );
    }

    requestStore.set(identifier, entry);
    return null; // Allow request
  };
}

function getIdentifier(req: NextRequest): string {
  // Use IP address + endpoint as identifier
  const ip = req.headers.get('x-forwarded-for') || 
             req.headers.get('x-real-ip') || 
             'unknown';
  const path = req.nextUrl.pathname;
  return `${ip}:${path}`;
}

// Predefined rate limiters
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: 'Too many login attempts. Please try again in 15 minutes.',
});

export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3,
  message: 'Too many password reset requests. Please try again in 1 hour.',
});

export const tokenRefreshRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  message: 'Too many token refresh requests. Please try again later.',
});

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of requestStore.entries()) {
    if (entry.resetTime < now) {
      requestStore.delete(key);
    }
  }
}, 60 * 1000); // Clean up every minute

