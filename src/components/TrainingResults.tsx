import React, { useState } from 'react';
import {
  TrendingUp,
  Target,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  Layers,
  Activity,
  Info,
} from 'lucide-react';
import { TrainedModelResult } from '../types';

interface TrainingResultsProps {
  modelResult: TrainedModelResult;
  onProceedToPredict: () => void;
}

export const TrainingResults: React.FC<TrainingResultsProps> = ({
  modelResult,
  onProceedToPredict,
}) => {
  const { metrics, config, featureImportance, predictions } = modelResult;
  const isRegression = config.taskType === 'regression';

  const [hoveredPoint, setHoveredPoint] = useState<{
    actual: number | string;
    predicted: number | string;
    residual?: number;
    isTest: boolean;
    rowId: number;
    x: number;
    y: number;
  } | null>(null);

  // Helper for algorithm label
  const algoLabel = {
    linear_regression: '선형 회귀 (Linear Regression)',
    ridge_regression: '릿지 회귀 (Ridge L2 Regularization)',
    random_forest_reg: '랜덤 포레스트 회귀 (Random Forest)',
    decision_tree_reg: '결정 트리 회귀 (Decision Tree)',
    knn_reg: 'K-최근접 이웃 회귀 (KNN Regressor)',
    logistic_regression: '로지스틱 회귀 (Logistic Regression)',
    random_forest_clf: '랜덤 포레스트 분류기 (Random Forest)',
    decision_tree_clf: '결정 트리 분류기 (Decision Tree)',
    knn_clf: 'K-최근접 이웃 분류기 (KNN Classifier)',
  }[config.algorithm] || config.algorithm;

  // Scatter plot calculations
  const numericPoints = isRegression
    ? predictions.map((p) => ({
        actual: Number(p.actual),
        predicted: Number(p.predicted),
        residual: p.residual,
        isTest: p.isTest,
        rowId: p.rowId,
      }))
    : [];

  const minVal = isRegression && numericPoints.length > 0
    ? Math.min(...numericPoints.map((p) => Math.min(p.actual, p.predicted)))
    : 0;
  const maxVal = isRegression && numericPoints.length > 0
    ? Math.max(...numericPoints.map((p) => Math.max(p.actual, p.predicted)))
    : 10;
  const span = Math.max(1, maxVal - minVal);
  const plotMin = Math.floor(minVal - span * 0.05);
  const plotMax = Math.ceil(maxVal + span * 0.05);
  const plotSpan = Math.max(1, plotMax - plotMin);

  // SVG dimensions
  const svgWidth = 520;
  const svgHeight = 340;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 40;

  const toSvgX = (val: number) => {
    return padLeft + ((val - plotMin) / plotSpan) * (svgWidth - padLeft - padRight);
  };
  const toSvgY = (val: number) => {
    return svgHeight - padBottom - ((val - plotMin) / plotSpan) * (svgHeight - padTop - padBottom);
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h3 className="text-base font-bold text-neutral-900">
                모델 학습 완료: {algoLabel}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 mt-1 font-mono tabular-nums">
              <span>정답변수: <strong className="text-neutral-800">{config.target}</strong></span>
              <span aria-hidden="true">·</span>
              <span>입력변수 {config.features.length}개</span>
              <span aria-hidden="true">·</span>
              <span>데이터 분할 {Math.round((1 - config.testSplitRatio) * 100)}% / {Math.round(config.testSplitRatio * 100)}%</span>
              {modelResult.excludedTargetRowsCount !== undefined && modelResult.excludedTargetRowsCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    정답 빈값 {modelResult.excludedTargetRowsCount}행 학습 자동 제외
                  </span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onProceedToPredict}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors whitespace-nowrap shadow-xs"
          >
            <span>새 데이터 입력하여 예측하기</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main KPI Strip: 훈련 정확도 vs 테스트 정확도 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 훈련 정확도 */}
        <div className="p-4 bg-white border border-neutral-200 rounded-xl">
          <div className="text-xs font-semibold text-neutral-500 mb-1">
            훈련 정확도 (Train Accuracy)
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-neutral-900 font-mono tabular-nums">
              {metrics.trainAccuracy}%
            </span>
            {isRegression && (
              <span className="text-xs text-neutral-500 font-mono">
                (R²: {metrics.trainR2})
              </span>
            )}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            학습에 사용된 데이터에 대한 설명력
          </div>
        </div>

        {/* 테스트 정확도 */}
        <div className="p-4 bg-white border border-neutral-200 rounded-xl border-l-neutral-900">
          <div className="text-xs font-semibold text-neutral-500 mb-1">
            테스트 정확도 (Test Accuracy)
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600 font-mono tabular-nums">
              {metrics.testAccuracy}%
            </span>
            {isRegression && (
              <span className="text-xs text-neutral-500 font-mono">
                (R²: {metrics.testR2})
              </span>
            )}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            처음 보는 검증 데이터에 대한 일반화 정확도
          </div>
        </div>

        {/* Error or Precision metric */}
        {isRegression ? (
          <>
            <div className="p-4 bg-white border border-neutral-200 rounded-xl">
              <div className="text-xs font-semibold text-neutral-500 mb-1">
                평균 제곱근 오차 (Test RMSE)
              </div>
              <div className="text-3xl font-extrabold text-neutral-900 font-mono tabular-nums">
                {metrics.testRMSE}
              </div>
              <div className="text-[11px] text-neutral-400 mt-1 font-mono tabular-nums">
                Train: {metrics.trainRMSE} · 낮을수록 우수
              </div>
            </div>

            <div className="p-4 bg-white border border-neutral-200 rounded-xl">
              <div className="text-xs font-semibold text-neutral-500 mb-1">
                평균 절대 오차 (Test MAE)
              </div>
              <div className="text-3xl font-extrabold text-neutral-900 font-mono tabular-nums">
                {metrics.testMAE}
              </div>
              <div className="text-[11px] text-neutral-400 mt-1 font-mono tabular-nums">
                Train: {metrics.trainMAE} · 오차 크기 단위
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="p-4 bg-white border border-neutral-200 rounded-xl">
              <div className="text-xs font-semibold text-neutral-500 mb-1">
                정밀도 (Precision)
              </div>
              <div className="text-3xl font-extrabold text-neutral-900 font-mono tabular-nums">
                {metrics.precision}%
              </div>
              <div className="text-[11px] text-neutral-400 mt-1">
                양성으로 예측한 것 중 실제 정답 비율
              </div>
            </div>

            <div className="p-4 bg-white border border-neutral-200 rounded-xl">
              <div className="text-xs font-semibold text-neutral-500 mb-1">
                F1-Score (조화 평균)
              </div>
              <div className="text-3xl font-extrabold text-neutral-900 font-mono tabular-nums">
                {metrics.f1Score}%
              </div>
              <div className="text-[11px] text-neutral-400 mt-1 font-mono tabular-nums">
                재현율(Recall): {metrics.recall}%
              </div>
            </div>
          </>
        )}
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Chart: Actual vs Predicted Scatter Plot or Confusion Matrix */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-neutral-200">
            <div>
              <h4 className="text-sm font-bold text-neutral-900">
                {isRegression
                  ? '실제값 vs 예측값 산점도 (Actual vs Predicted)'
                  : '검증 데이터 혼동 행렬 (Confusion Matrix)'}
              </h4>
              <p className="text-xs text-neutral-500">
                {isRegression
                  ? '대각선(점선)에 점들이 가까울수록 모델 예측이 정확합니다.'
                  : '실제 클래스와 예측 클래스의 정합도를 나타냅니다.'}
              </p>
            </div>

            {isRegression && (
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-neutral-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                  훈련(Train)
                </span>
                <span className="flex items-center gap-1.5 text-neutral-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  검증(Test)
                </span>
              </div>
            )}
          </div>

          {isRegression ? (
            <div className="relative flex justify-center overflow-x-auto py-2">
              <svg
                width={svgWidth}
                height={svgHeight}
                className="select-none bg-neutral-50/50 rounded-lg border border-neutral-100"
              >
                {/* Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                  const val = plotMin + pct * plotSpan;
                  const x = toSvgX(val);
                  const y = toSvgY(val);
                  return (
                    <g key={i}>
                      <line
                        x1={x}
                        y1={padTop}
                        x2={x}
                        y2={svgHeight - padBottom}
                        stroke="#e5e7eb"
                        strokeDasharray="2,2"
                      />
                      <line
                        x1={padLeft}
                        y1={y}
                        x2={svgWidth - padRight}
                        y2={y}
                        stroke="#e5e7eb"
                        strokeDasharray="2,2"
                      />
                      <text
                        x={x}
                        y={svgHeight - padBottom + 16}
                        fontSize="10"
                        fill="#9ca3af"
                        textAnchor="middle"
                        className="font-mono tabular-nums"
                      >
                        {val.toFixed(0)}
                      </text>
                      <text
                        x={padLeft - 8}
                        y={y + 3}
                        fontSize="10"
                        fill="#9ca3af"
                        textAnchor="end"
                        className="font-mono tabular-nums"
                      >
                        {val.toFixed(0)}
                      </text>
                    </g>
                  );
                })}

                {/* 45 degree perfect prediction line */}
                <line
                  x1={toSvgX(plotMin)}
                  y1={toSvgY(plotMin)}
                  x2={toSvgX(plotMax)}
                  y2={toSvgY(plotMax)}
                  stroke="#9ca3af"
                  strokeWidth="1.5"
                  strokeDasharray="4,4"
                />

                {/* Scatter Data Points */}
                {numericPoints.map((pt, i) => {
                  const cx = toSvgX(pt.actual);
                  const cy = toSvgY(pt.predicted);
                  const isTest = pt.isTest;
                  return (
                    <circle
                      key={i}
                      cx={cx}
                      cy={cy}
                      r={isTest ? 4.5 : 3.5}
                      fill={isTest ? '#10b981' : '#3b82f6'}
                      opacity={isTest ? 0.9 : 0.6}
                      className="cursor-pointer transition-all hover:scale-150 hover:stroke-2 hover:stroke-neutral-900"
                      onMouseEnter={() =>
                        setHoveredPoint({
                          ...pt,
                          x: cx,
                          y: cy,
                        })
                      }
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                  );
                })}

                {/* Axis Labels */}
                <text
                  x={svgWidth / 2}
                  y={svgHeight - 8}
                  fontSize="11"
                  fill="#4b5563"
                  textAnchor="middle"
                  className="font-medium"
                >
                  실제 정답값 (Actual {config.target})
                </text>
                <text
                  x={12}
                  y={svgHeight / 2}
                  fontSize="11"
                  fill="#4b5563"
                  textAnchor="middle"
                  transform={`rotate(-90, 12, ${svgHeight / 2})`}
                  className="font-medium"
                >
                  모델 예측값 (Predicted)
                </text>
              </svg>

              {/* Tooltip */}
              {hoveredPoint && (
                <div
                  className="absolute z-10 px-3 py-2 bg-neutral-900 text-white rounded-lg shadow-lg text-xs pointer-events-none font-mono tabular-nums"
                  style={{
                    left: `${Math.min(svgWidth - 120, Math.max(10, hoveredPoint.x + 10))}px`,
                    top: `${Math.max(10, hoveredPoint.y - 45)}px`,
                  }}
                >
                  <div className="font-semibold text-neutral-300">
                    {hoveredPoint.isTest ? '[검증 데이터]' : '[학습 데이터]'} 행 #{hoveredPoint.rowId}
                  </div>
                  <div>실제값: {hoveredPoint.actual}</div>
                  <div>예측값: {hoveredPoint.predicted}</div>
                  {hoveredPoint.residual !== undefined && (
                    <div className="text-amber-300">
                      오차(잔차): {hoveredPoint.residual > 0 ? `+${hoveredPoint.residual}` : hoveredPoint.residual}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Confusion Matrix Heatmap */
            <div className="py-6 flex flex-col items-center">
              {metrics.confusionMatrix ? (
                <div className="w-full max-w-sm">
                  <div className="text-center text-xs font-semibold text-neutral-600 mb-2">
                    예측 클래스 (Predicted)
                  </div>
                  <div className="grid grid-cols-2 gap-2 font-mono">
                    {metrics.confusionMatrix.matrix.map((row, rIdx) =>
                      row.map((count, cIdx) => {
                        const isCorrect = rIdx === cIdx;
                        return (
                          <div
                            key={`${rIdx}-${cIdx}`}
                            className={`p-4 rounded-lg border text-center ${
                              isCorrect
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                : 'bg-neutral-50 border-neutral-200 text-neutral-700'
                            }`}
                          >
                            <div className="text-[11px] text-neutral-500 mb-1">
                              실제: {metrics.confusionMatrix?.labels[rIdx]} / 예측: {metrics.confusionMatrix?.labels[cIdx]}
                            </div>
                            <div className="text-2xl font-bold tabular-nums">
                              {count}건
                            </div>
                            <div className="text-[10px] text-neutral-400 mt-1">
                              {isCorrect ? '정답 일치' : '오분류'}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-neutral-400 text-xs">혼동 행렬을 계산할 수 없습니다.</div>
              )}
            </div>
          )}
        </div>

        {/* Right Chart: Feature Importance (변수 중요도 / 가중치) */}
        <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs flex flex-col">
          <div className="mb-4 pb-2 border-b border-neutral-200">
            <h4 className="text-sm font-bold text-neutral-900">
              변수 중요도 및 영향력 분석 (Feature Importance)
            </h4>
            <p className="text-xs text-neutral-500">
              어떤 입력 변수가 정답값({config.target}) 결정에 가장 큰 영향을 미치는지 보여줍니다.
            </p>
          </div>

          <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[300px] pr-2">
            {featureImportance.map((item, idx) => {
              const pct = Math.round(item.importance * 100);
              const isPositive = item.rawWeight !== undefined && item.rawWeight >= 0;
              const hasWeight = item.rawWeight !== undefined;

              return (
                <div key={item.feature} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-neutral-800 truncate max-w-xs">
                      {idx + 1}. {item.feature}
                    </span>
                    <div className="flex items-center gap-2 font-mono tabular-nums text-neutral-600">
                      {hasWeight && (
                        <span
                          className={`text-[11px] ${
                            isPositive ? 'text-blue-600' : 'text-rose-600'
                          }`}
                        >
                          {isPositive ? `+${item.rawWeight}` : `${item.rawWeight}`}
                        </span>
                      )}
                      <span className="font-bold text-neutral-900">{pct}%</span>
                    </div>
                  </div>

                  <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        hasWeight
                          ? isPositive
                            ? 'bg-blue-600'
                            : 'bg-rose-500'
                          : 'bg-neutral-900'
                      }`}
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Explanation footnote */}
          <div className="mt-4 pt-3 border-t border-neutral-200 text-xs text-neutral-500 flex items-start gap-2">
            <Info className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
            <p>
              {isRegression && config.algorithm.includes('linear')
                ? '파란색(+): 해당 변수가 증가할수록 목표값이 증가함 / 붉은색(-): 변수가 증가할수록 목표값이 감소함을 의미합니다.'
                : '상위 변수일수록 모델이 예측을 수행할 때 가장 결정적인 기준점으로 작용합니다.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
