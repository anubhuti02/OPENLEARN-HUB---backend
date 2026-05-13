import 'dotenv/config';
import mongoose from 'mongoose';

const testConnection = async () => {
  try {
    console.log('Testing connection to:', process.env.MONGO_URI.replace(/:([^@]+)@/, ':****@'));
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('Successfully connected!');
    const admin = mongoose.connection.db.admin();
    const dbs = await admin.listDatabases();
    console.log('Databases:', dbs.databases.map(db => db.name));
    process.exit(0);
  } catch (error) {
    console.error('Connection failed:', error.message);
    process.exit(1);
  }
};

testConnection();
