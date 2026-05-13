import { GoogleGenerativeAI } from "@google/generative-ai";
import Course from '../models/Course.js';
import QuestionBank from '../models/QuestionBank.js';

/**
 * Get AI response for student query
 */
export const getAIResponse = async (query, userId) => {
  try {
    // Re-initialize Gemini check in case process.env was updated
    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

    // 1. Get Context from Database (Courses and Question Bank)
    const courses = await Course.find({}).limit(5).select('title desc');
    const topics = await QuestionBank.distinct('category');
    
    const context = `
      You are the AI Assistant for "OpenLearn Hub", an educational platform.
      Current Courses: ${courses.map(c => c.title).join(', ')}.
      Available Quiz Topics: ${topics.join(', ')}.
      The platform features: PDF study materials, Machine Learning-based performance analytics (K-Means, Random Forest, PCA), and customized quizzes.
    `;

    // 2. Try real AI if available
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = `${context}\nStudent Query: ${query}\nPlease provide a helpful, concise answer based on the platform context and general educational knowledge. If they ask about a specific quiz topic, explain it briefly.`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        if (text) return text;
      } catch (geminiErr) {
        console.error('Gemini API Error:', geminiErr.message);
        // Fall through to fallback
      }
    }

    // 3. Fallback Smart Response (Knowledge-based)
    return getSmartFallback(query, courses, topics);
    
  } catch (error) {
    console.error('AI Service Error:', error.message);
    return "I'm here to help! Although I'm in basic mode right now, I can answer questions about your courses, quizzes, and the OpenLearn Hub platform. What would you like to know?";
  }
};

/**
 * Smart fallback logic when API key is missing
 */
const getSmartFallback = (query, courses, topics) => {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('course')) {
    return `We currently offer several courses including ${courses.map(c => c.title).join(', ')}. You can find them in the Course Catalog!`;
  }
  
  if (lowerQuery.includes('quiz') || lowerQuery.includes('topic')) {
    return `You can take quizzes on various topics like ${topics.join(', ')}. Our ML system will analyze your performance after each attempt!`;
  }
  
  if (lowerQuery.includes('hello') || lowerQuery.includes('hi ')) {
    return "Hello! I'm the OpenLearn Hub Assistant. How can I help you with your studies today?";
  }

  if (lowerQuery.includes('ml') || lowerQuery.includes('machine learning')) {
    return "Our platform uses K-Means for clustering your performance (Weak/Average/Strong) and Random Forest to predict your future levels. Check your dashboard for the charts!";
  }

  return "That's a great question! While I'm currently in 'offline mode' (waiting for my Gemini API key), I can tell you that OpenLearn Hub is designed to help you master topics through quizzes and data-driven analytics. Feel free to explore your courses!";
};
