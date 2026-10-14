import React, { useState } from 'react';
import { Header } from './components/Header';
import { DataUploadSection } from './components/DataUploadSection';
import { DataPreviewTable } from './components/DataPreviewTable';
import { FeatureSelector } from './components/FeatureSelector';
import { TrainingResults } from './components/TrainingResults';
import { PredictionPanel } from './components/PredictionPanel';
import { PythonExportModal } from './components/PythonExportModal';
import { MLConfig, ParsedDataset, TrainedModelResult } from './types';
import { trainModel } from './utils/mlEngine';
import { SLEEP_FATIGUE_CSV } from './utils/sampleData';
import { parseCSVString } from './utils/excelParser';
import { Sparkles, ArrowRight, PlayCircle, BarChart3, HelpCircle, Sliders } from 'lucide-react';

export default function App() {
  const [dataset, setDataset] = useState<ParsedDataset | null>(null);
  const [modelResult, setModelResult] = useState<TrainedModelResult | null>(null);
  const [activeTab, setActiveTab] = useState<'data' | 'features' | 'results' | 'predict'>('data');
  const [isTraining, setIsTraining] = useState(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [isPythonModalOpen, setIsPythonModalOpen] = useState(false);

  // Load sample dataset
  const handleLoadSample = () => {
    const parsed = parseCSVString(SLEEP_FATIGUE_CSV, '수면_카페인_피로도_데이터.csv');
    setDataset(parsed);
    setModelResult(null);
    setActiveTab('data');
  };

  const handleDatasetLoaded = (parsed: ParsedDataset) => {
    setDataset(parsed);
    setModelResult(null);
    setActiveTab('data');
  };

  const handleReset = () => {
    setDataset(null);
    setModelResult(null);
    setActiveTab('data');
  };

  const handleTrain = (config: MLConfig) => {
    if (!dataset) return;
    setIsTraining(true);
    setTrainingError(null);

    // Run slightly deferred for UI responsiveness
    setTimeout(() => {
      try {
        const result = trainModel(dataset.rawRows, config);
        setModelResult(result);
        setActiveTab('results');
      } catch (err: any) {
        setTrainingError(err.message || '모델 학습 중 오류가 발생했습니다.');
      } finally {
        setIsTraining(false);
      }
    }, 200);
  };

  return (
    <div className="min-h-screen bg-neutral-100/70 text-neutral-900 flex flex-col font-sans antialiased selection:bg-neutral-900 selection:text-white">
      {/* 3-Zone Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasData={!!dataset}
        hasModel={!!modelResult}
        onReset={handleReset}
        onLoadSample={handleLoadSample}
        onOpenPythonModal={() => setIsPythonModalOpen(true)}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {!dataset ? (
          /* Empty / Initial Landing State */
          <div className="space-y-8">
            {/* Hero Banner */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-10 shadow-xs text-center max-w-3xl mx-auto">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-2 block">
                NO-CODE TABULAR MACHINE LEARNING
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 text-balance mb-3">
                엑셀 데이터로 머신러닝 모델을 학습하고<br className="hidden sm:inline" /> 실시간으로 예측해보세요
              </h1>
              <p className="text-sm text-neutral-600 max-w-xl mx-auto mb-6 text-balance leading-relaxed">
                엑셀이나 CSV 파일을 업로드하면 데이터를 즉시 미리보고, 입력변수(X)와 정답변수(y)를 선택하여 선형회귀/랜덤포레스트 모델을 학습시킵니다. 훈련/테스트 정확도와 가중치를 확인하고 새 데이터를 넣어 바로 예측할 수 있습니다.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-all shadow-md hover:shadow-lg whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>수면-피로도 샘플 데이터로 즉시 체험</span>
                </button>
              </div>
            </div>

            {/* Workflow steps card */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
              <div className="p-4 bg-white border border-neutral-200 rounded-xl">
                <div className="text-xs font-mono font-bold text-neutral-400 mb-1">01</div>
                <h4 className="text-sm font-bold text-neutral-900 mb-1">데이터 미리보기</h4>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  .xlsx, .xls, .csv 파일을 읽어 컬럼별 통계치(최소, 최대, 평균)와 결측치를 검사합니다.
                </p>
              </div>

              <div className="p-4 bg-white border border-neutral-200 rounded-xl">
                <div className="text-xs font-mono font-bold text-neutral-400 mb-1">02</div>
                <h4 className="text-sm font-bold text-neutral-900 mb-1">변수 & 모델 설정</h4>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  원하는 입력변수(독립변수)와 정답(목표변수)을 선택하고 회귀 또는 분류 모델을 지정합니다.
                </p>
              </div>

              <div className="p-4 bg-white border border-neutral-200 rounded-xl">
                <div className="text-xs font-mono font-bold text-neutral-400 mb-1">03</div>
                <h4 className="text-sm font-bold text-neutral-900 mb-1">훈련 & 테스트 정확도</h4>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Train/Test 분할 후 훈련 정확도와 테스트 정확도(R², RMSE, MAE), 변수 중요도를 시각화합니다.
                </p>
              </div>

              <div className="p-4 bg-white border border-neutral-200 rounded-xl">
                <div className="text-xs font-mono font-bold text-neutral-400 mb-1">04</div>
                <h4 className="text-sm font-bold text-neutral-900 mb-1">새 데이터 예측</h4>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  슬라이더로 새 수치를 입력하면 즉시 예측 결과를 출력하며, 파일 일괄 예측도 지원합니다.
                </p>
              </div>
            </div>

            {/* Upload Zone */}
            <div className="max-w-4xl mx-auto">
              <DataUploadSection
                dataset={dataset}
                onDatasetLoaded={handleDatasetLoaded}
              />
            </div>
          </div>
        ) : (
          /* Active Workflow with Loaded Dataset */
          <div className="space-y-6">
            {/* Tab 1: Data Preview */}
            {activeTab === 'data' && (
              <div className="space-y-6">
                <DataPreviewTable
                  dataset={dataset}
                  onProceedToFeatures={() => setActiveTab('features')}
                />
              </div>
            )}

            {/* Tab 2: Feature & Target Selector */}
            {activeTab === 'features' && (
              <FeatureSelector
                dataset={dataset}
                onTrain={handleTrain}
                isTraining={isTraining}
                trainingError={trainingError}
              />
            )}

            {/* Tab 3: Model Evaluation Results */}
            {activeTab === 'results' && modelResult && (
              <TrainingResults
                modelResult={modelResult}
                onProceedToPredict={() => setActiveTab('predict')}
              />
            )}

            {/* Tab 4: New Data Prediction */}
            {activeTab === 'predict' && modelResult && (
              <PredictionPanel
                modelResult={modelResult}
                dataset={dataset}
              />
            )}
          </div>
        )}
      </main>

      {/* Python Export Modal */}
      {modelResult && (
        <PythonExportModal
          isOpen={isPythonModalOpen}
          onClose={() => setIsPythonModalOpen(false)}
          config={modelResult.config}
          fileName={dataset?.fileName || 'dataset.xlsx'}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-400 font-mono">
          <div>
            엑셀 머신러닝 스튜디오 · 브라우저 내 연산 및 시각화
          </div>
          <div className="flex items-center gap-4">
            <span>회귀 (Linear, Ridge, RF, KNN)</span>
            <span>·</span>
            <span>분류 (Logistic, RF, KNN)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
