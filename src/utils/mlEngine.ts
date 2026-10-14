import {
  DataPointPrediction,
  FeatureImportance,
  MLConfig,
  MetricSummary,
  TrainedModelResult,
} from '../types';

// Pseudo-random number generator for reproducible train/test splits
function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Matrix inversion via Gauss-Jordan elimination with partial pivoting
function invertMatrix(matrix: number[][]): number[][] | null {
  const n = matrix.length;
  const A = matrix.map((row) => [...row]);
  const I: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );

  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxEl = Math.abs(A[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > maxEl) {
        maxEl = Math.abs(A[k][i]);
        maxRow = k;
      }
    }

    if (maxEl < 1e-12) return null; // Singular

    // Swap rows
    const tempA = A[maxRow];
    A[maxRow] = A[i];
    A[i] = tempA;

    const tempI = I[maxRow];
    I[maxRow] = I[i];
    I[i] = tempI;

    // Normalize pivot row
    const pivot = A[i][i];
    for (let j = 0; j < n; j++) {
      A[i][j] /= pivot;
      I[i][j] /= pivot;
    }

    // Eliminate other rows
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = A[k][i];
        for (let j = 0; j < n; j++) {
          A[k][j] -= factor * A[i][j];
          I[k][j] -= factor * I[i][j];
        }
      }
    }
  }

  return I;
}

// Matrix multiplication: A (m x k) * B (k x n) = C (m x n)
function multiplyMatrices(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const k = A[0].length;
  const n = B[0].length;
  const C: number[][] = Array.from({ length: m }, () => Array(n).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let p = 0; p < k; p++) {
        sum += A[i][p] * B[p][j];
      }
      C[i][j] = sum;
    }
  }
  return C;
}

function transposeMatrix(A: number[][]): number[][] {
  const m = A.length;
  const n = A[0].length;
  const T: number[][] = Array.from({ length: n }, () => Array(m).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      T[j][i] = A[i][j];
    }
  }
  return T;
}

// Decision Tree node for regression & classification
interface TreeNode {
  isLeaf: boolean;
  value?: number | string; // Output prediction
  probabilities?: Record<string, number>;
  featureIndex?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
}

// Helper to clamp target predictions (e.g. fatigue score 1~10)
export function clampTargetValue(value: number, targetCol: string): number {
  const isFatigueOrTenScale =
    targetCol.includes('피로') ||
    targetCol.includes('1~10') ||
    targetCol.toLowerCase().includes('fatigue');

  if (isFatigueOrTenScale) {
    if (value < 1) return 1;
    if (value > 10) return 10;
    return Number(value.toFixed(1));
  }
  return Number(value.toFixed(2));
}

