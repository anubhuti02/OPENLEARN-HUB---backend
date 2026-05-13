import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import Course from '../models/Course.js';
import User from '../models/User.js';
import Submission from '../models/Submission.js';
import Quiz from '../models/Quiz.js';
import QuestionBank from '../models/QuestionBank.js';
import { predictStudentLevel, getMLStats } from '../services/mlService.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// @desc    Get courses created by logged-in instructor
// @route   GET /api/data/courses/my-courses
router.get('/courses/my-courses', protect, async (req, res) => {
  if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  try {
    const courses = await Course.find({ instructor: req.user._id });
    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// MULTER SETUP
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/notes';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'), false);
  }
});

// --- NOTES ACTIONS ---

// @desc    Upload note to course
router.post('/courses/:id/notes', protect, upload.single('note'), async (req, res) => {
  if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    
    // Check ownership
    if (course.instructor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to modify this course' });
    }

    const newNote = {
      title: req.body.title || req.file.originalname,
      filename: req.file.filename,
      path: `/uploads/notes/${req.file.filename}`
    };

    course.notes.push(newNote);
    await course.save();
    res.status(201).json(newNote);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Delete note from course
router.delete('/courses/:courseId/notes/:noteId', protect, async (req, res) => {
  if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  try {
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ message: 'Course not found' });

    const noteIndex = course.notes.findIndex(n => n._id.toString() === req.params.noteId);
    if (noteIndex === -1) return res.status(404).json({ message: 'Note not found' });

    // Remove file from disk
    const note = course.notes[noteIndex];
    const relativePath = note.path.startsWith('/') ? note.path.substring(1) : note.path;
    const filePath = path.join(process.cwd(), relativePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    course.notes.splice(noteIndex, 1);
    await course.save();
    res.json({ message: 'Note deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- STUDENT ACTIONS ---

// @desc    Enroll in a course
router.post('/courses/:id/enroll', protect, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found' });

    const user = await User.findById(req.user._id);
    // Correctly check if already enrolled using .some() and .toString()
    if (user.enrolledCourses.some(eId => eId.toString() === course._id.toString())) {
      return res.status(400).json({ message: 'Already enrolled' });
    }

    user.enrolledCourses.push(course._id);
    await user.save();

    course.students += 1;
    // Also add student to enrolledStudents array!
    if (!course.enrolledStudents) {
      course.enrolledStudents = [];
    }
    if (!course.enrolledStudents.some(id => id.toString() === user._id.toString())) {
      course.enrolledStudents.push(user._id);
    }
    await course.save();

    res.json({ message: 'Enrolled successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- DASHBOARD DATA ---

// @desc    Get student dashboard data
router.get('/student', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('enrolledCourses');
    const submissions = await Submission.find({ student: req.user._id })
      .populate('quiz', 'title')
      .sort({ createdAt: 1 }); // Sort by date ascending for trend analysis

    const quizScores = submissions.map(s => (s.score / s.totalQuestions) * 100);
    const avgScore = quizScores.length > 0 ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length : 0;
    const avgTime = submissions.length > 0 ? submissions.reduce((acc, s) => acc + (s.timeTaken || 0), 0) / submissions.length : 0;
    
    // Random Forest Prediction
    // Features: [avg_score_pct, attempts, avg_accuracy_pct, avg_time]
    const predictedLevel = predictStudentLevel([avgScore, submissions.length, avgScore, avgTime]);

    // Recommendation logic
    let recommendation = "Keep practicing basic concepts to build a strong foundation.";
    if (predictedLevel === 1) {
      recommendation = "You're doing well! Try some medium-level quizzes to challenge yourself.";
    } else if (predictedLevel === 2) {
      recommendation = "Excellent work! You're ready for advanced challenges and real-world projects.";
    }

    res.json({
      enrolled: user.enrolledCourses.map(c => ({ 
        _id: c._id, 
        title: c.title, 
        progress: 0.5,
        notes: c.notes || []
      })),
      quizScores,
      predictedLevel, // 0: Weak, 1: Average, 2: Strong
      recommendation,
      completion: [user.enrolledCourses.length, 10], // Example static total
      recentScores: submissions.slice(-3).map(s => s.score),
      submissions: submissions.map(s => ({
        id: s._id,
        quizTitle: s.quiz?.title || 'Deleted Quiz',
        score: s.score,
        total: s.totalQuestions,
        date: s.createdAt,
        answers: s.answers,
        cluster: s.cluster // Include cluster from K-Means
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get instructor dashboard data
router.get('/instructor', protect, async (req, res) => {
  if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized as instructor' });
  }
  try {
    console.log(`Instructor ${req.user.name} (${req.user._id}) fetching dashboard data...`);

    // 1. Fetch courses created by this instructor
    const courses = await Course.find({ instructor: req.user._id });
    const courseIds = courses.map(c => c._id);
    console.log(`Found ${courses.length} courses for instructor.`);

    // 2. Total Registered Students (All students in the system)
    const allStudents = await User.find({ role: 'student' }).select('name email createdAt');
    const totalStudentsCount = allStudents.length;
    console.log(`Found ${totalStudentsCount} total registered students in the system.`);

    // 3. Active Students (Students who have attempted quizzes in this instructor's courses)
    let activeStudentsCount = 0;
    let activeStudentsList = [];

    if (courseIds.length > 0) {
      // Find unique students who attempted quizzes in this instructor's courses
      // We filter by course IDs to ensure they are students of THIS instructor
      const activeStudentsAgg = await Submission.aggregate([
        { $match: { course: { $in: courseIds } } },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$student',
            lastAttemptDate: { $first: '$createdAt' },
            lastQuizId: { $first: '$quiz' }
          }
        }
      ]);

      const activeStudentIds = activeStudentsAgg.map(a => a._id);
      const activeUsers = await User.find({ _id: { $in: activeStudentIds } }).select('name email');
      const activeQuizzes = await Quiz.find({ _id: { $in: activeStudentsAgg.map(a => a.lastQuizId) } }).select('title');

      activeStudentsList = activeStudentsAgg.map(a => {
        const user = activeUsers.find(u => u._id.toString() === a._id.toString());
        const quiz = activeQuizzes.find(q => q._id.toString() === a.lastQuizId.toString());
        return {
          id: a._id,
          name: user?.name || 'Unknown Student',
          email: user?.email || 'N/A',
          lastQuizTitle: quiz?.title || 'Deleted Quiz',
          lastAttemptDate: a.lastAttemptDate
        };
      });
      activeStudentsCount = activeStudentsList.length;
    }
    console.log(`Found ${activeStudentsCount} active students for this instructor's courses.`);

    // 4. Recent Quiz Activity (Increased limit to 50 for better visibility)
    const submissions = await Submission.find({ course: { $in: courseIds } })
      .populate('student', 'name email')
      .populate('quiz', 'title')
      .populate('course', 'title')
      .sort({ createdAt: -1 })
      .limit(50);

    // Filter submissions for Aryan Sharma specifically to debug (Aryan is student1@openlearn.com)
    const aryanSub = submissions.find(s => s.student?.email === 'student1@openlearn.com');
    if (aryanSub) {
      console.log(`Debug: Found submission for Aryan Sharma in instructor's recent activity.`);
    } else if (courseIds.length > 0) {
      console.log(`Debug: Aryan Sharma has NOT attempted quizzes for this instructor's courses yet.`);
    }

    // ML Cluster Distribution for Instructor (Class-wide)
    const clusterDistribution = [0, 0, 0];
    submissions.forEach(s => {
      const cluster = s.cluster ?? 1;
      if (cluster >= 0 && cluster <= 2) clusterDistribution[cluster]++;
    });

    // 5. ML Stats (Kaggle + Real Data)
    const mlStats = getMLStats();

    const avgScore = submissions.length > 0
      ? submissions.reduce((acc, s) => acc + (s.score / s.totalQuestions) * 100, 0) / submissions.length
      : 0;

    const responseData = {
      courses: courses.map(c => ({
        id: c._id,
        _id: c._id,
        title: c.title,
        category: c.category,
        students: Math.max(c.students || 0, c.enrolledStudents?.length || 0),
        enrolledCount: Math.max(c.students || 0, c.enrolledStudents?.length || 0),
        notes: c.notes || []
      })),
      totalStudentsCount,
      activeStudentsCount,
      allStudents,
      activeStudentsList,
      clusterDistribution,
      mlStats,
      quizPerformance: submissions.length > 0 ? [Math.round(avgScore * 0.8), Math.round(avgScore * 1.1)] : [0, 0],
      studentAttempts: submissions.map(s => ({
        id: s._id,
        studentName: s.student?.name || 'Unknown',
        quizTitle: s.quiz?.title || 'Deleted Quiz',
        courseTitle: s.course?.title || 'N/A',
        score: s.score,
        total: s.totalQuestions,
        date: s.createdAt,
        cluster: s.cluster
      }))
    };

    console.log(`Dashboard data prepared successfully.`);
    res.json(responseData);
  } catch (error) {
    console.error(`Instructor Dashboard API Error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get admin dashboard data
router.get('/admin', protect, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Not authorized as admin' });
  try {
    const userCount = await User.countDocuments();
    const courseCount = await Course.countDocuments();
    
    res.json({
      users: userCount,
      courses: courseCount,
      activeStudents: Math.floor(userCount * 0.3),
      pendingApprovals: ['Data Structures 101', 'AI Basics'],
      systemUsage: [200, 260, 240, 300, 340, 380]
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- COURSE CRUD OPERATIONS ---

// @desc    Create a new course
router.post('/courses', protect, async (req, res) => {
  if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only instructors can create courses' });
  }
  try {
    const { title, desc, category, modules } = req.body;
    const course = await Course.create({ 
      title, 
      desc, 
      category, 
      instructor: req.user._id, 
      modules: modules || [] 
    });
    res.status(201).json(course);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @desc    Get all courses
router.get('/courses', protect, async (req, res) => {
  try {
    const courses = await Course.find().populate('instructor', 'name');
    // Add virtual student count that uses max of students and enrolledStudents length
    const coursesWithCorrectStudents = courses.map(c => ({
      ...c.toObject(),
      students: Math.max(c.students || 0, c.enrolledStudents?.length || 0)
    }));
    res.json(coursesWithCorrectStudents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get single course detail
router.get('/courses/:id', protect, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).populate('instructor', 'name');
    if (!course) return res.status(404).json({ message: 'Course not found' });
    const courseWithCorrectStudents = {
      ...course.toObject(),
      students: Math.max(course.students || 0, course.enrolledStudents?.length || 0)
    };
    res.json(courseWithCorrectStudents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update a course
router.put('/courses/:id', protect, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found' });

    if (course.instructor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this course' });
    }

    const updatedCourse = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedCourse);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @desc    Fix existing course data and add aptitude questions
router.post('/fix-courses', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'instructor') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const aptitudeQuestions = [
      { category: 'Aptitude', topic: 'Math', questionText: 'What is 15% of 200?', options: ['30', '20', '15', '45'], correctAnswer: [0] },
      { category: 'Aptitude', topic: 'Logic', questionText: 'If all A are B, and all B are C, then all A are C. Is this true?', options: ['True', 'False'], correctAnswer: [0] },
      { category: 'Aptitude', topic: 'Verbal', questionText: 'Choose the synonym for "Benevolent":', options: ['Kind', 'Cruel', 'Wealthy', 'Angry'], correctAnswer: [0] },
      { category: 'Aptitude', topic: 'Data Interpretation', questionText: 'A pie chart shows 25% for apples. If total fruits are 200, how many are apples?', options: ['50', '25', '100', '75'], correctAnswer: [0] },
      { category: 'Aptitude', topic: 'Problem Solving', questionText: 'A train travels 60km in 1 hour. How far in 30 minutes?', options: ['30km', '60km', '120km', '15km'], correctAnswer: [0] },
      { category: 'Aptitude', topic: 'Math', questionText: 'What is 25 + 37?', options: ['62', '52', '72', '61'], correctAnswer: [0] },
      { category: 'Aptitude', topic: 'Math', questionText: 'What is the square root of 144?', options: ['12', '11', '13', '14'], correctAnswer: [0] },
      { category: 'Aptitude', topic: 'Logic', questionText: 'If today is Monday, what day will it be in 10 days?', options: ['Thursday', 'Wednesday', 'Friday', 'Tuesday'], correctAnswer: [0] },
      { category: 'Aptitude', topic: 'Math', questionText: 'What is 10 × 12?', options: ['120', '110', '100', '130'], correctAnswer: [0] },
      { category: 'Aptitude', topic: 'Verbal', questionText: 'Choose the antonym for "Fast":', options: ['Slow', 'Quick', 'Rapid', 'Swift'], correctAnswer: [0] }
    ];

    // First: Check and add Aptitude questions
    const existingCount = await QuestionBank.countDocuments({ category: 'Aptitude' });
    let aptitudeFix = { added: 0, alreadyExisted: existingCount };
    if (existingCount === 0) {
      await QuestionBank.insertMany(aptitudeQuestions);
      aptitudeFix.added = aptitudeQuestions.length;
    }

    // For all courses, check if students count matches enrolledStudents
    const courses = await Course.find();
    const courseFixes = [];

    for (const course of courses) {
      // Find all users enrolled in this course
      const enrolledUsers = await User.find({
        enrolledCourses: course._id
      });

      if (!course.enrolledStudents) {
        course.enrolledStudents = [];
      }

      // Add any missing enrolled users
      for (const user of enrolledUsers) {
        if (!course.enrolledStudents.some(id => id.toString() === user._id.toString())) {
          course.enrolledStudents.push(user._id);
        }
      }

      // Update students count to be the max
      const newStudentCount = Math.max(course.students || 0, enrolledUsers.length, course.enrolledStudents.length);

      if (course.students !== newStudentCount || course.enrolledStudents.length !== enrolledUsers.length) {
        course.students = newStudentCount;
        await course.save();
        courseFixes.push({
          course: course.title,
          oldCount: course.students,
          newCount: newStudentCount
        });
      }
    }

    res.json({ 
      message: 'Fixed courses and aptitude questions!', 
      aptitudeFix, 
      courseFixes 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Delete a course
router.delete('/courses/:id', protect, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found' });

    if (course.instructor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this course' });
    }

    await Course.deleteOne({ _id: req.params.id });
    res.json({ message: 'Course removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
