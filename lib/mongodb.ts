import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hr-management';

if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

interface MongooseCache {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
}

declare global {
    var mongoose: MongooseCache | undefined;
}

// Handle both Node.js (has global) and Edge Runtime (no global)
const getGlobal = () => {
    if (typeof global !== 'undefined') {
        return global;
    }
    // Edge Runtime fallback - use a module-level cache instead
    return undefined;
};

const globalObj = getGlobal();
let cached: MongooseCache = (globalObj as any)?.mongoose || { conn: null, promise: null };

if (globalObj && !(globalObj as any).mongoose) {
    (globalObj as any).mongoose = cached;
}

async function connectDB() {
    console.log('Connecting to MongoDB...');
    console.log(MONGODB_URI);
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
        };
        cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
            console.log('✅ Connected to MongoDB successfully!');
            return mongoose;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e: any) {
        cached.promise = null;
        if (e.message?.includes('ECONNREFUSED') || e.message?.includes('connect')) {
            console.error('\n❌ MongoDB Connection Error:');
            console.error('MongoDB is not running or not accessible.');
            console.error('\nTo fix this:');
            console.error('1. Start MongoDB locally: Start-Service MongoDB (or mongod --dbpath "C:\\data\\db")');
            console.error('2. Use MongoDB Atlas (cloud): Update MONGODB_URI in .env.local');
            console.error('3. Use Docker: docker run -d -p 27017:27017 --name mongodb mongo:latest');
            console.error('\nSee docs/MONGODB_SETUP.md for detailed instructions.\n');
        }
        throw e;
    }

    return cached.conn;
}

export default connectDB;

