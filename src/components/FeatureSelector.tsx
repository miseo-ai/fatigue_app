import React, { useState, useEffect } from 'react';
import { Settings, Play, Check, Sliders, Split, Sparkles, BrainCircuit, AlertCircle } from 'lucide-react';
import { AlgorithmType, MLConfig, ParsedDataset, TaskType } from '../types';

interface FeatureSelectorProps {
  dataset: ParsedDataset;
  onTrain: (config: MLConfig) => void;
  isTraining: boolean;
  trainingError: string | null;
}

export const FeatureSelector: React.FC<FeatureSelectorProps> = ({
  dataset,
  onTrain,
  isTraining,
  trainingError,
}) => {
  const { columns, columnProfiles } = dataset;

  // Guess target: prioritize common target words or last column
  const initialTarget = (() => {
    const candidates = ['피로점수(1~10)', '합격여부(1/0)', 'target', 'label', 'price', 'score', 'y'];
    for (const c of candidates) {
      const match = columns.find((col) => col.toLowerCase().includes(c.toLowerCase()));
      if (match) return match;
    }
    return columns[columns.length - 1] || '';
  })();

  const [target, setTarget] = useState<string>(initialTarget);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [taskType, setTaskType] = useState<TaskType>('regression');
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('linear_regression');
  const [testSplitRatio, setTestSplitRatio] = useState<number>(0.2);
  const [randomSeed, setRandomSeed] = useState<number>(42);
  const [missingValueStrategy, setMissingValueStrategy] = useState<'drop' | 'mean'>('drop');

  // Auto-detect task type and sensible features whenever target changes
  useEffect(() => {
    if (!target) return;
    const profile = columnProfiles[target];
    const isNum = profile?.type === 'number';
    const uniqueCount = profile?.uniqueCount || 0;

    let detectedTask: TaskType = 'regression';
    if (!isNum || uniqueCount <= 5) {
      detectedTask = 'classification';
    } else {
      detectedTask = 'regression';
    }
    setTaskType(detectedTask);

    if (detectedTask === 'regression') {
      setAlgorithm('linear_regression');
    } else {
      setAlgorithm('logistic_regression');
    }

    // Default select all other numeric or informative columns as features
    const feats = columns.filter((c) => {
      if (c === target) return false;
      if (c.toLowerCase().includes('id') || c.toLowerCase().includes('구분')) return false;
      return true;
    });

    // If no filtered, pick everything except target
    setSelectedFeatures(feats.length > 0 ? feats : columns.filter((c) => c !== target));
  }, [target, dataset]);

  const toggleFeature = (col: string) => {
    if (col === target) return;
    if (selectedFeatures.includes(col)) {
      setSelectedFeatures(selectedFeatures.filter((f) => f !== col));
    } else {
      setSelectedFeatures([...selectedFeatures, col]);
    }
  };

  const selectAllFeatures = () => {
    setSelectedFeatures(columns.filter((c) => c !== target));
  };

  const selectOnlyNumeric = () => {
    setSelectedFeatures(
      columns.filter((c) => c !== target && columnProfiles[c]?.type === 'number')
    );
  };

  const deselectAll = () => {
    setSelectedFeatures([]);
  };

  const handleStartTrain = () => {
    if (selectedFeatures.length === 0) return;
    const config: MLConfig = {
      features: selectedFeatures,
      target,
      taskType,
      algorithm,
      testSplitRatio,
      randomSeed,
      missingValueStrategy,
      regularizationAlpha: 1.0,
      maxTreeDepth: 6,
      nNeighbors: 5,
    };
    onTrain(config);
  };

  return (
    <div className="space-y-6">
      {/* Target & Task Type Configuration */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-200">
          <BrainCircuit className="w-5 h-5 text-neutral-800" />
          <h3 className="text-sm font-bold text-neutral-900">
            1. 정답변수(Target, y) 및 학습 유형 설정
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              정답변수 (예측하고자 하는 목표 컬럼)
            </label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 rounded-lg focus:outline-hidden focus:border-neutral-900 font-medium"
            >
              {columns.map((col) => {
                const p = columnProfiles[col];
                return (
                  <option key={col} value={col}>
                    {col} ({p?.type === 'number' ? '수치형' : '범주형'}, 고유값 {p?.uniqueCount}개)
                  </option>
                );
              })}
            </select>
            <p className="text-xs text-neutral-500 mt-1.5">
              선택한 정답 변수는 입력변수에서 제외되며, <strong>정답값이 비어 있는 행은 학습에서 자동으로 제외</strong>됩니다.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              분석 유형 (회귀 vs 분류)
            </label>
            <div className="flex items-center gap-2 p-1 bg-neutral-100 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setTaskType('regression');
                  setAlgorithm('linear_regression');
                }}
                className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${
                  taskType === 'regression'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                회귀 (Regression: 연속 수치 예측)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTaskType('classification');
                  setAlgorithm('logistic_regression');
                }}
                className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${
                  taskType === 'classification'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                분류 (Classification: 그룹/라벨 분류)
              </button>
            </div>
            <p className="text-xs text-neutral-500 mt-1.5">
              {taskType === 'regression'
                ? '피로점수, 주택가격 등 연속적인 숫자를 오차 기반으로 예측합니다.'
                : '합격/불합격(1/0) 등 범주형 레이블을 확률 기반으로 분류합니다.'}
            </p>
          </div>
        </div>
      </div>

      {/* Feature Selection (Input Variables X) */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-neutral-800" />
            <div>
              <h3 className="text-sm font-bold text-neutral-900">
                2. 입력변수(Features, X) 선택
              </h3>
              <p className="text-xs text-neutral-500">
                선택됨: <span className="font-mono font-semibold text-neutral-900">{selectedFeatures.length}</span> / {columns.length - 1}개
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={selectAllFeatures}
              className="px-2.5 py-1 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded transition-colors whitespace-nowrap"
            >
              전체 선택
            </button>
            <button
              type="button"
              onClick={selectOnlyNumeric}
              className="px-2.5 py-1 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded transition-colors whitespace-nowrap"
            >
              수치형만 선택
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className="px-2.5 py-1 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded transition-colors whitespace-nowrap"
            >
              선택 해제
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {columns.map((col) => {
            const isTarget = col === target;
            const isSelected = selectedFeatures.includes(col);
            const profile = columnProfiles[col];
            const isNum = profile?.type === 'number';

            if (isTarget) {
              return (
                <div
                  key={col}
                  className="p-3 rounded-lg border border-amber-300 bg-amber-50/50 flex items-center justify-between opacity-80"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-bold text-amber-900 truncate">
                      {col}
                    </div>
                    <div className="text-[11px] text-amber-700 mt-0.5">
                      정답변수로 지정됨
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-200/80 text-amber-900 rounded font-semibold whitespace-nowrap">
                    Target
                  </span>
                </div>
              );
            }

            return (
              <button
                key={col}
                type="button"
                onClick={() => toggleFeature(col)}
                className={`p-3 rounded-lg border text-left transition-all flex items-start justify-between gap-2 ${
                  isSelected
                    ? 'border-neutral-900 bg-neutral-900/5 ring-1 ring-neutral-900'
                    : 'border-neutral-200 bg-white hover:border-neutral-400'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-neutral-900 truncate">
                    {col}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 mt-1 font-mono tabular-nums">
                    <span>{isNum ? '수치형' : '범주형'}</span>
                    <span aria-hidden="true">·</span>
                    {isNum ? (
                      <span>평균 {profile?.mean}</span>
                    ) : (
                      <span>{profile?.uniqueCount}개 범주</span>
                    )}
                  </div>
                </div>

                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 ${
                    isSelected
                      ? 'bg-neutral-900 border-neutral-900 text-white'
                      : 'border-neutral-300 bg-white'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Model Algorithm & Split Configuration */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-200">
          <Settings className="w-5 h-5 text-neutral-800" />
          <h3 className="text-sm font-bold text-neutral-900">
            3. 머신러닝 알고리즘 및 검증 설정
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Algorithm selection */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              학습 알고리즘
            </label>
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value as AlgorithmType)}
              className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-hidden focus:border-neutral-900 font-medium"
            >
              {taskType === 'regression' ? (
                <>
                  <option value="linear_regression">선형 회귀 (Linear Regression, OLS)</option>
                  <option value="ridge_regression">릿지 회귀 (Ridge L2 Regularization)</option>
                  <option value="random_forest_reg">랜덤 포레스트 회귀 (Random Forest)</option>
                  <option value="decision_tree_reg">결정 트리 회귀 (Decision Tree)</option>
                  <option value="knn_reg">K-최근접 이웃 회귀 (KNN Regressor)</option>
                </>
              ) : (
                <>
                  <option value="logistic_regression">로지스틱 회귀 (Logistic Regression)</option>
                  <option value="random_forest_clf">랜덤 포레스트 분류기 (Random Forest)</option>
                  <option value="decision_tree_clf">결정 트리 분류기 (Decision Tree)</option>
                  <option value="knn_clf">K-최근접 이웃 분류기 (KNN Classifier)</option>
                </>
              )}
            </select>
            <p className="text-[11px] text-neutral-500 mt-1">
              {algorithm.includes('linear') || algorithm.includes('logistic')
                ? '변수별 영향도(가중치)를 명확하게 해석할 수 있는 선형 모델입니다.'
                : '비선형 패턴과 변수 간 복합 상호작용을 파악하는 트리 앙상블 모델입니다.'}
            </p>
          </div>

          {/* Train/Test Split */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-700 mb-1.5">
              <span>데이터 분할 비율 (Train / Test)</span>
              <span className="font-mono tabular-nums text-neutral-900 font-bold">
                {Math.round((1 - testSplitRatio) * 100)}% : {Math.round(testSplitRatio * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.4"
              step="0.05"
              value={testSplitRatio}
              onChange={(e) => setTestSplitRatio(parseFloat(e.target.value))}
              className="w-full accent-neutral-900 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-neutral-400 font-mono mt-1">
              <span>90:10 (대규모 데이터)</span>
              <span>80:20 (권장)</span>
              <span>60:40</span>
            </div>
          </div>

          {/* Missing value handling */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              결측치(빈값) 처리 방법
            </label>
            <select
              value={missingValueStrategy}
              onChange={(e) => setMissingValueStrategy(e.target.value as 'drop' | 'mean')}
              className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-hidden focus:border-neutral-900 font-medium"
            >
              <option value="drop">결측치 포함된 행 제외 (권장)</option>
              <option value="mean">수치형 평균값으로 자동 대체</option>
            </select>
            <p className="text-[11px] text-neutral-500 mt-1">
              데이터의 무결성을 위해 결측 행을 제거하거나 평균값으로 보정합니다.
            </p>
          </div>
        </div>
      </div>

      {trainingError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{trainingError}</span>
        </div>
      )}

      {/* Train Primary Action Button */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleStartTrain}
          disabled={isTraining || selectedFeatures.length === 0}
          className="inline-flex items-center gap-2 px-7 py-3 text-sm font-bold text-white bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed rounded-xl transition-all shadow-md hover:shadow-lg whitespace-nowrap"
        >
          {isTraining ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>모델 학습 진행 중...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>모델 학습 시작하기 ({selectedFeatures.length}개 변수)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
