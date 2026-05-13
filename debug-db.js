import 'dotenv/config';
import mongoose from 'mongoose';
import Course from './models/Course.js';
import Quiz from './models/Quiz.js';
import QuestionBank from './models/QuestionBank.js';
import User from './models/User.js';

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB!');

    console.log('\n--- Question Bank categories:', await QuestionBank.distinct('category'));
    console.log('Total question bank count:', await QuestionBank.countDocuments());

    console.log('\n--- Courses:');
    const courses = await Course.find().populate('instructor');
    courses.forEach(c => {
      console.log(`${c.title} (${c.category}): ${c.students} students, enrolledStudents length: ${c.enrolledStudents?.length || 0}`);
    });

    console.log('\n--- Quizzes:');
    const quizzes = await Quiz.find().populate('course');
    quizzes.forEach(q => {
      console.log(`${q.title} (${q.course?.title}): ${q.questions?.length || 0} questions`);
    });

    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
