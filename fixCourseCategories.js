import mongoose from 'mongoose';
import Course from './models/Course.js';
import dotenv from 'dotenv';

dotenv.config();

const fixCourseCategories = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find all courses without a category or with empty category
    const coursesWithoutCategory = await Course.find({
      $or: [
        { category: { $exists: false } },
        { category: null },
        { category: '' }
      ]
    });

    console.log(`Found ${coursesWithoutCategory.length} courses without category`);

    // Update each course with appropriate category based on title
    for (const course of coursesWithoutCategory) {
      let category = 'Aptitude'; // default

      // Determine category based on course title
      if (course.title.toLowerCase().includes('python') || 
          course.title.toLowerCase().includes('programming') ||
          course.title.toLowerCase().includes('java') ||
          course.title.toLowerCase().includes('code')) {
        category = 'Programming';
      } else if (course.title.toLowerCase().includes('machine learning') ||
                 course.title.toLowerCase().includes('ml')) {
        category = 'Machine Learning';
      } else if (course.title.toLowerCase().includes('ai') ||
                 course.title.toLowerCase().includes('artificial')) {
        category = 'AI';
      } else if (course.title.toLowerCase().includes('data') ||
                 course.title.toLowerCase().includes('science')) {
        category = 'Data Science';
      } else if (course.title.toLowerCase().includes('cyber') ||
                 course.title.toLowerCase().includes('security')) {
        category = 'Cyber Security';
      }

      await Course.findByIdAndUpdate(course._id, { category });
      console.log(`Updated course "${course.title}" with category: ${category}`);
    }

    console.log('Course categories fixed successfully');
    mongoose.connection.close();
  } catch (error) {
    console.error('Error fixing course categories:', error);
    mongoose.connection.close();
  }
};

fixCourseCategories();
