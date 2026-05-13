import 'dotenv/config';
import mongoose from 'mongoose';
import Course from './models/Course.js';
import User from './models/User.js';

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB!');

    // For all courses, check if students count matches enrolledStudents
    const courses = await Course.find();
    console.log(`Found ${courses.length} courses`);

    for (const course of courses) {
      console.log(`Checking course: ${course.title}`);
      
      // Find all users enrolled in this course
      const enrolledUsers = await User.find({
        enrolledCourses: course._id
      });
      
      console.log(`  Users enrolled in DB: ${enrolledUsers.length}`);
      console.log(`  Course.students: ${course.students}`);
      console.log(`  Course.enrolledStudents: ${course.enrolledStudents?.length || 0}`);

      // Fix:
      if (!course.enrolledStudents) {
        course.enrolledStudents = [];
      }
      
      // Add any missing enrolled users
      for (const user of enrolledUsers) {
        if (!course.enrolledStudents.some(id => id.toString() === user._id.toString())) {
          console.log(`    Adding user ${user.name} to enrolledStudents`);
          course.enrolledStudents.push(user._id);
        }
      }

      // Update students count to be the max
      const newStudentCount = Math.max(course.students || 0, enrolledUsers.length, course.enrolledStudents.length);
      
      if (course.students !== newStudentCount || course.enrolledStudents.length !== enrolledUsers.length) {
        course.students = newStudentCount;
        await course.save();
        console.log(`  Updated course! New count: ${course.students}`);
      } else {
        console.log(`  No changes needed`);
      }
    }

    console.log('\n✅ All courses fixed!');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
