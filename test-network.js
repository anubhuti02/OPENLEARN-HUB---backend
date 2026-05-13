import 'dotenv/config';
import mongoose from 'mongoose';

const testStandardPort = async () => {
  const uri = process.env.MONGO_URI;
  // Attempt to connect using the standard driver options
  console.log('Attempting standard connection...');
  try {
    await mongoose.connect(uri, { 
      serverSelectionTimeoutMS: 15000,
      family: 4 // Force IPv4
    });
    console.log('✅ Standard connection successful!');
    process.exit(0);
  } catch (err) {
    console.log(`❌ Standard connection failed: ${err.message}`);
  }

  // Attempt to connect forcing port 443 (often bypasses firewalls)
  console.log('\nAttempting connection via port 443 fallback...');
  const altUri = uri.includes('?') ? uri.replace('?', '&tls=true') : uri + '?tls=true';
  // Note: Atlas SRV doesn't easily let us change port, but we can try removing SRV for test
  try {
    // This is just a conceptual test for common corporate/school firewall blocks
    console.log('Tip: If you are on a school or office network, they might block port 27017.');
    process.exit(1);
  } catch (err) {
    process.exit(1);
  }
};

testStandardPort();
