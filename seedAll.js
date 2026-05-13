import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import Submission from './models/Submission.js';
import Quiz from './models/Quiz.js';
import Course from './models/Course.js';
import QuestionBank from './models/QuestionBank.js';
import connectDB from './config/db.js';
import { initML, clusterSubmission } from './services/mlService.js';

const studentNames = [
  'Aryan', 'Jaya', 'Vihaan', 'Ananya', 'Aarav', 'Diya', 'Advait', 'Isha', 'Kabir', 'Myra',
  'Arjun', 'Kiara', 'Vivaan', 'Saanvi', 'Rohan', 'Navya', 'Ishaan', 'Aadhya', 'Reyansh', 'Zoya',
  'Aditya', 'Riya', 'Karthik', 'Sia', 'Siddharth', 'Prisha', 'Manav', 'Avni', 'Akshay', 'Kaira',
  'Dev', 'Amara', 'Yash', 'Anika', 'Aaryan', 'Vanya', 'Sameer', 'Shanaya', 'Tushar', 'Inaya',
  'Neil', 'Sara', 'Rahul', 'Nitya', 'Sahil', 'Tara', 'Varun', 'Alisha', 'Pranav', 'Rhea',
  'Abhay', 'Kavya', 'Om', 'Kyra', 'Sanjay', 'Mira', 'Gaurav', 'Nandini', 'Vikas', 'Pooja',
  'Anil', 'Sunita', 'Suresh', 'Anita', 'Ramesh', 'Geeta', 'Mahesh', 'Seema', 'Vinay', 'Meena',
  'Harish', 'Rekha', 'Pankaj', 'Komal', 'Deepak', 'Suman', 'Rajesh', 'Usha', 'Sushil', 'Kiran',
  'Aman', 'Preeti', 'Nitin', 'Shalini', 'Ashish', 'Ritu', 'Sandip', 'Poonam', 'Mukesh', 'Mamta',
  'Vijay', 'Babita', 'Sanjay', 'Lata', 'Ajay', 'Maya', 'Sushant', 'Jaya', 'Vikram', 'Anjali',
  'Sandeep', 'Nisha', 'Sunil', 'Jyoti', 'Raj', 'Shweta', 'Amit', 'Priyanka', 'Vivek', 'Ruchi',
  'Dheeraj', 'Sapna', 'Manoj', 'Kusum', 'Hemant', 'Sarita', 'Kamal', 'Bhawna', 'Pawan', 'Kavita'
];

