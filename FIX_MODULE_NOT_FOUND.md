# Fix: Module Not Found - jsonwebtoken

## Issue
```
Module not found: Can't resolve 'jsonwebtoken'
```

## Solution

The `jsonwebtoken` package is already in `package.json` and installed, but Next.js needs to be restarted to recognize it.

### Steps:

1. **Stop the Next.js dev server** (Press `Ctrl+C` in the terminal where it's running)

2. **Clear Next.js cache** (optional but recommended):
   ```bash
   rm -rf .next
   # Or on Windows:
   rmdir /s /q .next
   ```

3. **Restart the dev server**:
   ```bash
   npm run dev
   ```

## Verification

After restarting, the error should be gone. If it persists:

1. Verify package is installed:
   ```bash
   npm list jsonwebtoken
   ```

2. If not installed, install it:
   ```bash
   npm install jsonwebtoken @types/jsonwebtoken
   ```

3. Restart the dev server again

## Why This Happens

Next.js caches modules during compilation. When you add new dependencies:
- The package might be in `package.json` but not yet in `node_modules`
- Next.js might have cached the old state before the package was installed
- A restart forces Next.js to re-scan `node_modules` and rebuild the module graph

## Quick Fix Command

```bash
# Stop server (Ctrl+C), then:
npm run dev
```

That's usually all you need!

