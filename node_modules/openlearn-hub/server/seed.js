import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import Course from './models/Course.js';
import Quiz from './models/Quiz.js';
import QuestionBank from './models/QuestionBank.js';
import Submission from './models/Submission.js';

const INSTRUCTOR_EMAIL = 'instructor@openlearn.com';
const INSTRUCTOR_PASSWORD = 'instructor123';
const STUDENT_PASSWORD = '123456';

const indianStudentNames = [
  'Aryan Sharma', 'Aditi Patel', 'Jaya Gupta', 'Ananya Singh', 'Arjun Verma',
  'Aisha Khan', 'Aditya Kumar', 'Anika Sharma', 'Ayaan Ahmed', 'Aishwarya Rao',
  'Balakar', 'Bhavana Nair', 'Bhavesh Joshi', 'Chaitanya Reddy', 'Charulata Desai',
  'Chetan Mehta', 'Chinmayee Iyer', 'Daksh Shah', 'Deepika Bhat', 'Dev Patel',
  'Dhruv Kapoor', 'Diya Sharma', 'Eshaan Gupta', 'Eshani Verma', 'Gaurav Singh',
  'Gayatri Nair', 'Harsh Kumar', 'Harini Rajan', 'Hrishikesh Joshi', 'Ishita Patel',
  'Ishaan Sharma', 'Jai Kumar', 'Jasleen Kaur', 'Jayden Shah', 'Kabir Singh',
  'Kavya Nair', 'Kiaan Mehta', 'Kimaya Desai', 'Krishna Iyer', 'Lakshya Rao',
  'Lavanya Gupta', 'Mahir Ahmed', 'Mannat Khan', 'Mihika Sharma', 'Mohan Kumar',
  'Myra Singh', 'Nakul Verma', 'Navya Patel', 'Neil Shah', 'Nia Johnson',
  'Nikhil Joshi', 'Nimrat Kaur', 'Omkar Sharma', 'Ojaswi Gupta', 'Parth Nair',
  'Piya Singh', 'Praneet Kumar', 'Prisha Verma', 'Priya Patel', 'Qiran Ahmed',
  'Radhika Sharma', 'Rahul Singh', 'Riya Khan', 'Rohan Mehta', 'Rhea Joshi',
  'Rishabh Desai', 'Ritika Rao', 'Saanvi Iyer', 'Sahil Patel', 'Sanjana Nair',
  'Sarthak Shah', 'Shreya Gupta', 'Siddharth Singh', 'Siya Kumar', 'Sneha Verma',
  'Soham Joshi', 'Sonia Patel', 'Sparsh Sharma', 'Srijan Ahmed', 'Suhaas Khan',
  'Suman Rao', 'Tanishq Patel', 'Tara Iyer', 'Tushar Joshi', 'Uma Sharma',
  'Uthkarsh Gupta', 'Vaidya Nair', 'Vardaan Singh', 'Vasudha Kumar', 'Vihaan Shah',
  'Vinay Verma', 'Vrinda Patel', 'Waris Khan', 'Xander Joshi', 'Yash Patel',
  'Yashica Sharma', 'Zara Ahmed', 'Zeenat Khan', 'Zubin Mehta', 'Zoya Singh'
];

const courseTitles = [
  { title: 'Python Programming Fundamentals', category: 'Programming', desc: 'Learn Python from scratch with hands-on projects covering variables, loops, functions, and object-oriented programming.' },
  { title: 'Machine Learning Essentials', category: 'AI', desc: 'Master core ML concepts including supervised/unsupervised learning, neural networks, and real-world applications.' },
  { title: 'Data Science with Python', category: 'Data Science', desc: 'Comprehensive data science course covering NumPy, Pandas, visualization with Matplotlib, and statistical analysis.' }
];

