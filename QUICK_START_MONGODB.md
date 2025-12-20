# Quick Start MongoDB - Fix Connection Error

## Current Error
```
ECONNREFUSED ::1:27017
```
This means MongoDB is **not running** on your computer.

## 🚀 Quick Solutions (Choose One)

### Option 1: Use MongoDB Atlas (Cloud - Easiest) ⭐ RECOMMENDED

**Best for:** Quick setup, no installation needed

1. **Sign up for free MongoDB Atlas:**
   - Go to: https://www.mongodb.com/cloud/atlas/register
   - Create free account (no credit card needed)

2. **Create a Free Cluster:**
   - Click "Build a Database"
   - Choose FREE (M0) tier
   - Select your region (closest to you)
   - Click "Create"

3. **Set up Database Access:**
   - Go to "Database Access" → "Add New Database User"
   - Username: `hr-admin` (or any username)
   - Password: Create a strong password (save it!)
   - Database User Privileges: "Atlas admin"
   - Click "Add User"

4. **Set up Network Access:**
   - Go to "Network Access" → "Add IP Address"
   - Click "Allow Access from Anywhere" (for development)
   - Or add your specific IP address
   - Click "Confirm"

5. **Get Connection String:**
   - Go to "Database" → "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - It looks like: `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

6. **Update your `.env.local` file:**
   ```env
   MONGODB_URI=mongodb+srv://hr-admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/hr-management?retryWrites=true&w=majority
   NEXTAUTH_SECRET=generate-random-string-here
   NEXTAUTH_URL=http://localhost:3000
   ```
   Replace:
   - `hr-admin` with your username
   - `YOUR_PASSWORD` with your password
   - `cluster0.xxxxx.mongodb.net` with your cluster address
   - Add `/hr-management` before the `?` for database name

7. **Run seed script:**
   ```powershell
   npm run seed
   ```

---

### Option 2: Install MongoDB Locally (Windows)

**Best for:** Offline development, full control

1. **Download MongoDB:**
   - Visit: https://www.mongodb.com/try/download/community
   - Version: Latest
   - Platform: Windows
   - Package: MSI
   - Download

2. **Install MongoDB:**
   - Run the installer
   - Choose "Complete" installation
   - ✅ Check "Install MongoDB as a Service"
   - ✅ Check "Install MongoDB Compass" (GUI tool)
   - Click "Install"

3. **Start MongoDB Service:**
   ```powershell
   # Check if service exists
   Get-Service MongoDB*
   
   # Start the service
   Start-Service MongoDB
   
   # Verify it's running
   Get-Service MongoDB*
   ```

4. **Verify Connection:**
   ```powershell
   # Test connection
   mongosh mongodb://localhost:27017
   ```

5. **Run seed script:**
   ```powershell
   npm run seed
   ```

**If service doesn't exist, start manually:**
```powershell
# Create data directory
mkdir C:\data\db -Force

# Start MongoDB manually
mongod --dbpath "C:\data\db"
```

---

### Option 3: Use Docker (If you have Docker installed)

**Best for:** Isolated environment, easy cleanup

1. **Start MongoDB in Docker:**
   ```powershell
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

2. **Verify it's running:**
   ```powershell
   docker ps
   ```

3. **Run seed script:**
   ```powershell
   npm run seed
   ```

**To stop MongoDB:**
```powershell
docker stop mongodb
docker rm mongodb
```

---

## ✅ Verify Setup

After setting up MongoDB, test the connection:

```powershell
# For local MongoDB
mongosh mongodb://localhost:27017/hr-management

# For MongoDB Atlas (replace with your connection string)
mongosh "mongodb+srv://username:password@cluster.mongodb.net/hr-management"
```

## 🔧 Troubleshooting

### MongoDB Service Won't Start
```powershell
# Check logs
Get-EventLog -LogName Application -Source MongoDB -Newest 10

# Try manual start
mongod --dbpath "C:\data\db" --logpath "C:\data\log\mongod.log"
```

### Port 27017 Already in Use
```powershell
# Find what's using the port
netstat -ano | findstr :27017

# Kill the process (replace PID)
taskkill /PID <PID> /F
```

### Connection Still Failing
1. Check firewall settings
2. Verify MongoDB is actually running
3. Check `.env.local` file exists and has correct MONGODB_URI
4. Try using `127.0.0.1` instead of `localhost` in connection string

## 📝 Environment File

Make sure you have `.env.local` in project root:

```env
MONGODB_URI=mongodb://localhost:27017/hr-management
# OR for Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hr-management?retryWrites=true&w=majority

NEXTAUTH_SECRET=your-random-secret-key-here
NEXTAUTH_URL=http://localhost:3000
```

Generate random secret:
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

## 🎯 Recommended: MongoDB Atlas

For quickest setup, use **MongoDB Atlas** (Option 1). It's:
- ✅ Free tier available
- ✅ No installation needed
- ✅ Works immediately
- ✅ Accessible from anywhere
- ✅ Managed backups

Once set up, just update `.env.local` and run `npm run seed`!
