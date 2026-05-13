import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import CourseProgress from '../models/CourseProgress.js';
import Course from '../models/Course.js';
import Quiz from '../models/Quiz.js';
import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import AssignmentSubmission from '../models/AssignmentSubmission.js';

const router = express.Router();

// Helper function to calculate progress
const calculateProgress = async (progress, courseId) => {
  const course = await Course.findById(courseId);
  if (!course) return 0;

  // Get total counts
  const totalNotes = course.notes?.length || 0;
  const totalQuizzes = await Quiz.countDocuments({ course: courseId });
  const totalAssignments = await Assignment.countDocuments({ courseId });

  // Get completed counts
  const completedNotes = progress.viewedNotes?.length || 0;
  const completedQuizzesCount = progress.completedQuizzes?.length || 0;
  const completedAssignmentsCount = progress.completedAssignments?.length || 0;

  // Calculate percentages for each category
  const notesPercent = totalNotes > 0 ? (completedNotes / totalNotes) * 100 : 100; // 100% if no notes
  const quizPercent = totalQuizzes > 0 ? (completedQuizzesCount / totalQuizzes) * 100 : 100; // 100% if no quizzes
  const assignmentPercent = totalAssignments > 0 ? (completedAssignmentsCount / totalAssignments) * 100 : 100; // 100% if no assignments

  // Weighted calculation
  const overall = Math.round(
    (0.3 * notesPercent) + 
    (0.4 * quizPercent) + 
    (0.3 * assignmentPercent)
  );

  return Math.min(100, Math.max(0, overall));
};

