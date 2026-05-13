import { kmeans } from 'ml-kmeans';
import { RandomForestClassifier } from 'ml-random-forest';
import { PCA } from 'ml-pca';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Submission from '../models/Submission.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ML Service for Student Analytics
 * Trained using processed Kaggle Student Performance Dataset + Real User Data
 */

let trainingData = [];
let trainingLabels = [];
let rfModel = null;
let pcaModel = null;
let kmeansModel = null;
let kmeansLabels = []; // Maps cluster ID to [0, 1, 2]
let kaggleCount = 0;
let realCount = 0;

// Load Kaggle Data
const loadKaggleData = () => {
  try {
    const dataPath = path.join(__dirname, '..', 'data', 'kaggle_student_data.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const jsonData = JSON.parse(rawData);
    
    // Features: [score, accuracy, time, attempts]
    const features = jsonData.map(item => item.features);
    const labels = jsonData.map(item => item.label);
    kaggleCount = features.length;
    
    return { features, labels };
  } catch (err) {
    console.error('❌ Error loading Kaggle data:', err.message);
    kaggleCount = 3;
    return {
      features: [[85, 85, 120, 1], [45, 45, 450, 4], [65, 65, 200, 2]],
      labels: [2, 0, 1]
    };
  }
};

// Fetch Real Data from MongoDB
const loadRealData = async () => {
  try {
    const submissions = await Submission.find({});
    if (submissions.length === 0) {
      realCount = 0;
      return { features: [], labels: [] };
    }

    const realFeatures = [];
    const realLabels = [];

    submissions.forEach(s => {
      const accuracy = (s.score / s.totalQuestions) * 100;
      // Consistent 4-feature format: [score_pct, accuracy_pct, time, attempts]
      realFeatures.push([accuracy, accuracy, s.timeTaken || 120, 1]);
      
      let label = 1; // Average
      if (accuracy > 75) label = 2; // Strong
      else if (accuracy < 55) label = 0; // Weak
      realLabels.push(label);
    });

    realCount = realFeatures.length;
    return { features: realFeatures, labels: realLabels };
  } catch (err) {
    console.error('❌ Error loading real data:', err.message);
    realCount = 0;
    return { features: [], labels: [] };
  }
};

/**
 * Global Min-Max for normalization
 */
let mins = [0, 0, 0, 1];
let maxs = [100, 100, 1000, 5];

const normalizePoint = (point, featureIndices) => {
  return point.map((val, i) => {
    const mIdx = featureIndices[i];
    const range = maxs[mIdx] - mins[mIdx];
    let normalized = range === 0 ? 0 : (val - mins[mIdx]) / range;
    
    // Weight Accuracy significantly more to ensure it's the primary factor
    // Accuracy is index 0 in our clustering feature set [accuracy, time, attempts]
    if (i === 0) normalized *= 10; 
    
    return normalized;
  });
};

// Initialize and train models
export const initML = async () => {
  console.log('🧠 Initializing ML Models with Kaggle & Real Data...');
  
  const kaggle = loadKaggleData();
  const real = await loadRealData();
  
  trainingData = [...kaggle.features, ...real.features];
  trainingLabels = [...kaggle.labels, ...real.labels];
  
  if (trainingData.length === 0) {
    console.log('⚠️ No data found for training');
    return;
  }

  // Update mins/maxs based on 4-feature data: [score, accuracy, time, attempts]
  for (let i = 0; i < 4; i++) {
    const vals = trainingData.map(d => d[i]);
    mins[i] = Math.min(...vals);
    maxs[i] = Math.max(...vals);
  }

  console.log(`📊 Training on ${trainingData.length} total data points (${kaggleCount} Kaggle + ${realCount} Real)`);

  // 1. Train PCA
  pcaModel = new PCA(trainingData);
  
  // 2. Train Random Forest
  rfModel = new RandomForestClassifier({
    nEstimators: 150,
    maxDepth: 20,
    seed: 42
  });
  rfModel.train(trainingData, trainingLabels);

  // 3. Train K-Means (Stable training)
  // We use [accuracy (index 1), time (index 2), attempts (index 3)] for clustering
  const clusterData = trainingData.map(d => normalizePoint([d[1], d[2], d[3]], [1, 2, 3]));
  kmeansModel = kmeans(clusterData, 3, { seed: 42 });
  
  // Map cluster IDs to labels by calculating mean accuracy of each cluster in training set
  const clusterMeans = [0, 1, 2].map(id => {
    const members = trainingData.filter((_, idx) => kmeansModel.clusters[idx] === id);
    const meanAccuracy = members.length > 0 
      ? members.reduce((sum, m) => sum + m[1], 0) / members.length
      : id * 40;
    return { id, mean: meanAccuracy };
  });

  clusterMeans.sort((a, b) => a.mean - b.mean);
  // kmeansLabels[clusterId] = rank (0:Weak, 1:Avg, 2:Strong)
  kmeansLabels = new Array(3);
  clusterMeans.forEach((c, index) => {
    kmeansLabels[c.id] = index;
  });
  
  console.log('✅ ML Models Retrained & Optimized');
};

/**
 * K-Means Clustering for a new submission
 * Uses pre-trained clusters for stability
 */
export const clusterSubmission = (features) => {
  if (!kmeansModel) return 1;

  // Features input: [accuracy, time_taken, attempts]
  // Indices in global mins/maxs: accuracy=1, time=2, attempts=3
  const normalizedPoint = normalizePoint(features, [1, 2, 3]);

  // Find nearest centroid
  let minDistance = Infinity;
  let nearestClusterId = 0;

  kmeansModel.centroids.forEach((centroid, id) => {
    // Euclidean distance
    const dist = Math.sqrt(centroid.reduce((sum, val, i) => sum + Math.pow(val - normalizedPoint[i], 2), 0));
    if (dist < minDistance) {
      minDistance = dist;
      nearestClusterId = id;
    }
  });

  let cluster = kmeansLabels[nearestClusterId];

  // SUPER ROBUST SANITY CHECK
  // Accuracy is features[0]
  if (features[0] >= 80) {
    // High accuracy must be Strong (2) or Average (1)
    if (cluster === 0) cluster = 1; 
  }
  
  if (features[0] >= 90) {
    // Very high accuracy must be Strong (2)
    cluster = 2;
  }
  
  if (features[0] < 40) {
    // Low accuracy cannot be Strong (2)
    if (cluster === 2) cluster = 1;
  }
  
  if (features[0] < 30) {
    // Very low accuracy must be Weak (0)
    cluster = 0;
  }

  return cluster;
};

/**
 * ML Stats for UI
 */
export const getMLStats = () => {
  if (!kmeansModel || !kmeansLabels.length) return {
    kaggleDataPoints: kaggleCount,
    realDataPoints: realCount,
    totalDataPoints: kaggleCount + realCount,
    trainingData: []
  };

  return {
    kaggleDataPoints: kaggleCount,
    realDataPoints: realCount,
    totalDataPoints: kaggleCount + realCount,
    trainingData: trainingData.map((d, idx) => ({
      accuracy: d[1],
      time: d[2],
      label: kmeansLabels[kmeansModel.clusters[idx]]
    }))
  };
};

/**
 * Random Forest Prediction for Dashboard
 * @param {Array} features - [score, attempts, accuracy, time]
 */
export const predictStudentLevel = (features) => {
  if (!rfModel) return 1; // Default to Average if not trained
  
  // Ensure we have exactly 4 features for RF
  // If input is [score, accuracy, time], we add a default attempts = 1
  const input = features.length === 4 ? features : [features[0], features[1], features[2], 1];
  
  const prediction = rfModel.predict([input])[0];
  return prediction; // 0, 1, or 2
};

/**
 * PCA Feature Reduction
 */
export const getReducedFeatures = (features) => {
  if (!pcaModel) return features;
  const prediction = pcaModel.predict([features]);
  // Convert ml-matrix to plain array
  return Array.from(prediction.data[0]);
};