import 'dotenv/config';
import express from "express";
import cors from "cors";
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import dataRoutes from './routes/dataRoutes.js';
import quizRoutes from './routes/quizRoutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import assignmentRoutes from './routes/assignmentRoutes.js';
import progressRoutes from './routes/progressRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { initML } from './services/mlService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request Logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Routes
app.get("/", (req, res) => {
  res.send("Backend is running (Atlas Only) 🚀");
});

app.get("/api/health", (req, res) => {
  res.json({ 
    ok: true, 
    service: "openlearn-hub", 
    time: Date.now(),
    db: process.env.DB_MODE || "unknown"
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/progress', progressRoutes);

// Temporary endpoint to fix course categories
app.post('/api/fix-course-categories', async (req, res) => {
  try {
    const Course = await import('./models/Course.js').then(m => m.default);
    
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
    res.json({ message: `Fixed ${coursesWithoutCategory.length} courses` });
  } catch (error) {
    console.error('Error fixing course categories:', error);
    res.status(500).json({ error: error.message });
  }
});

// Temporary endpoint to check QuestionBank contents
app.get('/api/debug/questionbank', async (req, res) => {
  try {
    const QuestionBank = await import('./models/QuestionBank.js').then(m => m.default);
    
    // Get all categories
    const categories = await QuestionBank.distinct('category');
    console.log('Available categories:', categories);
    
    // Count questions per category
    const categoryCounts = {};
    for (const category of categories) {
      const count = await QuestionBank.countDocuments({ category });
      categoryCounts[category] = count;
    }
    
    // Get sample questions
    const sampleQuestions = await QuestionBank.find().limit(3);
    
    res.json({
      categories,
      categoryCounts,
      sampleQuestions,
      totalQuestions: await QuestionBank.countDocuments()
    });
  } catch (error) {
    console.error('Error checking QuestionBank:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error Handler
app.use((err, req, res, next) => {
  const statusCode = res.statusCode ? res.statusCode : 500;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

const PORT = process.env.PORT || 5000;

// Start Server after DB connection
const startServer = async () => {
  try {
    await connectDB();
    
    // Initialize ML Models after DB connection
    await initML();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`✅  DB mode: ${process.env.DB_MODE || "unknown"}`);
    });
  } catch (error) {
    console.error("❌  Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