const quizQuestions = [
  // Programming
  { category: 'Programming', topic: 'JavaScript', questionText: 'What is a closure?', options: ['A function bundled with its lexical environment', 'A type of loop', 'A variable scope', 'An object property'], correctAnswer: [0] },
  { category: 'Programming', topic: 'Python', questionText: 'Which of these is NOT a Python data type?', options: ['List', 'Tuple', 'Dictionary', 'Array'], correctAnswer: [3] },
  { category: 'Programming', topic: 'Data Structures', questionText: 'What is a Stack?', options: ['LIFO data structure', 'FIFO data structure', 'Random access data structure', 'Unordered collection'], correctAnswer: [0] },
  { category: 'Programming', topic: 'Algorithms', questionText: 'Time complexity of Binary Search?', options: ['O(log n)', 'O(n)', 'O(n log n)', 'O(1)'], correctAnswer: [0] },
  { category: 'Programming', topic: 'OOP', questionText: 'What is Polymorphism?', options: ['Ability to take on multiple forms', 'Inheritance of properties', 'Data hiding', 'Encapsulation'], correctAnswer: [0] },
  { category: 'Programming', topic: 'Web', questionText: 'What does HTML stand for?', options: ['HyperText Markup Language', 'Hyperlink and Text Markup Language', 'High-level Text Machine Language', 'Home Tool Markup Language'], correctAnswer: [0] },
  { category: 'Programming', topic: 'Web', questionText: 'Which CSS property controls the text size?', options: ['font-size', 'text-size', 'font-style', 'text-style'], correctAnswer: [0] },
  { category: 'Programming', topic: 'Databases', questionText: 'What is SQL?', options: ['Structured Query Language', 'Standard Question Language', 'Sequential Query Logic', 'Simple Query Logic'], correctAnswer: [0] },
  { category: 'Programming', topic: 'Version Control', questionText: 'What is Git used for?', options: ['Version control', 'Package management', 'Database management', 'Operating system'], correctAnswer: [0] },
  { category: 'Programming', topic: 'Testing', questionText: 'What is Unit Testing?', options: ['Testing individual components', 'Testing entire system', 'Testing user interface', 'Testing database'], correctAnswer: [0] },

  // Aptitude
  { category: 'Aptitude', topic: 'Math', questionText: 'What is 15% of 200?', options: ['30', '20', '15', '45'], correctAnswer: [0] },
  { category: 'Aptitude', topic: 'Logic', questionText: 'If all A are B, and all B are C, then all A are C. Is this true?', options: ['True', 'False'], correctAnswer: [0] },
  { category: 'Aptitude', topic: 'Verbal', questionText: 'Choose the synonym for "Benevolent":', options: ['Kind', 'Cruel', 'Wealthy', 'Angry'], correctAnswer: [0] },
  { category: 'Aptitude', topic: 'Data Interpretation', questionText: 'A pie chart shows 25% for apples. If total fruits are 200, how many are apples?', options: ['50', '25', '100', '75'], correctAnswer: [0] },
  { category: 'Aptitude', topic: 'Problem Solving', questionText: 'A train travels 60km in 1 hour. How far in 30 minutes?', options: ['30km', '60km', '120km', '15km'], correctAnswer: [0] },

  // AI
  { category: 'AI', topic: 'Machine Learning', questionText: 'What is "Supervised Learning"?', options: ['Learning from labeled data', 'Learning from unlabeled data', 'Learning by trial and error', 'Learning from rules'], correctAnswer: [0] },
  { category: 'AI', topic: 'Deep Learning', questionText: 'What is a "Convolutional Neural Network" primarily used for?', options: ['Image recognition', 'Natural language processing', 'Time series analysis', 'Reinforcement learning'], correctAnswer: [0] },
  { category: 'AI', topic: 'NLP', questionText: 'What does NLP stand for?', options: ['Natural Language Processing', 'Neural Language Programming', 'New Linguistic Paradigm', 'Native Language Parser'], correctAnswer: [0] },
  { category: 'AI', topic: 'Ethics', questionText: 'Which is an ethical concern in AI?', options: ['Bias in data', 'High computational cost', 'Lack of interpretability', 'Slow training times'], correctAnswer: [0] },
  { category: 'AI', topic: 'Training', questionText: 'Which are common loss functions?', options: ['Mean Squared Error', 'Cross-Entropy', 'Binary Cross-Entropy', 'Accuracy'], correctAnswer: [0, 1, 2] },
  { category: 'AI', topic: 'Neural Networks', questionText: 'What is a "neuron" in AI?', options: ['A physical cable', 'A mathematical function', 'A hardware chip', 'A database row'], correctAnswer: [1] },
  { category: 'AI', topic: 'History', questionText: 'Which company developed AlphaGo?', options: ['Google DeepMind', 'Facebook AI', 'OpenAI', 'Microsoft'], correctAnswer: [0] },
  { category: 'AI', topic: 'Unsupervised Learning', questionText: 'What is the goal of "Unsupervised Learning"?', options: ['Find hidden patterns', 'Predict a target value', 'Reward an agent', 'Clean data'], correctAnswer: [0] },
  { category: 'AI', topic: 'Computer Vision', questionText: 'Which are types of computer vision tasks?', options: ['Object Detection', 'Image Segmentation', 'Face Recognition', 'Email Filtering'], correctAnswer: [0, 1, 2] },
  { category: 'AI', topic: 'Machine Learning', questionText: 'What is "Overfitting" in ML?', options: ['Model learns noise', 'Model is too simple', 'Model is too small', 'Data is missing'], correctAnswer: [0] },
  
  // Data Science
  { category: 'Data Science', topic: 'Statistics', questionText: 'What is the "Mean"?', options: ['Average value', 'Middle value', 'Most frequent value', 'Range of values'], correctAnswer: [0] },
  { category: 'Data Science', topic: 'Visualization', questionText: 'Which libraries are used for visualization in Python?', options: ['Matplotlib', 'Seaborn', 'Plotly', 'Pandas'], correctAnswer: [0, 1, 2] },
  { category: 'Data Science', topic: 'Data Cleaning', questionText: 'What are common data cleaning tasks?', options: ['Handling missing values', 'Removing duplicates', 'Normalization', 'Data scraping'], correctAnswer: [0, 1, 2] },
  { category: 'Data Science', topic: 'Libraries', questionText: 'Which library is used for numerical operations in Python?', options: ['NumPy', 'Pandas', 'Scikit-learn', 'TensorFlow'], correctAnswer: [0] },
  { category: 'Data Science', topic: 'Big Data', questionText: 'What does "Big Data" refer to?', options: ['Volume', 'Velocity', 'Variety', 'Vulnerability'], correctAnswer: [0, 1, 2] },
  { category: 'Data Science', topic: 'Analysis', questionText: 'What is "Exploratory Data Analysis" (EDA)?', options: ['Understanding data patterns', 'Training models', 'Deploying apps', 'Collecting data'], correctAnswer: [0] },

  // Cloud Computing
  { category: 'Cloud Computing', topic: 'Service Models', questionText: 'What are the three main cloud service models?', options: ['IaaS', 'PaaS', 'SaaS', 'BaaS'], correctAnswer: [0, 1, 2] },
  { category: 'Cloud Computing', topic: 'Providers', questionText: 'Which are major cloud service providers?', options: ['AWS', 'Azure', 'Google Cloud', 'OpenStack'], correctAnswer: [0, 1, 2, 3] },
  { category: 'Cloud Computing', topic: 'Virtualization', questionText: 'What is the purpose of virtualization in cloud?', options: ['Resource sharing', 'Network security', 'Data storage', 'User authentication'], correctAnswer: [0] },
  { category: 'Cloud Computing', topic: 'Deployment', questionText: 'Which are cloud deployment models?', options: ['Public', 'Private', 'Hybrid', 'Static'], correctAnswer: [0, 1, 2] },
  { category: 'Cloud Computing', topic: 'Storage', questionText: 'What is S3 in AWS?', options: ['Simple Storage Service', 'Scalable Storage Solution', 'Secure System Storage', 'Standard Shared Storage'], correctAnswer: [0] },
  { category: 'Cloud Computing', topic: 'Containers', questionText: 'Which tool is used for containerization?', options: ['Docker', 'Kubernetes', 'Jenkins', 'Git'], correctAnswer: [0, 1] },

  // Cyber Security
  { category: 'Cyber Security', topic: 'Basics', questionText: 'What does CIA triad stand for?', options: ['Confidentiality, Integrity, Availability', 'Central Intelligence Agency', 'Control, Identity, Access', 'Core Infrastructure Audit'], correctAnswer: [0] },
  { category: 'Cyber Security', topic: 'Attacks', questionText: 'Which are common cyber attacks?', options: ['Phishing', 'DDoS', 'SQL Injection', 'CSS Styling'], correctAnswer: [0, 1, 2] },
  { category: 'Cyber Security', topic: 'Encryption', questionText: 'What is the purpose of "Hashing"?', options: ['Data Integrity', 'Data Compression', 'Data Transmission', 'Data Backup'], correctAnswer: [0] },
  { category: 'Cyber Security', topic: 'Security Tools', questionText: 'Which are network security tools?', options: ['Firewall', 'Wireshark', 'Nmap', 'Excel'], correctAnswer: [0, 1, 2] },
  { category: 'Cyber Security', topic: 'Authentication', questionText: 'What is Multi-Factor Authentication (MFA)?', options: ['Using two or more factors', 'Using only password', 'Using only fingerprint', 'Using guest access'], correctAnswer: [0] },
  { category: 'Cyber Security', topic: 'Malware', questionText: 'Which are types of malware?', options: ['Virus', 'Worm', 'Ransomware', 'Spyware'], correctAnswer: [0, 1, 2, 3] },
];

