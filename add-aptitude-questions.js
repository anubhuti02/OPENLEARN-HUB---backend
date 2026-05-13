import 'dotenv/config';
import mongoose from 'mongoose';
import QuestionBank from './models/QuestionBank.js';

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

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB!');

    // Check how many Aptitude questions already exist
    const existingCount = await QuestionBank.countDocuments({ category: 'Aptitude' });
    console.log(`Existing Aptitude questions: ${existingCount}`);

    if (existingCount === 0) {
      await QuestionBank.insertMany(aptitudeQuestions);
      console.log('✅ Added 10 Aptitude questions to QuestionBank!');
    } else {
      console.log('Aptitude questions already exist.');
    }

    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
