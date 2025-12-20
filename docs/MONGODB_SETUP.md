# MongoDB Setup Guide

## Error: `ECONNREFUSED ::1:27017`

This error means MongoDB is not running or not accessible. Follow the steps below to fix it.

## Option 1: Install and Run MongoDB Locally (Recommended for Development)

### Windows Installation:

1. **Download MongoDB Community Server:**
   - Visit: https://www.mongodb.com/try/download/community
   - Select Windows version
   - Download and run the installer

2. **Install MongoDB:**
   - Run the installer
   - Choose "Complete" installation
   - Install as a Windows Service (recommended)
   - Install MongoDB Compass (optional GUI tool)

3. **Start MongoDB Service:**
   ```powershell
   # Check if MongoDB service exists
   Get-Service -Name MongoDB*
   
   # Start MongoDB service
   Start-Service MongoDB
   
   # Or start manually
   mongod --dbpath "C:\data\db"
   ```

4. **Verify MongoDB is Running:**
   ```powershell
   # Test connection
   mongosh
   # Or
   mongo
   ```

5. **Create Data Directory (if needed):**
   ```powershell
   # Create directory for MongoDB data
   mkdir C:\data\db
   ```

### Alternative: Use MongoDB via Docker

If you have Docker installed:

```powershell
# Run MongoDB in Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Verify it's running
docker ps
```

## Option 2: Use MongoDB Atlas (Cloud - Free Tier Available)

1. **Create MongoDB Atlas Account:**
   - Visit: https://www.mongodb.com/cloud/atlas
   - Sign up for free account

2. **Create a Cluster:**
   - Choose FREE tier (M0)
   - Select your preferred region
   - Create cluster

3. **Configure Database Access:**
   - Go to "Database Access"
   - Create a database user
   - Set username and password

4. **Configure Network Access:**
   - Go to "Network Access"
   - Add IP Address: `0.0.0.0/0` (for development) or your specific IP

5. **Get Connection String:**
   - Go to "Database" → "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Replace `<dbname>` with `hr-management`

6. **Update .env.local:**
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hr-management?retryWrites=true&w=majority
   ```

## Option 3: Use MongoDB Compass (GUI Tool)

1. Download MongoDB Compass: https://www.mongodb.com/products/compass
2. Install and open Compass
3. Connect to `mongodb://localhost:27017`
4. Create database `hr-management`

## Verify Setup

After setting up MongoDB, verify the connection:

```powershell
# Test MongoDB connection
mongosh mongodb://localhost:27017/hr-management

# Or test from Node.js
node -e "const mongoose = require('mongoose'); mongoose.connect('mongodb://localhost:27017/hr-management').then(() => console.log('Connected!')).catch(e => console.error(e))"
```

## Run Seed Script

Once MongoDB is running:

```powershell
npm run seed
```

## Troubleshooting

### MongoDB Service Won't Start:
```powershell
# Check MongoDB logs
Get-EventLog -LogName Application -Source MongoDB -Newest 10

# Try starting manually
mongod --dbpath "C:\data\db" --logpath "C:\data\log\mongod.log"
```

### Port 27017 Already in Use:
```powershell
# Find what's using port 27017
netstat -ano | findstr :27017

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

### Connection Refused:
- Make sure MongoDB service is running
- Check firewall settings
- Verify MongoDB is listening on port 27017
- Check MongoDB configuration file

### For MongoDB Atlas:
- Verify your IP is whitelisted
- Check database user credentials
- Verify connection string format
- Check cluster status in Atlas dashboard

## Quick Start (If MongoDB is Already Installed)

```powershell
# Start MongoDB service
Start-Service MongoDB

# Or if running as a process
mongod --dbpath "C:\data\db"

# Then run seed
npm run seed
```

## Environment Variables

Make sure your `.env.local` file has:

```env
MONGODB_URI=mongodb://localhost:27017/hr-management
NEXTAUTH_SECRET=your-random-secret-key-here
NEXTAUTH_URL=http://localhost:3000
```

Generate a random secret for NEXTAUTH_SECRET:
```powershell
# PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```
