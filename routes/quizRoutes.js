import express from 'express';
import axios from 'axios';
import { protect } from '../middleware/authMiddleware.js';
import Quiz from '../models/Quiz.js';
import Course from '../models/Course.js';
import Submission from '../models/Submission.js';
import QuestionBank from '../models/QuestionBank.js';
import CourseProgress from '../models/CourseProgress.js';
import Assignment from '../models/Assignment.js';
import { clusterSubmission } from '../services/mlService.js';

// Helper function to calculate progress (copied from progressRoutes to avoid import issues)
const calculateProgress = async (progress, courseId) => {
  const course = await Course.findById(courseId);
  if (!course) return 0;

  const totalNotes = course.notes?.length || 0;
  const totalQuizzes = await Quiz.countDocuments({ course: courseId });
  const totalAssignments = await Assignment.countDocuments({ courseId });

  const completedNotes = progress.viewedNotes?.length || 0;
  const completedQuizzesCount = progress.completedQuizzes?.length || 0;
  const completedAssignmentsCount = progress.completedAssignments?.length || 0;

  const notesPercent = totalNotes > 0 ? (completedNotes / totalNotes) * 100 : 100;
  const quizPercent = totalQuizzes > 0 ? (completedQuizzesCount / totalQuizzes) * 100 : 100;
  const assignmentPercent = totalAssignments > 0 ? (completedAssignmentsCount / totalAssignments) * 100 : 100;

  const overall = Math.round(
    (0.3 * notesPercent) + 
    (0.4 * quizPercent) + 
    (0.3 * assignmentPercent)
  );

  return Math.min(100, Math.max(0, overall));
};

const router = express.Router();

// Category normalization and synonyms
const normalizeCategory = (category) => {
  const synonyms = {
    'maths': 'mathematics',
    'math': 'mathematics',
    'cn': 'computer networks',
    'os': 'operating systems',
    'cs': 'computer science',
    'ai': 'artificial intelligence',
    'ml': 'machine learning',
    'dl': 'deep learning'
  };

  const normalized = (category || 'general').toLowerCase().trim();
  return synonyms[normalized] || normalized;
};

// Open Trivia DB category mapping
const openTriviaCategories = {
  'general knowledge': 9,
  'general': 9,
  'books': 10,
  'film': 11,
  'music': 12,
  'musicals & theatres': 13,
  'television': 14,
  'video games': 15,
  'board games': 16,
  'science & nature': 17,
  'science': 17,
  'computers': 18,
  'computer science': 18,
  'cs': 18,
  'mathematics': 19,
  'maths': 19,
  'math': 19,
  'mythology': 20,
  'sports': 21,
  'geography': 22,
  'history': 23,
  'politics': 24,
  'art': 25,
  'celebrities': 26,
  'animals': 27,
  'vehicles': 28,
  'comics': 29,
  'gadgets': 30,
  'japanese anime & manga': 31,
  'cartoon & animations': 32
};

// Fetch questions from Open Trivia DB
const fetchFromOpenTriviaDB = async (category, count) => {
  try {
    const triviaCategoryId = openTriviaCategories[category] || 9; // default to general knowledge
    const url = `https://opentdb.com/api.php?amount=${count}&category=${triviaCategoryId}&type=multiple`;
    
    console.log(`Fetching from Open Trivia DB: ${url}`);
    const response = await axios.get(url);
    const data = response.data;
    
    if (data.response_code !== 0) {
      console.log(`Open Trivia DB returned response code: ${data.response_code}`);
      return [];
    }
    
    return data.results.map((item, idx) => {
      const options = [...item.incorrect_answers, item.correct_answer];
      const correctIndex = options.indexOf(item.correct_answer);
      
      return {
        category,
        questionText: item.question,
        options,
        correctAnswer: [correctIndex],
        topic: item.category
      };
    });
  } catch (error) {
    console.error('Error fetching from Open Trivia DB:', error);
    return [];
  }
};

