import 'dotenv/config';
import mongoose from 'mongoose';

const passwords = ['02komal', '02komak'];
const baseUri = 'mongodb+srv://chandraanubhuti04:PASSWORD@cluster0.seuoq1i.mongodb.net/openlearnhub?retryWrites=true&w=majority';

const testPasswords = async () => {
  for (const pwd of passwords) {
    const uri = baseUri.replace('PASSWORD', pwd);
    console.log(`Testing password: ${pwd}...`);
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
      console.log(`✅ Success with password: ${pwd}`);
      process.exit(0);
    } catch (err) {
      console.log(`❌ Failed with password: ${pwd} - ${err.message}`);
    }
  }
  console.log('All passwords failed.');
  process.exit(1);
};

testPasswords();
