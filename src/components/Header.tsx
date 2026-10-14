import React from 'react';
import { Database, Sparkles, RefreshCw, Code2 } from 'lucide-react';

interface HeaderProps {
  activeTab: 'data' | 'features' | 'results' | 'predict';
  setActiveTab: (tab: 'data' | 'features' | 'results' | 'predict') => void;
  hasData: boolean;
  hasModel: boolean;
  onReset: () => void;
  onLoadSample: () => void;
  onOpenPythonModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  hasData,
  hasModel,
  onReset,
  onLoadSample,
  onOpenPythonModal,
}) => {
  return (
    <header className="bg-white border-b border-neutral-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-bold text-sm tracking-tight">
              ML
            </div>
            <span className="text-lg font-bold tracking-tight text-neutral-900 whitespace-nowrap">
              엑셀 머신러닝 스튜디오
            </span>
          </div>

          {/* Zone 2: Navigation steps with single-line controls */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => setActiveTab('data')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'data'
                  ? 'bg-neutral-100 text-neutral-900'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              1. 데이터 미리보기
            </button>
            <span className="text-neutral-300">/</span>

            <button
              onClick={() => hasData && setActiveTab('features')}
              disabled={!hasData}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                !hasData
                  ? 'text-neutral-300 cursor-not-allowed'
                  : activeTab === 'features'
                  ? 'bg-neutral-100 text-neutral-900'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              2. 변수 & 모델 설정
            </button>
            <span className="text-neutral-300">/</span>

            <button
              onClick={() => hasModel && setActiveTab('results')}
              disabled={!hasModel}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                !hasModel
                  ? 'text-neutral-300 cursor-not-allowed'
                  : activeTab === 'results'
                  ? 'bg-neutral-100 text-neutral-900'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              3. 학습 결과 & 정확도
            </button>
            <span className="text-neutral-300">/</span>

            <button
              onClick={() => hasModel && setActiveTab('predict')}
              disabled={!hasModel}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                !hasModel
                  ? 'text-neutral-300 cursor-not-allowed'
                  : activeTab === 'predict'
                  ? 'bg-neutral-100 text-neutral-900'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              4. 새 데이터 예측
            </button>
          </nav>

          {/* Zone 3: Primary Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {hasModel && (
              <button
                onClick={onOpenPythonModal}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors whitespace-nowrap"
                title="Python scikit-learn 코드 보기"
              >
                <Code2 className="w-3.5 h-3.5" />
                파이썬 코드
              </button>
            )}

            {!hasData ? (
              <button
                onClick={onLoadSample}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-md transition-colors whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                샘플 데이터로 시작
              </button>
            ) : (
              <button
                onClick={onReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-300 hover:border-neutral-400 rounded-md transition-colors whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                새 데이터 업로드
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