export function trainModel(
  rawRows: Record<string, any>[],
  config: MLConfig
): TrainedModelResult {
  const {
    features,
    target,
    taskType,
    algorithm,
    testSplitRatio,
    randomSeed,
    missingValueStrategy,
  } = config;

  if (!features || features.length === 0) {
    throw new Error('최소 1개 이상의 입력변수를 선택해야 합니다.');
  }
  if (!target) {
    throw new Error('정답(목표) 변수를 선택해야 합니다.');
  }

  // 1. Data Cleaning & Extraction
  interface ProcessedRow {
    id: number;
    original: Record<string, any>;
    features: Record<string, any>;
    targetValue: any;
  }

  const validRows: ProcessedRow[] = [];
  let excludedMissingTargetCount = 0;

  rawRows.forEach((row, idx) => {
    const targetVal = row[target];
    // Exclude if target is null, undefined, empty string, only whitespace, or NaN
    const isTargetEmpty =
      targetVal === null ||
      targetVal === undefined ||
      targetVal === '' ||
      (typeof targetVal === 'string' && targetVal.trim() === '') ||
      (typeof targetVal === 'number' && isNaN(targetVal));

    if (isTargetEmpty) {
      excludedMissingTargetCount++;
      return; // Skip row where target is missing
    }

    if (taskType === 'regression') {
      const numTarget = Number(targetVal);
      if (isNaN(numTarget)) {
        excludedMissingTargetCount++;
        return; // Skip row where numeric target is invalid
      }
    }

    let hasMissingFeature = false;
    const featObj: Record<string, any> = {};

    for (const f of features) {
      const v = row[f];
      if (v === null || v === undefined || v === '') {
        hasMissingFeature = true;
      }
      featObj[f] = v;
    }

    if (missingValueStrategy === 'drop' && hasMissingFeature) {
      return;
    }

    validRows.push({
      id: idx + 1,
      original: row,
      features: featObj,
      targetValue: targetVal,
    });
  });

  if (validRows.length < 5) {
    throw new Error(`학습에 유효한 데이터 행이 너무 적습니다 (${validRows.length}개). 결측치를 확인해주세요.`);
  }

  // 2. Feature Schema & Encoders
  const featureStats: Record<
    string,
    {
      isNumeric: boolean;
      mean: number;
      std: number;
      categories: string[];
    }
  > = {};

  features.forEach((f) => {
    const values = validRows.map((r) => r.features[f]);
    const numVals = values
      .map((v) => Number(v))
      .filter((v) => !isNaN(v) && v !== null && v !== undefined);

    const isNumeric = numVals.length / values.length >= 0.7;

    if (isNumeric) {
      const mean = numVals.reduce((a, b) => a + b, 0) / (numVals.length || 1);
      const variance =
        numVals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (numVals.length || 1);
      const std = Math.sqrt(variance) || 1;
      featureStats[f] = { isNumeric: true, mean, std, categories: [] };
    } else {
      const cats = Array.from(new Set(values.map((v) => String(v || ''))));
      featureStats[f] = { isNumeric: false, mean: 0, std: 1, categories: cats };
    }
  });

  // Target schema
  let classLabels: string[] = [];
  let targetNumericStats = { min: 0, max: 1, mean: 0 };

  if (taskType === 'classification') {
    classLabels = Array.from(
      new Set(validRows.map((r) => String(r.targetValue)))
    ).sort();
    if (classLabels.length < 2) {
      throw new Error('분류를 위해서는 목표 변수에 최소 2개 이상의 클래스가 있어야 합니다.');
    }
  } else {
    const targetNums = validRows.map((r) => Number(r.targetValue)).filter((n) => !isNaN(n));
    if (targetNums.length === 0) {
      throw new Error('회귀 분석을 위해 정답변수는 숫자여야 합니다.');
    }
    const min = Math.min(...targetNums);
    const max = Math.max(...targetNums);
    const mean = targetNums.reduce((a, b) => a + b, 0) / targetNums.length;
    targetNumericStats = { min, max, mean };
  }

  // 3. Vectorize Features
  // Numeric: normalized (x - mean) / std. Categorical: one-hot or index.
  // For simplicity and transparency, we keep a flat vector schema:
  interface EncodedFeatureSlot {
    featureName: string;
    subLabel: string;
    isNumeric: boolean;
    category?: string;
  }

  const encodedSlots: EncodedFeatureSlot[] = [];
  features.forEach((f) => {
    const stat = featureStats[f];
    if (stat.isNumeric) {
      encodedSlots.push({
        featureName: f,
        subLabel: f,
        isNumeric: true,
      });
    } else {
      stat.categories.forEach((cat) => {
        encodedSlots.push({
          featureName: f,
          subLabel: `${f} = ${cat}`,
          isNumeric: false,
          category: cat,
        });
      });
    }
  });

  function vectorizeInput(inputMap: Record<string, any>, standardize = true): number[] {
    const vec: number[] = [];
    encodedSlots.forEach((slot) => {
      const rawVal = inputMap[slot.featureName];
      const stat = featureStats[slot.featureName];
      if (slot.isNumeric) {
        let val = Number(rawVal);
        if (isNaN(val) || rawVal === null || rawVal === undefined) {
          val = stat.mean;
        }
        if (standardize) {
          vec.push((val - stat.mean) / (stat.std || 1));
        } else {
          vec.push(val);
        }
      } else {
        const strVal = String(rawVal || '');
        vec.push(strVal === slot.category ? 1 : 0);
      }
    });
    return vec;
  }

  // 4. Train / Test Split
  const rng = seededRandom(randomSeed || 42);
  const shuffledRows = [...validRows].sort(() => rng() - 0.5);
  const testCount = Math.max(1, Math.floor(shuffledRows.length * testSplitRatio));
  const trainRows = shuffledRows.slice(0, shuffledRows.length - testCount);
  const testRows = shuffledRows.slice(shuffledRows.length - testCount);

  // 5. Model Implementations
  let predictFn: (vec: number[]) => {
    predicted: number | string;
    confidence?: number;
    probabilities?: Record<string, number>;
    contributions?: Record<string, number>;
  };
  let featureImportanceList: FeatureImportance[] = [];

  // === REGRESSION ===
  if (taskType === 'regression') {
    const yTrain = trainRows.map((r) => Number(r.targetValue));
    const XTrainStd = trainRows.map((r) => vectorizeInput(r.features, true));
    const XTrainRaw = trainRows.map((r) => vectorizeInput(r.features, false));

    if (algorithm === 'linear_regression' || algorithm === 'ridge_regression') {
      const alpha = algorithm === 'ridge_regression' ? (config.regularizationAlpha || 1.0) : 1e-4;
      const numFeats = encodedSlots.length;
      
      // Add intercept column 1 to X
      const X_bias = XTrainStd.map((row) => [1, ...row]);
      const XT = transposeMatrix(X_bias);
      const XTX = multiplyMatrices(XT, X_bias);

      // Add ridge penalty alpha*I (except to bias)
      for (let i = 1; i < XTX.length; i++) {
        XTX[i][i] += alpha;
      }

      const invXTX = invertMatrix(XTX);
      if (!invXTX) {
        throw new Error('행렬의 역행렬을 계산할 수 없습니다. 다중공선성이 높은 변수를 제외해보세요.');
      }

      const yCol = yTrain.map((y) => [y]);
      const XTy = multiplyMatrices(XT, yCol);
      const beta = multiplyMatrices(invXTX, XTy); // [intercept, w1, w2, ...]

      const intercept = beta[0][0];
      const weights = beta.slice(1).map((row) => row[0]);

      // Calculate feature importance from absolute weights
      const totalWeight = weights.reduce((acc, w) => acc + Math.abs(w), 0) || 1;
      featureImportanceList = encodedSlots.map((slot, i) => ({
        feature: slot.subLabel,
        importance: Math.abs(weights[i]) / totalWeight,
        rawWeight: Number(weights[i].toFixed(4)),
      })).sort((a, b) => b.importance - a.importance);

      predictFn = (stdVec: number[]) => {
        let sum = intercept;
        const contributions: Record<string, number> = {};
        for (let i = 0; i < stdVec.length; i++) {
          const contrib = weights[i] * stdVec[i];
          sum += contrib;
          contributions[encodedSlots[i].subLabel] = Number(contrib.toFixed(3));
        }
        const clampedPred = clampTargetValue(sum, target);
        return {
          predicted: clampedPred,
          contributions,
        };
      };
    } else if (algorithm === 'knn_reg') {
      const k = Math.min(config.nNeighbors || 5, trainRows.length);
      
      predictFn = (stdVec: number[]) => {
        // Compute Euclidean distance to all train points
        const dists = trainRows.map((r, idx) => {
          const x = XTrainStd[idx];
          let d = 0;
          for (let i = 0; i < stdVec.length; i++) {
            d += Math.pow(stdVec[i] - x[i], 2);
          }
          return { dist: Math.sqrt(d), y: Number(r.targetValue) };
        });

        dists.sort((a, b) => a.dist - b.dist);
        const topK = dists.slice(0, k);
        // Inverse distance weighted average
        let sumWeights = 0;
        let weightedSum = 0;
        for (const item of topK) {
          const w = 1 / (item.dist + 1e-4);
          weightedSum += item.y * w;
          sumWeights += w;
        }
        const pred = weightedSum / sumWeights;
        const clampedPred = clampTargetValue(pred, target);
        return {
          predicted: clampedPred,
        };
      };

      featureImportanceList = encodedSlots.map((slot) => ({
        feature: slot.subLabel,
        importance: 1 / encodedSlots.length,
      }));
    } else {
      // Decision Tree / Random Forest Regressor
      const maxDepth = config.maxTreeDepth || 6;
      const numTrees = algorithm === 'random_forest_reg' ? 10 : 1;

      interface TreeModel {
        root: TreeNode;
      }

      function buildTree(
        dataIndices: number[],
        depth: number,
        featureSubset?: number[]
      ): TreeNode {
        if (dataIndices.length === 0) {
          return { isLeaf: true, value: targetNumericStats.mean };
        }
        const values = dataIndices.map((idx) => yTrain[idx]);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;

        if (depth >= maxDepth || dataIndices.length <= 3) {
          return { isLeaf: true, value: mean };
        }

        let bestVarianceReduction = -1;
        let bestFeature = -1;
        let bestThreshold = 0;
        let bestLeftIdx: number[] = [];
        let bestRightIdx: number[] = [];

        const currentVariance =
          values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0);

        const featsToConsider = featureSubset || Array.from({ length: encodedSlots.length }, (_, i) => i);

        for (const fIdx of featsToConsider) {
          const featVals = dataIndices.map((i) => XTrainRaw[i][fIdx]);
          // Sample distinct candidate thresholds
          const sortedVals = Array.from(new Set(featVals)).sort((a, b) => a - b);
          if (sortedVals.length <= 1) continue;

          for (let i = 0; i < Math.min(sortedVals.length - 1, 15); i++) {
            const thresh = (sortedVals[i] + sortedVals[i + 1]) / 2;
            const leftIdx: number[] = [];
            const rightIdx: number[] = [];

            dataIndices.forEach((dIdx) => {
              if (XTrainRaw[dIdx][fIdx] <= thresh) {
                leftIdx.push(dIdx);
              } else {
                rightIdx.push(dIdx);
              }
            });

            if (leftIdx.length === 0 || rightIdx.length === 0) continue;

            const leftVals = leftIdx.map((i) => yTrain[i]);
            const rightVals = rightIdx.map((i) => yTrain[i]);
            const leftMean = leftVals.reduce((a, b) => a + b, 0) / leftVals.length;
            const rightMean = rightVals.reduce((a, b) => a + b, 0) / rightVals.length;

            const leftVar = leftVals.reduce((a, b) => a + Math.pow(b - leftMean, 2), 0);
            const rightVar = rightVals.reduce((a, b) => a + Math.pow(b - rightMean, 2), 0);

            const vr = currentVariance - (leftVar + rightVar);
            if (vr > bestVarianceReduction) {
              bestVarianceReduction = vr;
              bestFeature = fIdx;
              bestThreshold = thresh;
              bestLeftIdx = leftIdx;
              bestRightIdx = rightIdx;
            }
          }
        }

        if (bestVarianceReduction <= 0 || bestFeature === -1) {
          return { isLeaf: true, value: mean };
        }

        return {
          isLeaf: false,
          featureIndex: bestFeature,
          threshold: bestThreshold,
          left: buildTree(bestLeftIdx, depth + 1, featureSubset),
          right: buildTree(bestRightIdx, depth + 1, featureSubset),
        };
      }

      function predictTree(node: TreeNode, rawVec: number[]): number {
        if (node.isLeaf) return node.value as number;
        if (node.featureIndex === undefined || node.threshold === undefined) {
          return node.value as number || 0;
        }
        if (rawVec[node.featureIndex] <= node.threshold) {
          return predictTree(node.left!, rawVec);
        } else {
          return predictTree(node.right!, rawVec);
        }
      }

      const forest: TreeModel[] = [];
      const featureUsage = Array(encodedSlots.length).fill(0);

      for (let t = 0; t < numTrees; t++) {
        // Bootstrap sampling
        const bootstrapIndices: number[] = [];
        for (let i = 0; i < trainRows.length; i++) {
          bootstrapIndices.push(Math.floor(rng() * trainRows.length));
        }

        // Subsample features if RF
        let subset: number[] | undefined;
        if (algorithm === 'random_forest_reg' && encodedSlots.length > 2) {
          const kFeat = Math.max(2, Math.floor(Math.sqrt(encodedSlots.length)));
          const shuffledFeats = Array.from({ length: encodedSlots.length }, (_, i) => i).sort(() => rng() - 0.5);
          subset = shuffledFeats.slice(0, kFeat);
        }

        const root = buildTree(bootstrapIndices, 0, subset);
        forest.push({ root });

        // Record feature usage for importance
        function walk(node: TreeNode) {
          if (!node.isLeaf && node.featureIndex !== undefined) {
            featureUsage[node.featureIndex]++;
            if (node.left) walk(node.left);
            if (node.right) walk(node.right);
          }
        }
        walk(root);
      }

      const totalSplits = featureUsage.reduce((a, b) => a + b, 0) || 1;
      featureImportanceList = encodedSlots.map((slot, i) => ({
        feature: slot.subLabel,
        importance: featureUsage[i] / totalSplits,
      })).sort((a, b) => b.importance - a.importance);

      predictFn = (_stdVec: number[]) => {
        // Note: predictTree uses raw scale
        const rawVec = _stdVec.map((val, i) => {
          const slot = encodedSlots[i];
          const stat = featureStats[slot.featureName];
          return slot.isNumeric ? val * stat.std + stat.mean : val;
        });

        const preds = forest.map((tree) => predictTree(tree.root, rawVec));
        const avg = preds.reduce((a, b) => a + b, 0) / preds.length;
        const clampedPred = clampTargetValue(avg, target);
        return {
          predicted: clampedPred,
        };
      };
    }
  }

  // === CLASSIFICATION ===
  else {
    const yTrain = trainRows.map((r) => String(r.targetValue));
    const XTrainStd = trainRows.map((r) => vectorizeInput(r.features, true));

    if (algorithm === 'logistic_regression' || classLabels.length === 2) {
      // Binary or multi-class softmax regression with gradient descent
      const K = classLabels.length;
      const D = encodedSlots.length;
      // Weights: K x (D + 1)
      const W: number[][] = Array.from({ length: K }, () => Array(D + 1).fill(0));
      const lr = 0.05;
      const epochs = 120;

      for (let epoch = 0; epoch < epochs; epoch++) {
        for (let i = 0; i < trainRows.length; i++) {
          const x = [1, ...XTrainStd[i]];
          const trueClassIdx = classLabels.indexOf(yTrain[i]);

          // Compute logits
          const logits = W.map((wRow) => {
            let dot = 0;
            for (let j = 0; j < x.length; j++) dot += wRow[j] * x[j];
            return dot;
          });

          // Softmax
          const maxLogit = Math.max(...logits);
          const expLogits = logits.map((l) => Math.exp(l - maxLogit));
          const sumExp = expLogits.reduce((a, b) => a + b, 0);
          const probs = expLogits.map((e) => e / sumExp);

          // Gradient update
          for (let k = 0; k < K; k++) {
            const targetP = k === trueClassIdx ? 1 : 0;
            const err = probs[k] - targetP;
            for (let j = 0; j < x.length; j++) {
              W[k][j] -= lr * (err * x[j] + 0.001 * W[k][j]);
            }
          }
        }
      }

      // Feature importance from weight magnitudes
      const featImportances = Array(D).fill(0);
      for (let d = 0; d < D; d++) {
        let sumW = 0;
        for (let k = 0; k < K; k++) {
          sumW += Math.abs(W[k][d + 1]);
        }
        featImportances[d] = sumW;
      }
      const sumAll = featImportances.reduce((a, b) => a + b, 0) || 1;
      featureImportanceList = encodedSlots.map((slot, i) => ({
        feature: slot.subLabel,
        importance: featImportances[i] / sumAll,
      })).sort((a, b) => b.importance - a.importance);

      predictFn = (stdVec: number[]) => {
        const x = [1, ...stdVec];
        const logits = W.map((wRow) => {
          let dot = 0;
          for (let j = 0; j < x.length; j++) dot += wRow[j] * x[j];
          return dot;
        });
        const maxLogit = Math.max(...logits);
        const expLogits = logits.map((l) => Math.exp(l - maxLogit));
        const sumExp = expLogits.reduce((a, b) => a + b, 0);
        const probs = expLogits.map((e) => e / sumExp);

        let bestClassIdx = 0;
        let maxP = probs[0];
        const probMap: Record<string, number> = {};
        for (let k = 0; k < K; k++) {
          probMap[classLabels[k]] = Number((probs[k] * 100).toFixed(1));
          if (probs[k] > maxP) {
            maxP = probs[k];
            bestClassIdx = k;
          }
        }

        return {
          predicted: classLabels[bestClassIdx],
          confidence: Number((maxP * 100).toFixed(1)),
          probabilities: probMap,
        };
      };
    } else {
      // KNN or Decision Tree Classifier
      const k = Math.min(config.nNeighbors || 5, trainRows.length);
      predictFn = (stdVec: number[]) => {
        const dists = trainRows.map((r, idx) => {
          const x = XTrainStd[idx];
          let d = 0;
          for (let i = 0; i < stdVec.length; i++) {
            d += Math.pow(stdVec[i] - x[i], 2);
          }
          return { dist: Math.sqrt(d), label: String(r.targetValue) };
        });

        dists.sort((a, b) => a.dist - b.dist);
        const topK = dists.slice(0, k);

        const counts: Record<string, number> = {};
        classLabels.forEach((cl) => (counts[cl] = 0));
        topK.forEach((item) => {
          counts[item.label] = (counts[item.label] || 0) + 1;
        });

        let bestLabel = classLabels[0];
        let maxCount = -1;
        const probMap: Record<string, number> = {};
        classLabels.forEach((cl) => {
          const p = (counts[cl] / k) * 100;
          probMap[cl] = Number(p.toFixed(1));
          if (counts[cl] > maxCount) {
            maxCount = counts[cl];
            bestLabel = cl;
          }
        });

        return {
          predicted: bestLabel,
          confidence: Number(((maxCount / k) * 100).toFixed(1)),
          probabilities: probMap,
        };
      };

      featureImportanceList = encodedSlots.map((slot) => ({
        feature: slot.subLabel,
        importance: 1 / encodedSlots.length,
      }));
    }
  }

  // 6. Compute Predictions & Accurate Metrics on Train & Test sets
  const allPredictions: DataPointPrediction[] = [];

  // Evaluate Train Set
  let trainCorrect = 0;
  let trainSumSqDiff = 0;
  let trainSumAbsDiff = 0;
  let trainToleranceHits = 0;
  const trainActuals: number[] = [];
  const trainPreds: number[] = [];

  trainRows.forEach((r) => {
    const stdVec = vectorizeInput(r.features, true);
    const result = predictFn(stdVec);
    const actual = r.targetValue;

    if (taskType === 'regression') {
      const actNum = Number(actual);
      const predNum = Number(result.predicted);
      trainActuals.push(actNum);
      trainPreds.push(predNum);
      const diff = actNum - predNum;
      trainSumSqDiff += diff * diff;
      trainSumAbsDiff += Math.abs(diff);

      // Within 15% tolerance of target span or +/-1 unit
      const span = Math.max(1, targetNumericStats.max - targetNumericStats.min);
      if (Math.abs(diff) <= Math.max(1.0, span * 0.15)) {
        trainToleranceHits++;
      }

      allPredictions.push({
        rowId: r.id,
        actual: actNum,
        predicted: predNum,
        residual: Number(diff.toFixed(3)),
        isTest: false,
      });
    } else {
      const isHit = String(actual) === String(result.predicted);
      if (isHit) trainCorrect++;

      allPredictions.push({
        rowId: r.id,
        actual: String(actual),
        predicted: String(result.predicted),
        isTest: false,
      });
    }
  });

  // Evaluate Test Set
  let testCorrect = 0;
  let testSumSqDiff = 0;
  let testSumAbsDiff = 0;
  let testToleranceHits = 0;
  const testActuals: number[] = [];
  const testPreds: number[] = [];

  testRows.forEach((r) => {
    const stdVec = vectorizeInput(r.features, true);
    const result = predictFn(stdVec);
    const actual = r.targetValue;

    if (taskType === 'regression') {
      const actNum = Number(actual);
      const predNum = Number(result.predicted);
      testActuals.push(actNum);
      testPreds.push(predNum);
      const diff = actNum - predNum;
      testSumSqDiff += diff * diff;
      testSumAbsDiff += Math.abs(diff);

      const span = Math.max(1, targetNumericStats.max - targetNumericStats.min);
      if (Math.abs(diff) <= Math.max(1.0, span * 0.15)) {
        testToleranceHits++;
      }

      allPredictions.push({
        rowId: r.id,
        actual: actNum,
        predicted: predNum,
        residual: Number(diff.toFixed(3)),
        isTest: true,
      });
    } else {
      const isHit = String(actual) === String(result.predicted);
      if (isHit) testCorrect++;

      allPredictions.push({
        rowId: r.id,
        actual: String(actual),
        predicted: String(result.predicted),
        isTest: true,
      });
    }
  });

  // Calculate high-level summary metrics
  const metrics: MetricSummary = {
    trainAccuracy: 0,
    testAccuracy: 0,
  };

  if (taskType === 'regression') {
    const trainN = trainRows.length || 1;
    const testN = testRows.length || 1;

    metrics.trainRMSE = Number(Math.sqrt(trainSumSqDiff / trainN).toFixed(3));
    metrics.testRMSE = Number(Math.sqrt(testSumSqDiff / testN).toFixed(3));
    metrics.trainMAE = Number((trainSumAbsDiff / trainN).toFixed(3));
    metrics.testMAE = Number((testSumAbsDiff / testN).toFixed(3));

    // R2 Calculation: 1 - SS_res / SS_tot
    const trainMean = trainActuals.reduce((a, b) => a + b, 0) / trainN;
    const trainSSTot = trainActuals.reduce((acc, y) => acc + Math.pow(y - trainMean, 2), 0) || 1;
    const trainR2 = Math.max(0, 1 - trainSumSqDiff / trainSSTot);

    const testMean = testActuals.reduce((a, b) => a + b, 0) / testN;
    const testSSTot = testActuals.reduce((acc, y) => acc + Math.pow(y - testMean, 2), 0) || 1;
    const testR2 = Math.max(0, 1 - testSumSqDiff / testSSTot);

    metrics.trainR2 = Number(trainR2.toFixed(3));
    metrics.testR2 = Number(testR2.toFixed(3));

    // Tolerance accuracy (% within tolerance range)
    metrics.trainToleranceAccuracy = Number(((trainToleranceHits / trainN) * 100).toFixed(1));
    metrics.testToleranceAccuracy = Number(((testToleranceHits / testN) * 100).toFixed(1));

    // For regression accuracy display, combine R2 (percentage scale)
    metrics.trainAccuracy = Number((trainR2 * 100).toFixed(1));
    metrics.testAccuracy = Number((testR2 * 100).toFixed(1));
  } else {
    const trainN = trainRows.length || 1;
    const testN = testRows.length || 1;

    metrics.trainAccuracy = Number(((trainCorrect / trainN) * 100).toFixed(1));
    metrics.testAccuracy = Number(((testCorrect / testN) * 100).toFixed(1));

    // Confusion Matrix for Test Set
    const matrix: number[][] = Array.from({ length: classLabels.length }, () =>
      Array(classLabels.length).fill(0)
    );

    testRows.forEach((r) => {
      const actualLabel = String(r.targetValue);
      const stdVec = vectorizeInput(r.features, true);
      const pred = predictFn(stdVec);
      const actualIdx = classLabels.indexOf(actualLabel);
      const predIdx = classLabels.indexOf(String(pred.predicted));
      if (actualIdx !== -1 && predIdx !== -1) {
        matrix[actualIdx][predIdx]++;
      }
    });

    metrics.confusionMatrix = {
      labels: classLabels,
      matrix,
    };

    // Calculate Macro F1, Precision, Recall
    let totalPrecision = 0;
    let totalRecall = 0;
    for (let i = 0; i < classLabels.length; i++) {
      const tp = matrix[i][i];
      let rowSum = 0; // Actual positive
      let colSum = 0; // Predicted positive
      for (let j = 0; j < classLabels.length; j++) {
        rowSum += matrix[i][j];
        colSum += matrix[j][i];
      }
      const prec = colSum > 0 ? tp / colSum : 0;
      const rec = rowSum > 0 ? tp / rowSum : 0;
      totalPrecision += prec;
      totalRecall += rec;
    }
    const avgPrec = totalPrecision / classLabels.length;
    const avgRec = totalRecall / classLabels.length;
    const f1 = (avgPrec + avgRec) > 0 ? (2 * avgPrec * avgRec) / (avgPrec + avgRec) : 0;

    metrics.precision = Number((avgPrec * 100).toFixed(1));
    metrics.recall = Number((avgRec * 100).toFixed(1));
    metrics.f1Score = Number((f1 * 100).toFixed(1));
  }

  return {
    config,
    trainedAt: new Date().toLocaleTimeString(),
    metrics,
    predictions: allPredictions,
    featureImportance: featureImportanceList,
    classLabels,
    excludedTargetRowsCount: excludedMissingTargetCount,
    targetStats: {
      min: targetNumericStats.min,
      max: targetNumericStats.max,
      mean: targetNumericStats.mean,
      isCategorical: taskType === 'classification',
    },
    predictSingle: (inputs: Record<string, any>) => {
      const stdVec = vectorizeInput(inputs, true);
      const res = predictFn(stdVec);
      if (typeof res.predicted === 'number') {
        res.predicted = clampTargetValue(res.predicted, target);
      }
      return res;
    },
  };
}