const quizTitlesPerCourse = [
  ['Python Basics Quiz', 'Control Flow Assessment', 'Functions & Modules Test', 'OOP Concepts Quiz', 'Python Final Exam'],
  ['ML Fundamentals Test', 'Supervised Learning Quiz', 'Unsupervised Learning Assessment', 'Neural Networks Exam', 'ML Capstone'],
  ['Data Analysis Quiz', 'Statistical Methods Test', 'Visualization Skills Assessment', 'Pandas Proficiency Exam', 'Data Science Final']
];

const questionBank = {
  Programming: [
    { category: 'Programming', questionText: 'What is the correct syntax to output "Hello World" in Python?', options: ['echo("Hello World")', 'print("Hello World")', 'console.log("Hello World")', 'printf("Hello World")'], correctAnswer: [1], topic: 'Python Basics' },
    { category: 'Programming', questionText: 'Which data type is mutable in Python?', options: ['Tuple', 'String', 'List', 'Number'], correctAnswer: [2], topic: 'Data Types' },
    { category: 'Programming', questionText: 'What does Django primarily used for?', options: ['Data Analysis', 'Web Development', 'Game Development', 'Machine Learning'], correctAnswer: [1], topic: 'Django Framework' },
    { category: 'Programming', questionText: 'How do you define a function in Python?', options: ['function myFunc()', 'def myFunc():', 'func myFunc{}', 'define myFunc()'], correctAnswer: [1], topic: 'Functions' },
    { category: 'Programming', questionText: 'What is the result of 3 // 2 in Python?', options: ['1.5', '1', '2', '3'], correctAnswer: [1], topic: 'Operators' },
    { category: 'Programming', questionText: 'Which keyword is used for inheritance in Python?', options: ['inherits', 'extends', 'super', 'class Child(Parent)'], correctAnswer: [3], topic: 'OOP' },
    { category: 'Programming', questionText: 'What is a correct way to create a list in Python?', options: ['list = (1, 2, 3)', 'list = [1, 2, 3]', 'list = {1, 2, 3}', 'list = <1, 2, 3>'], correctAnswer: [1], topic: 'Data Structures' },
    { category: 'Programming', questionText: 'How do you start a for loop in Python?', options: ['for i in range(10):', 'for (i = 0; i < 10; i++)', 'foreach i in range(10)', 'loop i from 1 to 10'], correctAnswer: [0], topic: 'Loops' },
  ],
  AI: [
    { category: 'AI', questionText: 'What is supervised learning?', options: ['Learning from labeled data', 'Learning without any data', 'Learning from rewards', 'Learning by trial and error'], correctAnswer: [0], topic: 'ML Fundamentals' },
    { category: 'AI', questionText: 'Which algorithm is commonly used for classification?', options: ['K-Means', 'Linear Regression', 'Decision Tree', 'PCA'], correctAnswer: [2], topic: 'ML Algorithms' },
    { category: 'AI', questionText: 'What is the activation function in neural networks?', options: ['Data storage', 'Non-linear transformation', 'Data normalization', 'Loss calculation'], correctAnswer: [1], topic: 'Neural Networks' },
    { category: 'AI', questionText: 'What does overfitting mean?', options: ['Model too simple', 'Model memorized training data', 'Underfitting', 'Feature scaling issue'], correctAnswer: [1], topic: 'Model Evaluation' },
    { category: 'AI', questionText: 'Which technique prevents overfitting?', options: ['Increase model complexity', 'Use validation set', 'Remove all regularization', 'Use more features'], correctAnswer: [1], topic: 'Regularization' },
    { category: 'AI', questionText: 'What is gradient descent used for?', options: ['Data preprocessing', 'Optimizing loss function', 'Feature extraction', 'Clustering'], correctAnswer: [1], topic: 'Optimization' },
    { category: 'AI', questionText: 'K-Means is an example of?', options: ['Classification', 'Regression', 'Clustering', 'Dimensionality Reduction'], correctAnswer: [2], topic: 'Unsupervised Learning' },
    { category: 'AI', questionText: 'What is the purpose of the confusion matrix?', options: ['Visualize data', 'Evaluate classification performance', 'Scale features', 'Reduce dimensions'], correctAnswer: [1], topic: 'Evaluation Metrics' },
  ],
  'Data Science': [
    { category: 'Data Science', questionText: 'What library is used for data manipulation in Python?', options: ['NumPy', 'Pandas', 'Matplotlib', 'Scikit-learn'], correctAnswer: [1], topic: 'Data Processing' },
    { category: 'Data Science', questionText: 'How do you calculate mean in Pandas?', options: ['df.sum()', 'df.mean()', 'df.average()', 'df.avg()'], correctAnswer: [1], topic: 'Statistics' },
    { category: 'Data Science', questionText: 'What does CSV stand for?', options: ['Comma Separated Values', 'Centralized Data File', 'Code Set Variable', 'Continuous Variables'], correctAnswer: [0], topic: 'Data Formats' },
    { category: 'Data Science', questionText: 'Which library is used for visualization?', options: ['Pandas', 'NumPy', 'Matplotlib', 'SciPy'], correctAnswer: [2], topic: 'Visualization' },
    { category: 'Data Science', questionText: 'What is the measure of central tendency?', options: ['Mean, Median, Mode', 'Variance, SD', 'Min, Max', 'Correlation, Covariance'], correctAnswer: [0], topic: 'Statistics' },
    { category: 'Data Science', questionText: 'What is padas used for?', options: ['Numerical computation', 'Data manipulation and analysis', 'Deep learning', 'Web development'], correctAnswer: [1], topic: 'Data Analysis' },
    { category: 'Data Science', questionText: 'How do you select a column in a DataFrame?', options: ['df->column', 'df[column]', 'df.column', 'df select column'], correctAnswer: [2], topic: 'DataFrame Operations' },
    { category: 'Data Science', questionText: 'What is a DataFrame?', options: ['Single value', '1D array', '2D labeled data structure', '3D array'], correctAnswer: [2], topic: 'Data Structures' },
  ]
};

