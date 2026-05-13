import mongoose from 'mongoose';

const moduleSchema = mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['pdf', 'video'],
    required: true
  },
  src: {
    type: String,
    default: '#'
  }
});

const courseSchema = mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a course title']
  },
  category: {
    type: String,
    required: [true, 'Please add a course category']
  },
  desc: {
    type: String,
    required: [true, 'Please add a description']
  },
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  students: {
    type: Number,
    default: 0
  },
  enrolledStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  notes: [{
    title: String,
    filename: String,
    path: String,
    uploadDate: { type: Date, default: Date.now }
  }],
  modules: [moduleSchema]
}, {
  timestamps: true
});

const Course = mongoose.model('Course', courseSchema);
export default Course;
