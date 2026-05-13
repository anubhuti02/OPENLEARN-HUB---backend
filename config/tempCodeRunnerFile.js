import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 15000, 
      connectTimeoutMS: 15000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    
    if (error.message.includes('ECONNREFUSED') || error.message.includes('timeout')) {
      console.log('💡 Tip: Your IP is probably not whitelisted in Atlas.');
    } else if (error.message.includes('Authentication failed')) {
      console.log('💡 Tip: Your password in .env is incorrect.');
    }
    
    throw error; // Propagate error to prevent server start
  }
};

export default connectDB;