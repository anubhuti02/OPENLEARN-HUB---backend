import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { protect } from '../middleware/authMiddleware.js';
import Assignment from '../models/Assignment.js';
import AssignmentSubmission from '../models/AssignmentSubmission.js';
import Course from '../models/Course.js';
import CourseProgress from '../models/CourseProgress.js';
import Quiz from '../models/Quiz.js';

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

// MULTER SETUP FOR ASSIGNMENT FILE UPLOADS
const assignmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/assignments';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const submissionStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/submissions';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const uploadAssignment = multer({
  storage: assignmentStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF, DOC, DOCX files allowed'), false);
  }
});

const uploadSubmission = multer({
  storage: submissionStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF, DOC, DOCX files allowed'), false);
  }
});

// --- INSTRUCTOR ACTIONS ---

// @desc    Create a new assignment
// @route   POST /api/assignments
router.post('/', protect, uploadAssignment.single('attachment'), async (req, res) => {
  if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  try {
    const { title, description, dueDate, totalMarks, courseId } = req.body;
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: 'Course not found' });

    if (course.instructor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized for this course' });
    }

    const assignment = await Assignment.create({
      title,
      description,
      dueDate,
      totalMarks,
      courseId,
      instructorId: req.user._id,
      attachmentUrl: req.file ? `/uploads/assignments/${req.file.filename}` : null
    });

    await assignment.populate('courseId', 'title');
    res.status(201).json(assignment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @desc    Get assignments for instructor
// @route   GET /api/assignments/instructor
router.get('/instructor', protect, async (req, res) => {
  if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  try {
    const assignments = await Assignment.find({ instructorId: req.user._id })
      .populate('courseId', 'title');
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get assignments by course
// @route   GET /api/assignments/course/:courseId
router.get('/course/:courseId', protect, async (req, res) => {
  try {
    const assignments = await Assignment.find({ courseId: req.params.courseId });
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update an assignment
// @route   PUT /api/assignments/:id
router.put('/:id', protect, uploadAssignment.single('attachment'), async (req, res) => {
  if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    if (assignment.instructorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const updateData = { ...req.body };
    if (req.file) {
      updateData.attachmentUrl = `/uploads/assignments/${req.file.filename}`;
    }

    const updatedAssignment = await Assignment.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('courseId', 'title');

    res.json(updatedAssignment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @desc    Delete an assignment
// @route   DELETE /api/assignments/:id
router.delete('/:id', protect, async (req, res) => {
  if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    if (assignment.instructorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Assignment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Assignment deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get submissions for an assignment (instructor)
// @route   GET /api/assignments/:id/submissions
router.get('/:id/submissions', protect, async (req, res) => {
  if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  try {
    const submissions = await AssignmentSubmission.find({ assignmentId: req.params.id })
      .populate('studentId', 'name email');
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Grade a submission (instructor)
// @route   PUT /api/assignments/submissions/:submissionId/grade
router.put('/submissions/:submissionId/grade', protect, async (req, res) => {
  if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  try {
    const { marks, feedback } = req.body;
    const submission = await AssignmentSubmission.findByIdAndUpdate(
      req.params.submissionId,
      { marks, feedback },
      { new: true }
    ).populate('studentId', 'name email');
    if (!submission) return res.status(404).json({ message: 'Submission not found' });
    res.json(submission);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// --- STUDENT ACTIONS ---

// @desc    Submit an assignment
// @route   POST /api/assignments/:id/submit
router.post('/:id/submit', protect, uploadSubmission.single('submissionFile'), async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Only students can submit assignments' });
  }

  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    // Check if already submitted
    const existingSubmission = await AssignmentSubmission.findOne({
      assignmentId: req.params.id,
      studentId: req.user._id
    });
    if (existingSubmission) {
      return res.status(400).json({ message: 'Assignment already submitted' });
    }

    // Check if late
    const isLate = new Date() > new Date(assignment.dueDate);
    const status = isLate ? 'late' : 'submitted';

    const submission = await AssignmentSubmission.create({
      assignmentId: req.params.id,
      studentId: req.user._id,
      fileUrl: `/uploads/submissions/${req.file.filename}`,
      isLate,
      status
    });

    // Update course progress
    let progress = await CourseProgress.findOne({
      studentId: req.user._id,
      courseId: assignment.courseId
    });
    
    if (!progress) {
      progress = await CourseProgress.create({
        studentId: req.user._id,
        courseId: assignment.courseId,
        viewedNotes: [],
        completedQuizzes: [],
        completedAssignments: []
      });
    }
    
    // Add assignment to completed if not already there
    if (!progress.completedAssignments.includes(req.params.id)) {
      progress.completedAssignments.push(req.params.id);
    }
    
    // Calculate and save progress
    progress.overallProgress = await calculateProgress(progress, assignment.courseId);
    progress.lastUpdated = Date.now();
    await progress.save();

    res.status(201).json(submission);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @desc    Get student's submissions
// @route   GET /api/assignments/student/my-submissions
router.get('/student/my-submissions', protect, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  try {
    const submissions = await AssignmentSubmission.find({ studentId: req.user._id })
      .populate('assignmentId', 'title courseId');
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
