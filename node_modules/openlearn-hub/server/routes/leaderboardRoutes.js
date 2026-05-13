import express from 'express';
import mongoose from 'mongoose';
import Submission from '../models/Submission.js';
import User from '../models/User.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Helper function to generate leaderboard with ranks
const generateLeaderboard = async (matchStage) => {
  const fullLeaderboard = await Submission.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$student",
        totalAttempts: { $sum: 1 },
        totalScore: { $sum: "$score" },
        totalQuestionsAttempted: { $sum: "$totalQuestions" },
        totalCorrect: { 
          $sum: { 
            $size: { 
              $filter: { 
                input: "$answers", 
                as: "answer", 
                cond: "$$answer.isCorrect" 
              } 
            } 
          } 
        },
        scores: { $push: { score: "$score", total: "$totalQuestions" } }
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user"
      }
    },
    { $unwind: "$user" },
    {
      $match: { "user.role": "student" }
    },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        name: "$user.name",
        email: "$user.email",
        avatar: "$user.avatar",
        totalAttempts: 1,
        totalScore: 1,
        totalQuestionsAttempted: 1,
        totalCorrect: 1,
        scores: 1,
        averageScore: { 
          $round: [
            {
              $avg: {
                $map: {
                  input: "$scores",
                  as: "s",
                  in: {
                    $multiply: [
                      { $divide: ["$$s.score", "$$s.total"] },
                      100
                    ]
                  }
                }
              }
            },
            2
          ]
        },
        accuracy: {
          $round: [
            { 
              $multiply: [
                { 
                  $cond: {
                    if: { $gt: ["$totalQuestionsAttempted", 0] },
                    then: { $divide: ["$totalCorrect", "$totalQuestionsAttempted"] },
                    else: 0
                  }
                },
                100
              ]
            },
            2
          ]
        }
      }
    },
    {
      $sort: {
        averageScore: -1,
        totalAttempts: -1
      }
    }
  ]);

  return fullLeaderboard.map((student, index) => ({
    ...student,
    rank: index + 1
  }));
};

// @desc    Get full leaderboard (for instructors)
// @route   GET /api/leaderboard/full
router.get('/full', async (req, res) => {
  try {
    const { courseId, quizId } = req.query;
    
    console.log('=== Full Leaderboard Request ===');
    console.log('Filters:', { courseId, quizId });
    
    let matchStage = {};
    
    if (courseId && mongoose.Types.ObjectId.isValid(courseId)) {
      matchStage.course = new mongoose.Types.ObjectId(courseId);
    }
    
    if (quizId && mongoose.Types.ObjectId.isValid(quizId)) {
      matchStage.quiz = new mongoose.Types.ObjectId(quizId);
    }

    console.log('Match stage:', matchStage);

    const leaderboard = await generateLeaderboard(matchStage);
    
    console.log('Full leaderboard count:', leaderboard.length);

    res.json(leaderboard.slice(0, 10)); // Limit to top 10 for instructors
  } catch (error) {
    console.error('Full leaderboard error:', error);
    res.status(500).json({ message: 'Failed to get leaderboard' });
  }
});

// @desc    Get student leaderboard (top 5 + current rank)
// @route   GET /api/leaderboard
router.get('/', protect, async (req, res) => {
  try {
    const { courseId, quizId } = req.query;
    const currentUserId = req.user._id;
    
    console.log('=== Student Leaderboard Request ===');
    console.log('Filters:', { courseId, quizId });
    console.log('Current user:', currentUserId);
    
    let matchStage = {};
    
    if (courseId && mongoose.Types.ObjectId.isValid(courseId)) {
      matchStage.course = new mongoose.Types.ObjectId(courseId);
    }
    
    if (quizId && mongoose.Types.ObjectId.isValid(quizId)) {
      matchStage.quiz = new mongoose.Types.ObjectId(quizId);
    }

    console.log('Match stage:', matchStage);

    const leaderboard = await generateLeaderboard(matchStage);

    // Get top 5 students
    const topStudents = leaderboard.slice(0, 5);

    // Find current user's rank
    let currentUserRank = null;
    const currentUser = leaderboard.find(s => s.userId.toString() === currentUserId.toString());
    
    if (currentUser) {
      currentUserRank = {
        rank: currentUser.rank,
        averageScore: currentUser.averageScore,
        accuracy: currentUser.accuracy,
        totalAttempts: currentUser.totalAttempts,
        name: currentUser.name
      };
    }

    console.log('Top students:', topStudents.length);
    console.log('Current user rank:', currentUserRank);

    res.json({
      topStudents,
      currentUserRank
    });
  } catch (error) {
    console.error('Student leaderboard error:', error);
    res.status(500).json({ message: 'Failed to get leaderboard' });
  }
});

export default router;
