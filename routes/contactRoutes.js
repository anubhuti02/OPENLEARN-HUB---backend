import express from 'express';
import Contact from '../models/Contact.js';

const router = express.Router();

// @desc    Submit contact form
// @route   POST /api/contact
router.post('/', async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ message: 'All fields required' });
    }

    await Contact.create({ name, email, message });
    res.status(200).json({ message: 'Message sent successfully' });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
