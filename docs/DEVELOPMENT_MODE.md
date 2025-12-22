# Development Mode Configuration

## Overview

In development mode, security features like rate limiting and account lockout are **disabled by default** to facilitate easier testing and development.

## How It Works

### Automatic Detection

The system automatically detects development mode based on `NODE_ENV`:

- **Development Mode**: `NODE_ENV=development` (or not set)
  - Rate limiting: **DISABLED**
  - Account lockout: **DISABLED**
  
- **Production Mode**: `NODE_ENV=production`
  - Rate limiting: **ENABLED**
  - Account lockout: **ENABLED**

### Environment Variables

You can override the default behavior with these environment variables:

```env
# Force enable rate limiting (even in development)
ENABLE_RATE_LIMIT=true

# Force enable account lockout (even in development)
ENABLE_ACCOUNT_LOCKOUT=true
```

## Features Disabled in Development

### 1. Rate Limiting

**What's disabled:**
- Login attempt limits (5 per 15 minutes)
- Password reset limits (3 per hour)
- Token refresh limits (10 per minute)

**Why:** Allows unlimited testing without hitting rate limits during development.

**Override:** Set `ENABLE_RATE_LIMIT=true` in `.env`

### 2. Account Lockout

**What's disabled:**
- Failed login attempt tracking
- Account locking after 5 failed attempts
- 30-minute lockout duration

**Why:** Prevents accounts from being locked during testing with wrong passwords.

**Override:** Set `ENABLE_ACCOUNT_LOCKOUT=true` in `.env`

**Note:** Accounts that were previously locked will be automatically unlocked when in development mode.

## Configuration Examples

### Development (Default)
```env
NODE_ENV=development
# Rate limiting and account lockout are automatically disabled
```

### Development with Security Features
```env
NODE_ENV=development
ENABLE_RATE_LIMIT=true
ENABLE_ACCOUNT_LOCKOUT=true
# Security features are enabled even in development
```

### Production (Default)
```env
NODE_ENV=production
# Rate limiting and account lockout are automatically enabled
```

### Production with Security Disabled (Not Recommended)
```env
NODE_ENV=production
ENABLE_RATE_LIMIT=false
ENABLE_ACCOUNT_LOCKOUT=false
# Security features are disabled (use with caution!)
```

## Console Warnings

When security features are disabled in development, you'll see console warnings:

```
⚠️  Rate limiting disabled in development mode
⚠️  Account lockout disabled in development mode
```

These help you know when security is relaxed.

## Best Practices

1. **Always use production mode in production**
   ```env
   NODE_ENV=production
   ```

2. **Test security features before deploying**
   - Enable them in development occasionally
   - Test rate limiting behavior
   - Test account lockout behavior

3. **Don't disable security in production**
   - Never set `ENABLE_RATE_LIMIT=false` in production
   - Never set `ENABLE_ACCOUNT_LOCKOUT=false` in production

4. **Use environment-specific configs**
   - `.env.development` for local development
   - `.env.production` for production
   - Never commit `.env` files to version control

## Security Considerations

⚠️ **Important:** Development mode disables important security features. Always:

- Use production mode in production environments
- Test with security features enabled before deploying
- Never commit production credentials
- Use strong secrets even in development

## Troubleshooting

### Rate limiting still active in development?
- Check `NODE_ENV` is set to `development`
- Check `ENABLE_RATE_LIMIT` is not set to `true`
- Restart the server after changing environment variables

### Account still locked in development?
- Check `NODE_ENV` is set to `development`
- Check `ENABLE_ACCOUNT_LOCKOUT` is not set to `true`
- Accounts are automatically unlocked when entering development mode
- Restart the server after changing environment variables