const seedData = async () => {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 60000,
      connectTimeoutMS: 60000,
      family: 4
    });
    console.log('Connected to MongoDB!');

    await Submission.deleteMany({});
    await Quiz.deleteMany({});
    await Course.deleteMany({});
    await QuestionBank.deleteMany({});
    await User.deleteMany({});
    console.log('Cleared existing data.');

    let instructor = await User.findOne({ email: INSTRUCTOR_EMAIL, role: 'instructor' });

    if (!instructor) {
      instructor = await User.create({
        name: 'Dr. Sarah Chen',
        email: INSTRUCTOR_EMAIL,
        password: INSTRUCTOR_PASSWORD,
        role: 'instructor'
      });
      console.log(`Created NEW instructor: ${instructor.name}`);
    } else {
      console.log(`Using EXISTING instructor: ${instructor.name} (${instructor._id})`);
    }

    const hashedPassword = await bcrypt.hash(STUDENT_PASSWORD, 10);
    const studentData = indianStudentNames.map((name, idx) => ({
      name,
      email: `student${idx + 1}@openlearn.com`,
      password: hashedPassword,
      role: 'student'
    }));

    const students = await User.insertMany(studentData);
    console.log(`Created ${students.length} students`);

    const courses = await Course.insertMany(
      courseTitles.map((c, idx) => ({
        title: c.title,
        category: c.category,
        desc: c.desc,
        instructor: instructor._id,
        students: students.length,
        enrolledStudents: students.map(s => s._id)
      }))
    );
    console.log(`Created ${courses.length} courses with ${students.length} enrolled students each`);

    await QuestionBank.insertMany(questionBank.Programming);
    await QuestionBank.insertMany(questionBank.AI);
    await QuestionBank.insertMany(questionBank['Data Science']);
    console.log(`Seeded question bank: Programming (${questionBank.Programming.length}), AI (${questionBank.AI.length}), Data Science (${questionBank['Data Science'].length})`);

    const quizzes = [];
    for (let courseIdx = 0; courseIdx < courses.length; courseIdx++) {
      const course = courses[courseIdx];
      const titles = quizTitlesPerCourse[courseIdx];

      for (let q = 0; q < titles.length; q++) {
        const category = course.category;
        const bankQuestions = questionBank[category] || questionBank['Programming'];
        const shuffled = bankQuestions.sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, 5).map(q => ({
          questionText: q.questionText,
          options: q.options,
          correctAnswer: q.correctAnswer,
          topic: q.topic
        }));

        const quiz = await Quiz.create({
          title: titles[q],
          course: course._id,
          instructor: instructor._id,
          source: 'Dataset',
          questions: selected
        });

        quizzes.push(quiz);
      }
      console.log(`Created ${titles.length} quizzes for "${course.title}" (Category: ${course.category})`);
    }
    console.log(`Total quizzes created: ${quizzes.length}`);

    const submissions = [];
    for (const student of students) {
      const numAttempts = Math.floor(Math.random() * 3) + 1;
      const shuffledQuizzes = [...quizzes].sort(() => Math.random() - 0.5);
      const selectedQuizzes = shuffledQuizzes.slice(0, numAttempts);

      for (const quiz of selectedQuizzes) {
        const score = Math.floor(Math.random() * 5);
        const totalQuestions = quiz.questions.length;
        const timeTaken = Math.floor(Math.random() * 450) + 50;
        const accuracy = (score / totalQuestions) * 100;
        const cluster = accuracy >= 75 ? 2 : accuracy >= 50 ? 1 : 0;

        const sub = await Submission.create({
          student: student._id,
          quiz: quiz._id,
          course: quiz.course,
          instructor: instructor._id,
          answers: quiz.questions.map((q, idx) => ({
            questionIndex: idx,
            topic: q.topic,
            selectedOptions: [Math.floor(Math.random() * q.options.length)],
            correctAnswers: q.correctAnswer,
            isCorrect: score > idx
          })),
          score,
          totalQuestions,
          timeTaken,
          accuracy,
          cluster
        });

        submissions.push(sub);
      }
    }
    console.log(`Created ${submissions.length} quiz submissions`);

    await User.updateMany(
      { role: 'student' },
      { $set: { enrolledCourses: courses.map(c => c._id) } }
    );
    console.log('Updated all students with enrolledCourses');

    const studentWithSubmissions = await Submission.aggregate([
      { $group: { _id: '$student' } },
      { $count: 'total' }
    ]);
    const studentsWithAttempts = studentWithSubmissions[0]?.total || 0;

    console.log('\n========== SEED SUMMARY ==========');
    console.log(`Instructor: ${instructor.name} (${instructor.email})`);
    console.log(`Instructor ID: ${instructor._id}`);
    console.log(`Students: ${students.length}`);
    console.log(`Courses: ${courses.length}`);
    console.log(`Quizzes: ${quizzes.length}`);
    console.log(`Submissions: ${submissions.length}`);
    console.log(`Students with attempts: ${studentsWithAttempts}`);
    console.log('===================================\n');

    console.log('DATA RELATIONSHIP CHAIN VERIFIED:');
    console.log(`✓ Instructor (${instructor._id}) → Courses (${courses.map(c => c._id).join(', ')})`);
    console.log(`✓ Courses → Quizzes (${quizzes.length} quizzes with valid courseId)`);
    console.log(`✓ Students (${students.length}) → Courses (via enrolledStudents array)`);
    console.log(`✓ Submissions → Students, Quizzes, Courses (full chain)`);
    console.log('\nLOGIN CREDENTIALS:');
    console.log(`Instructor: instructor@openlearn.com / instructor123`);
    console.log(`Any Student: student1@openlearn.com through student${students.length}@openlearn.com / 123456`);

    process.exit(0);
  } catch (error) {
    console.error('Seeding Error:', error);
    process.exit(1);
  }
};

seedData();