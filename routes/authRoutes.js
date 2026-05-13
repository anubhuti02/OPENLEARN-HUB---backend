import express from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @desc    Register new user
// @route   POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Please add all fields' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Please provide a valid email address' });
  }

  // Strict domain validation
  const validDomains = ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'icloud.com'];
  const domain = email.split('@')[1].toLowerCase();
  if (!validDomains.includes(domain)) {
    return res.status(400).json({ message: `Invalid email domain. Please use a common provider like ${validDomains.join(', ')}` });
  }

  // Name validation
  if (name.length < 3) {
    return res.status(400).json({ message: 'Name must be at least 3 characters long' });
  }

  // Password validation
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'student'
    });

    if (user) {
      res.status(201).json({
        _id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id)
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Authenticate a user
// @route   POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log(`Login attempt for: ${email}`);
    const user = await User.findOne({ email });

    if (!user) {
      console.log(`User not found: ${email}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    console.log(`Password match result: ${isMatch}`);

    if (isMatch) {
      res.json({
        _id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id)
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error(`Login error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Google Sign-In/Sign-Up
// @route   POST /api/auth/google
router.post('/google', async (req, res) => {
  const { credential, role } = req.body;

  try {
    console.log("Verifying Google token...");
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { name, email, picture } = payload;
    
    console.log("Google user info:", { name, email, picture });

    // Check if user already exists
    let user = await User.findOne({ email });
    
    if (user) {
      console.log("Existing Google user found, logging in...");
      // Update avatar if it changed
      if (!user.avatar && picture) {
        user.avatar = picture;
        await user.save();
      }

      return res.json({
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          role: user.role
        },
        token: generateToken(user._id),
        isNewUser: false
      });
    }

    // User doesn't exist - check if role was provided
    if (!role) {
      console.log("New user - requesting role selection");
      return res.json({
        isNewUser: true
      });
    }

    // Validate role
    const validRoles = ['student', 'instructor'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role selected' });
    }

    // Create new user with selected role
    console.log("Creating new Google user with role:", role);
    user = await User.create({
      name,
      email,
      avatar: picture,
      provider: 'google',
      role: role
    });

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role
      },
      token: generateToken(user._id),
      isNewUser: false
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(401).json({ message: 'Invalid Google token' });
  }
});

// @desc    Get user data
router.get('/me', async (req, res) => {
  res.status(200).json(req.user);
});

export default router;
