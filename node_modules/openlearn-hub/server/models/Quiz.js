import mongoose from 'mongoose';

const questionSchema = mongoose.Schema({
  questionText: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswer: { type: [Number], required: true },
  topic: { type: String, default: 'General' }
});

const quizSchema = mongoose.Schema({
  title: { type: String, required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  source: { 
    type: String, 
    enum: ['Manual', 'Dataset', 'Mixed'], 
    default: 'Manual' 
  },
  duration: { type: Number, default: 30 }, // in minutes
  questions: [questionSchema],
}, {
  timestamps: true
});

const Quiz = mongoose.model('Quiz', quizSchema);
export default Quiz;
