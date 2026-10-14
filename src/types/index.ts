export type DataType = 'number' | 'string' | 'boolean' | 'date';

export type TaskType = 'regression' | 'classification';

export type AlgorithmType = 
  | 'linear_regression'
  | 'ridge_regression'
  | 'decision_tree_reg'
  | 'random_forest_reg'
  | 'knn_reg'
  | 'logistic_regression'
  | 'decision_tree_clf'
  | 'random_forest_clf'
  | 'knn_clf';

export interface ColumnProfile {
  name: string;
  type: DataType;
  missingCount: number;
  uniqueCount: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  std?: number;
  sampleValues: (string | number)[];
}

export interface ParsedDataset {
  fileName: string;
  sheetNames: string[];
  currentSheet: string;
  columns: string[];
  columnProfiles: Record<string, ColumnProfile>;
  rawRows: Record<string, any>[];
  cleanedRows: Record<string, any>[];
  droppedRowsCount: number;
}

export interface MLConfig {
  features: string[];
  target: string;
  taskType: TaskType;
  algorithm: AlgorithmType;
  testSplitRatio: number; // e.g. 0.2
  randomSeed: number;
  missingValueStrategy: 'drop' | 'mean';
  // Hyperparameters
  regularizationAlpha?: number;
  maxTreeDepth?: number;
  nNeighbors?: number;
}

export interface MetricSummary {
  trainAccuracy: number; // For reg: R2 score or % within tolerance; for clf: Accuracy (0-100)
  testAccuracy: number;
  trainR2?: number;
  testR2?: number;
  trainRMSE?: number;
  testRMSE?: number;
  trainMAE?: number;
  testMAE?: number;
  trainToleranceAccuracy?: number; // % of predictions within 15% tolerance
  testToleranceAccuracy?: number;
  // Classification metrics
  precision?: number;
  recall?: number;
  f1Score?: number;
  confusionMatrix?: {
    labels: string[];
    matrix: number[][];
  };
}

export interface DataPointPrediction {
  actual: number | string;
  predicted: number | string;
  residual?: number;
  isTest: boolean;
  rowId: number;
}

export interface FeatureImportance {
  feature: string;
  importance: number; // normalized or coefficient
  rawWeight?: number;
}

export interface TrainedModelResult {
  config: MLConfig;
  trainedAt: string;
  metrics: MetricSummary;
  predictions: DataPointPrediction[];
  featureImportance: FeatureImportance[];
  classLabels?: string[];
  excludedTargetRowsCount?: number;
  targetStats?: {
    min: number;
    max: number;
    mean: number;
    isCategorical: boolean;
  };
  predictSingle: (inputs: Record<string, any>) => {
    predicted: number | string;
    confidence?: number;
    probabilities?: Record<string, number>;
    contributions?: Record<string, number>;
  };
}