const seedAll = async () => {
  try {
    await connectDB();
    await initML(); // Initialize ML service for consistent clustering

    // 1. Clear all relevant collections
    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await Course.deleteMany({});
    await Quiz.deleteMany({});
    await Submission.deleteMany({});
    await QuestionBank.deleteMany({});
    console.log('✅ All relevant collections cleared.');

    // 2. Seed Question Bank
    console.log('🌱 Seeding Question Bank...');
    await QuestionBank.insertMany(quizQuestions);
    console.log('✅ Question Bank seeded!');

    // 3. Create ONE instructor
    console.log('👨‍🏫 Creating instructor...');
    const instructor = await User.create({
      name: 'John Instructor',
      email: 'instructor@example.com',
      password: 'password123', // bcrypt will hash this
      role: 'instructor'
    });
    console.log('✅ Instructor created:', instructor.email);

    // 4. Create 2-3 courses linked to the instructor
    console.log('📚 Creating courses...');
    const coursesData = [
      {
        title: 'Intro to Algorithms',
        desc: 'Master the basics of data structures and algorithms.',
        instructor: instructor._id,
        students: 0,
        modules: [
          { title: 'Big-O Notation', type: 'pdf' },
          { title: 'Sorting Algorithms', type: 'video' }
        ]
      },
      {
        title: 'Web Development Boot Camp',
        desc: 'Full-stack web development from scratch.',
        instructor: instructor._id,
        students: 0,
        modules: [
          { title: 'HTML & CSS', type: 'pdf' },
          { title: 'JavaScript Basics', type: 'video' }
        ]
      },
      {
        title: 'Data Science Fundamentals',
        desc: 'Learn the core concepts of data science and analytics.',
        instructor: instructor._id,
        students: 0,
        modules: [
          { title: 'Statistics Basics', type: 'pdf' },
          { title: 'Python for Data', type: 'video' }
        ]
      }
    ];
    const courses = await Course.insertMany(coursesData);
    console.log(`✅ ${courses.length} courses created.`);

    // 5. Create 5-10 quizzes linked to courses and instructor
    console.log('📝 Creating quizzes...');
    const quizzesToCreate = [];
    const quizTitles = ['JS Basics Quiz', 'Python Aptitude', 'AI Concepts', 'Cloud Security', 'Data Viz Challenge', 'Algorithm Test', 'Web Dev Fundamentals', 'Cyber Attack Quiz', 'DS Statistics'];
    
    for (let i = 0; i < 9; i++) { // Create 9 quizzes
      const randomCourse = courses[Math.floor(Math.random() * courses.length)];
      const randomQuestions = quizQuestions.sort(() => 0.5 - Math.random()).slice(0, 5); // 5 random questions per quiz
      
      quizzesToCreate.push({
        title: quizTitles[i],
        course: randomCourse._id,
        instructor: instructor._id,
        source: 'Manual',
        datasetType: 'None',
        questions: randomQuestions.map(q => ({
          questionText: q.questionText,
          options: q.options,
          correctAnswer: q.correctAnswer,
          topic: q.topic
        }))
      });
    }
    const quizzes = await Quiz.insertMany(quizzesToCreate);
    console.log(`✅ ${quizzes.length} quizzes created.`);

    // 6. Create 100-120 students
    console.log(`👨‍🎓 Seeding ${studentNames.length} students...`);
    const students = [];
    for (let i = 0; i < studentNames.length; i++) {
      const name = studentNames[i];
      const email = `${name.toLowerCase().replace(/\s/g, '')}${i}@example.com`;
      const student = await User.create({
        name,
        email,
        password: '123456',
        role: 'student',
        enrolledCourses: [courses[Math.floor(Math.random() * courses.length)]._id] // Enroll in a random course
      });
      students.push(student);
      if ((i + 1) % 20 === 0) console.log(`✅  Created ${i + 1} students...`);
    }
    console.log(`✅ ${students.length} students created.`);

    // 7. Create 1-3 quiz attempts for each student
    console.log('📊 Creating quiz submissions...');
    for (const student of students) {
      const numAttempts = Math.floor(Math.random() * 3) + 1; // 1 to 3 attempts
      for (let j = 0; j < numAttempts; j++) {
        const quiz = quizzes[Math.floor(Math.random() * quizzes.length)];
        const course = courses.find(c => c._id.equals(quiz.course));

        // Data Quality: Create Realistic Distribution
        const profile = Math.random();
        let scorePct, accuracy, timeTaken;

        if (profile < 0.25) { // 25% Weak
          scorePct = Math.floor(Math.random() * 40); // 0-39%
          accuracy = scorePct + Math.floor(Math.random() * 10); // 0-49%
          timeTaken = Math.floor(Math.random() * 200) + 300; // Slower (300-500s)
        } else if (profile < 0.75) { // 50% Average
          scorePct = Math.floor(Math.random() * 30) + 40; // 40-69%
          accuracy = scorePct + Math.floor(Math.random() * 10); // 40-79%
          timeTaken = Math.floor(Math.random() * 150) + 150; // Average (150-300s)
        } else { // 25% Strong
          scorePct = Math.floor(Math.random() * 25) + 75; // 75-100%
          accuracy = scorePct + Math.floor(Math.random() * 5); // 75-105% (cap at 100)
          if (accuracy > 100) accuracy = 100;
          timeTaken = Math.floor(Math.random() * 100) + 50; // Faster (50-150s)
        }

        const score = Math.floor((scorePct / 100) * quiz.questions.length);
        const totalQuestions = quiz.questions.length;

        // Use ML Service to assign correct cluster
        const cluster = clusterSubmission([accuracy, timeTaken, j + 1]);

        await Submission.create({
          student: student._id,
          quiz: quiz._id,
          course: course._id,
          score,
          totalQuestions,
          timeTaken,
          cluster,
          answers: quiz.questions.map((q, idx) => ({
            questionIndex: idx,
            topic: q.topic || 'General',
            selectedOptions: [0], // Dummy selection
            correctAnswers: q.correctAnswer,
            isCorrect: idx < score // Dummy correctness based on score
          })),
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Random date within last 30 days
        });
      }
    }
    console.log('✅ Quiz submissions created.');

    console.log('🌟 All seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error during seeding: ${error.message}`);
    process.exit(1);
  }
};

seedAll();
