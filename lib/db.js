import dns from 'dns';
import mongoose from 'mongoose';

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  // Ensure DNS servers are set to Google DNS to avoid querySrv ECONNREFUSED in local Windows environment
  try {
    dns.setServers(['8.8.8.8', '8.8.4.4']);
    console.log('[DNS] Forced Google DNS resolvers successfully.');
  } catch (err) {
    console.warn('[DNS Warning] Failed to set Google DNS servers:', err);
  }

  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable');
  }
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
      console.log('MongoDB Connected successfully');
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;

