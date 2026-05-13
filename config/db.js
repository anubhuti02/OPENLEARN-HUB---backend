import mongoose from "mongoose";
import dns from "node:dns";
import { MongoMemoryServer } from "mongodb-memory-server";

const connectDB = async () => {
  // Avoid Node/OS IPv6 ordering issues with Atlas SRV records
  try {
    dns.setDefaultResultOrder("ipv4first");
  } catch {
    // noop (older Node)
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 15000, 
      connectTimeoutMS: 15000,
      family: 4 // Force IPv4
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    process.env.DB_MODE = "atlas";
    return true;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    
    if (error.message.includes('ECONNREFUSED') || error.message.includes('timeout')) {
      console.log('💡 Tip: Your IP is probably not whitelisted in Atlas.');
    } else if (error.message.includes('Authentication failed')) {
      console.log('💡 Tip: Your password in .env is incorrect.');
    }

    // Dev-friendly fallback: spin up an in-memory MongoDB so the app can run locally
    console.log("⚠️  Falling back to in-memory MongoDB (dev only)");
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000
    });

    process.env.DB_MODE = "memory";
    console.log(`✅ In-memory MongoDB started: ${uri}`);
    return true;
  }
};

export default connectDB;