// @desc    Get or create progress for student in course
// @route   GET /api/progress/course/:courseId
router.get('/course/:courseId', protect, async (req, res) => {
  try {
    let progress = await CourseProgress.findOne({
      studentId: req.user._id,
      courseId: req.params.courseId
    }).populate('courseId', 'title');

    if (!progress) {
      progress = await CourseProgress.create({
        studentId: req.user._id,
        courseId: req.params.courseId,
        viewedNotes: [],
        completedQuizzes: [],
        completedAssignments: []
      });
    }

    // Recalculate progress before returning
    progress.overallProgress = await calculateProgress(progress, req.params.courseId);
    await progress.save();

    res.json(progress);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get all progress for logged-in student
// @route   GET /api/progress/student
router.get('/student', protect, async (req, res) => {
  try {
    const progresses = await CourseProgress.find({ studentId: req.user._id })
      .populate('courseId', 'title notes');

    // Recalculate all progresses
    for (let progress of progresses) {
      progress.overallProgress = await calculateProgress(progress, progress.courseId._id);
      await progress.save();
    }

    res.json(progresses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Mark note as viewed
// @route   POST /api/progress/note/:courseId/:noteId
router.post('/note/:courseId/:noteId', protect, async (req, res) => {
  try {
    let progress = await CourseProgress.findOne({
      studentId: req.user._id,
      courseId: req.params.courseId
    });

    if (!progress) {
      progress = await CourseProgress.create({
        studentId: req.user._id,
        courseId: req.params.courseId,
        viewedNotes: [],
        completedQuizzes: [],
        completedAssignments: []
      });
    }

    // Add note to viewed if not already there
    if (!progress.viewedNotes.includes(req.params.noteId)) {
      progress.viewedNotes.push(req.params.noteId);
    }

    // Recalculate progress
    progress.overallProgress = await calculateProgress(progress, req.params.courseId);
    progress.lastUpdated = Date.now();
    await progress.save();

    res.json(progress);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Mark quiz as completed
// @route   POST /api/progress/quiz/:courseId/:quizId
router.post('/quiz/:courseId/:quizId', protect, async (req, res) => {
  try {
    let progress = await CourseProgress.findOne({
      studentId: req.user._id,
      courseId: req.params.courseId
    });

    if (!progress) {
      progress = await CourseProgress.create({
        studentId: req.user._id,
        courseId: req.params.courseId,
        viewedNotes: [],
        completedQuizzes: [],
        completedAssignments: []
      });
    }

    // Add quiz to completed if not already there
    if (!progress.completedQuizzes.includes(req.params.quizId)) {
      progress.completedQuizzes.push(req.params.quizId);
    }

    // Recalculate progress
    progress.overallProgress = await calculateProgress(progress, req.params.courseId);
    progress.lastUpdated = Date.now();
    await progress.save();

    res.json(progress);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Mark assignment as completed
// @route   POST /api/progress/assignment/:courseId/:assignmentId
router.post('/assignment/:courseId/:assignmentId', protect, async (req, res) => {
  try {
    let progress = await CourseProgress.findOne({
      studentId: req.user._id,
      courseId: req.params.courseId
    });

    if (!progress) {
      progress = await CourseProgress.create({
        studentId: req.user._id,
        courseId: req.params.courseId,
        viewedNotes: [],
        completedQuizzes: [],
        completedAssignments: []
      });
    }

    // Add assignment to completed if not already there
    if (!progress.completedAssignments.includes(req.params.assignmentId)) {
      progress.completedAssignments.push(req.params.assignmentId);
    }

    // Recalculate progress
    progress.overallProgress = await calculateProgress(progress, req.params.courseId);
    progress.lastUpdated = Date.now();
    await progress.save();

    res.json(progress);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get all students progress for instructor
// @route   GET /api/progress/instructor/course/:courseId
router.get('/instructor/course/:courseId', protect, async (req, res) => {
  try {
    if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const progresses = await CourseProgress.find({ courseId: req.params.courseId })
      .populate('studentId', 'name email')
      .populate('courseId', 'title');

    // Recalculate all progresses
    for (let progress of progresses) {
      progress.overallProgress = await calculateProgress(progress, req.params.courseId);
      await progress.save();
    }

    res.json(progresses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Backfill progress from existing submissions (for students)
// @route   POST /api/progress/backfill
router.post('/backfill', protect, async (req, res) => {
  try {
    // Get all quiz submissions for current student
    const quizSubmissions = await Submission.find({ student: req.user._id });
    
    // Get all assignment submissions for current student
    const assignmentSubmissions = await AssignmentSubmission.find({ studentId: req.user._id });
    
    // Group by course
    const courseMap = {};
    
    // Process quiz submissions
    for (const sub of quizSubmissions) {
      const quiz = await Quiz.findById(sub.quiz);
      if (quiz && quiz.course) {
        const courseId = quiz.course.toString();
        if (!courseMap[courseId]) {
          courseMap[courseId] = { completedQuizzes: new Set(), completedAssignments: new Set() };
        }
        courseMap[courseId].completedQuizzes.add(sub.quiz.toString());
      }
    }
    
    // Process assignment submissions
    for (const sub of assignmentSubmissions) {
      const assignment = await Assignment.findById(sub.assignmentId);
      if (assignment && assignment.courseId) {
        const courseId = assignment.courseId.toString();
        if (!courseMap[courseId]) {
          courseMap[courseId] = { completedQuizzes: new Set(), completedAssignments: new Set() };
        }
        courseMap[courseId].completedAssignments.add(sub.assignmentId.toString());
      }
    }
    
    // Update CourseProgress for each course
    for (const courseId of Object.keys(courseMap)) {
      let progress = await CourseProgress.findOne({
        studentId: req.user._id,
        courseId: courseId
      });
      
      if (!progress) {
        progress = await CourseProgress.create({
          studentId: req.user._id,
          courseId: courseId,
          viewedNotes: [],
          completedQuizzes: [],
          completedAssignments: []
        });
      }
      
      // Add completed quizzes
      for (const quizId of courseMap[courseId].completedQuizzes) {
        if (!progress.completedQuizzes.includes(quizId)) {
          progress.completedQuizzes.push(quizId);
        }
      }
      
      // Add completed assignments
      for (const assignmentId of courseMap[courseId].completedAssignments) {
        if (!progress.completedAssignments.includes(assignmentId)) {
          progress.completedAssignments.push(assignmentId);
        }
      }
      
      // Recalculate and save
      progress.overallProgress = await calculateProgress(progress, courseId);
      progress.lastUpdated = Date.now();
      await progress.save();
    }
    
    // Get updated progresses
    const progresses = await CourseProgress.find({ studentId: req.user._id })
      .populate('courseId', 'title notes');
    
    res.json({ message: 'Progress backfilled successfully', progresses });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
