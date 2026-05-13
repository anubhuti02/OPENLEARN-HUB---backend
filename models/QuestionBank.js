import mongoose from 'mongoose';

const questionBankSchema = mongoose.Schema({
  category: { 
    type: String, 
    required: true
  },
  questionText: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswer: { type: [Number], required: true },
  topic: { type: String, default: 'General' }
}, {
  timestamps: true
});

const QuestionBank = mongoose.model('QuestionBank', questionBankSchema);
export default QuestionBank;
