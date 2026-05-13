import mongoose from 'mongoose';

const submissionSchema = mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answers: [{ 
    questionIndex: Number,
    topic: String,
    selectedOptions: [Number], 
    correctAnswers: [Number], 
    isCorrect: Boolean
  }],
  score: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  timeTaken: { type: Number, default: 0 }, // in seconds
  autoSubmitted: { type: Boolean, default: false },
  cluster: { type: Number, default: 0 } // 0: Weak, 1: Average, 2: Strong
}, {
  timestamps: true
});

const Submission = mongoose.model('Submission', submissionSchema);
export default Submission;
