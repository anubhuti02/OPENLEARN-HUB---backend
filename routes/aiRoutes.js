import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getAIResponse } from '../services/aiService.js';

const router = express.Router();

/**
 * AI Chat Endpoint
 * @route POST /api/ai/chat
 */
router.post('/chat', protect, async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ message: 'Query is required' });

  try {
    const response = await getAIResponse(query, req.user._id);
    res.json({ response });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