// --- STUDENT ACTIONS ---

// @desc    Submit a quiz attempt
// @route   POST /api/quizzes/:id/submit
router.post('/:id/submit', protect, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    const { answers, timeTaken, autoSubmitted } = req.body; // Array of selected indices or arrays for multiple choice
    
    let score = 0;
    const processedAnswers = quiz.questions.map((q, index) => {
      const selectedOptions = Array.isArray(answers[index]) ? answers[index] : [answers[index]];
      const correctAnswers = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer];
      
      // Check if selected options match correct answers exactly
      const isCorrect = selectedOptions.length === correctAnswers.length && 
                       selectedOptions.every(opt => correctAnswers.includes(opt)) &&
                       correctAnswers.every(opt => selectedOptions.includes(opt));
      
      if (isCorrect) score++;
      
      return {
        questionIndex: index, 
        topic: q.topic || 'General',
        selectedOptions,
        correctAnswers,
        isCorrect
      };
    });

    const accuracy = (score / quiz.questions.length) * 100;
    
    // K-Means Clustering (Logic: 0=Weak, 1=Average, 2=Strong)
    // Input features: [accuracy_pct, time_taken, attempts]
    const cluster = clusterSubmission([accuracy, timeTaken || 0, 1]); // Current attempt is 1

    // Create the quiz result (submission)
    // Ensure all required IDs are present for proper data relationship chain
    // Instructor -> Course -> Quiz -> Result -> Student
    const submission = await Submission.create({
      student: req.user._id, // studentId
      quiz: quiz._id,        // quizId
      course: quiz.course,   // courseId (Linked from quiz)
      instructor: quiz.instructor, // instructorId (Linked from quiz)
      answers: processedAnswers,
      score,
      totalQuestions: quiz.questions.length,
      timeTaken: timeTaken || 0,
      autoSubmitted: autoSubmitted || false,
      cluster
    });

    console.log(`Quiz result saved for student: ${req.user.name}, Quiz: ${quiz.title}, Course: ${quiz.course}`);
    
    // Update course progress
    let progress = await CourseProgress.findOne({
      studentId: req.user._id,
      courseId: quiz.course
    });
    
    if (!progress) {
      progress = await CourseProgress.create({
        studentId: req.user._id,
        courseId: quiz.course,
        viewedNotes: [],
        completedQuizzes: [],
        completedAssignments: []
      });
    }
    
    // Add quiz to completed if not already there
    if (!progress.completedQuizzes.includes(quiz._id)) {
      progress.completedQuizzes.push(quiz._id);
    }
    
    // Calculate and save progress
    progress.overallProgress = await calculateProgress(progress, quiz.course);
    progress.lastUpdated = Date.now();
    await progress.save();

    res.status(201).json(submission);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get single quiz detail
// @route   GET /api/quizzes/detail/:id
router.get('/detail/:id', protect, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id).populate('course', 'title');
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
    
    // Ensure duration is always sent, even if not in DB
    const quizData = quiz.toObject();
    if (quizData.duration === undefined || quizData.duration === null) {
      quizData.duration = 30;
    }
    
    res.json(quizData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get all quizzes for an instructor
// @route   GET /api/quizzes/instructor
router.get('/instructor', protect, async (req, res) => {
  try {
    const quizzes = await Quiz.find({ instructor: req.user._id }).populate('course', 'title');
    res.json(quizzes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get quizzes for a specific course
// @route   GET /api/quizzes/course/:courseId
router.get('/course/:courseId', protect, async (req, res) => {
  try {
    console.log(`Getting quizzes for courseId: ${req.params.courseId}`);
    const quizzes = await Quiz.find({ course: req.params.courseId });
    console.log(`Found ${quizzes.length} quizzes`);
    quizzes.forEach((q, idx) => {
      console.log(`Quiz ${idx+1}: ${q.title}, ${q.questions?.length || 0} questions`);
    });
    res.json(quizzes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Create a new quiz
// @route   POST /api/quizzes
// @access  Private (Instructor/Admin)
router.post('/', protect, async (req, res) => {
  if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const { title, courseId, questions, source, duration, datasetQuestionCount } = req.body;

  try {
    console.log("Creating quiz with incoming data:", req.body);
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: 'Course not found' });

    if (course.instructor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    let finalQuestions = questions || [];
    if (finalQuestions.length > 0) {
      finalQuestions = finalQuestions.filter(q => q && q.questionText && q.questionText.trim() !== '');
    }

    const parseDesiredCount = (raw) => {
      const n = Number(raw);
      if (!Number.isFinite(n)) return 10;
      return Math.max(1, Math.floor(n));
    };

    if (source === 'Dataset' || source === 'Mixed') {
      const normalizedCategory = normalizeCategory(course.category);
      console.log("Category:", normalizedCategory);
      
      // Use the specified number of questions or default to 10
      const questionCount = parseDesiredCount(datasetQuestionCount);
      
      // 1. First try to fetch from local DB using $sample
      let bankQuestions = [];
      try {
        bankQuestions = await QuestionBank.aggregate([
          { $match: { category: normalizedCategory } },
          { $sample: { size: questionCount } }
        ]);
      } catch (aggError) {
        console.log("Aggregation failed, falling back to find:", aggError);
        bankQuestions = await QuestionBank.find({ category: normalizedCategory });
      }
      
      console.log("Questions fetched from local DB:", bankQuestions.length);
      
      // 2. If local DB has insufficient, fetch from Open Trivia DB
      let apiQuestions = [];
      if (bankQuestions.length < questionCount) {
        const remainingCount = questionCount - bankQuestions.length;
        console.log(`Fetching ${remainingCount} questions from Open Trivia DB`);
        apiQuestions = await fetchFromOpenTriviaDB(normalizedCategory, remainingCount);
        
        // Save API questions to DB for future use
        if (apiQuestions.length > 0) {
          try {
            await QuestionBank.insertMany(apiQuestions);
            console.log(`Saved ${apiQuestions.length} new questions to QuestionBank`);
          } catch (saveError) {
            console.error("Error saving API questions to DB:", saveError);
          }
        }
      }
      
      // Combine all questions
      const allQuestions = [
        ...bankQuestions,
        ...apiQuestions
      ];
      
      // Map to quiz question format
      const selected = allQuestions
        .slice(0, questionCount)
        .map(q => ({
          questionText: q.questionText,
          options: q.options,
          correctAnswer: Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer],
          topic: q.topic || normalizedCategory
        }));
      
      if (selected.length === 0 && questionCount > 0) {
        return res.status(400).json({ 
          message: `No dataset available for this category (${normalizedCategory}). Please add manual questions or try a different category.` 
        });
      }
      
      if (source === 'Dataset') {
        finalQuestions = selected;
      } else {
        // Ensure manual questions also have correctAnswer as array
        const processedManualQuestions = finalQuestions.map(q => ({
          ...q,
          correctAnswer: Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer]
        }));
        finalQuestions = [...processedManualQuestions, ...selected];
      }
    } else {
      // Ensure manual questions have correctAnswer as array
      finalQuestions = finalQuestions.map(q => ({
        ...q,
        correctAnswer: Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer]
      }));
    }

    const quiz = await Quiz.create({
      title,
      course: courseId,
      instructor: req.user._id,
      source: source || 'Manual',
      questions: finalQuestions,
      duration: (duration !== undefined && duration !== null) ? duration : 30
    });

    console.log(`Created Quiz: ${quiz.title}, Duration: ${quiz.duration}min, Questions: ${quiz.questions.length}`);
    res.status(201).json(quiz);
  } catch (error) {
    console.error("Error creating quiz:", error);
    res.status(400).json({ message: error.message });
  }
});

// @desc    Update a quiz
// @route   PUT /api/quizzes/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    if (quiz.instructor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    console.log("Updating quiz with incoming data:", req.body);
    const { title, courseId, questions, source, duration, datasetQuestionCount } = req.body;
    let finalQuestions = questions || [];
    if (finalQuestions.length > 0) {
      finalQuestions = finalQuestions.filter(q => q && q.questionText && q.questionText.trim() !== '');
    }

    const parseDesiredCount = (raw) => {
      const n = Number(raw);
      if (!Number.isFinite(n)) return 10;
      return Math.max(1, Math.floor(n));
    };

    // If source changed to Dataset or Mixed and questions weren't manually provided
    if ((source === 'Dataset' || source === 'Mixed')) {
      const course = await Course.findById(courseId);
      if (!course) return res.status(404).json({ message: 'Course not found' });
      
      const normalizedCategory = normalizeCategory(course.category);
      console.log("Updating quiz - Category:", normalizedCategory);
      
      const questionCount = parseDesiredCount(datasetQuestionCount);
      
      // 1. First try to fetch from local DB using $sample
      let bankQuestions = [];
      try {
        bankQuestions = await QuestionBank.aggregate([
          { $match: { category: normalizedCategory } },
          { $sample: { size: questionCount } }
        ]);
      } catch (aggError) {
        console.log("Aggregation failed, falling back to find:", aggError);
        bankQuestions = await QuestionBank.find({ category: normalizedCategory });
      }
      
      console.log("Questions fetched from local DB:", bankQuestions.length);
      
      // 2. If local DB has insufficient, fetch from Open Trivia DB
      let apiQuestions = [];
      if (bankQuestions.length < questionCount) {
        const remainingCount = questionCount - bankQuestions.length;
        console.log(`Fetching ${remainingCount} questions from Open Trivia DB`);
        apiQuestions = await fetchFromOpenTriviaDB(normalizedCategory, remainingCount);
        
        // Save API questions to DB for future use
        if (apiQuestions.length > 0) {
          try {
            await QuestionBank.insertMany(apiQuestions);
            console.log(`Saved ${apiQuestions.length} new questions to QuestionBank`);
          } catch (saveError) {
            console.error("Error saving API questions to DB:", saveError);
          }
        }
      }
      
      // Combine all questions
      const allQuestions = [
        ...bankQuestions,
        ...apiQuestions
      ];
      
      // Map to quiz question format
      const selected = allQuestions
        .slice(0, questionCount)
        .map(q => ({
          questionText: q.questionText,
          options: q.options,
          correctAnswer: Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer],
          topic: q.topic || normalizedCategory
        }));
      
      if (selected.length === 0 && questionCount > 0) {
        return res.status(400).json({ 
          message: `No dataset available for this category (${normalizedCategory}). Please add manual questions or try a different category.` 
        });
      }
      
      if (source === 'Dataset') {
        finalQuestions = selected;
      } else {
        // Ensure manual questions also have correctAnswer as array
        const processedManualQuestions = (questions || []).map(q => ({
          ...q,
          correctAnswer: Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer]
        }));
        finalQuestions = [...processedManualQuestions, ...selected];
      }
    } else {
      // Ensure manual questions have correctAnswer as array
      finalQuestions = finalQuestions.map(q => ({
        ...q,
        correctAnswer: Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer]
      }));
    }

    const updatedQuiz = await Quiz.findByIdAndUpdate(req.params.id, {
      title,
      course: courseId,
      questions: finalQuestions,
      source,
      duration: (duration !== undefined && duration !== null) ? duration : 30
    }, { new: true });

    console.log(`Updated Quiz: ${updatedQuiz.title}, Duration: ${updatedQuiz.duration}min, Questions: ${updatedQuiz.questions.length}`);
    res.json(updatedQuiz);
  } catch (error) {
    console.error("Error updating quiz:", error);
    res.status(400).json({ message: error.message });
  }
});

// @desc    Delete a quiz
// @route   DELETE /api/quizzes/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    if (quiz.instructor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Quiz.findByIdAndDelete(req.params.id);
    res.json({ message: 'Quiz removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
