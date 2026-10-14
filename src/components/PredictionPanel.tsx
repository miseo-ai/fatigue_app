import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Download,
  Upload,
  RotateCcw,
  Sliders,
  CheckCircle,
  FileSpreadsheet,
  AlertCircle,
  Activity,
} from 'lucide-react';
import { ParsedDataset, TrainedModelResult } from '../types';
import { exportToExcel, parseFileBuffer } from '../utils/excelParser';

interface PredictionPanelProps {
  modelResult: TrainedModelResult;
  dataset: ParsedDataset;
}

// Strict feature bounds definition based on user specification and dataset profile
export function getFeatureBounds(featName: string, columnProfile?: any): {
  min: number;
  max: number;
  step: number;
  unit: string;
} {
  const name = featName.toLowerCase();

  // 수면 3~10시간
  if (name.includes('수면')) {
    return { min: 3, max: 10, step: 0.5, unit: '시간' };
  }
  // 카페인 0~5잔
  if (name.includes('카페인')) {
    return { min: 0, max: 5, step: 1, unit: '잔' };
  }
  // 스마트폰 0~12시간
  if (name.includes('스마트폰')) {
    return { min: 0, max: 12, step: 0.5, unit: '시간' };
  }
  // 운동 0~120분
  if (name.includes('운동')) {
    return { min: 0, max: 120, step: 5, unit: '분' };
  }
  // 아침식사 0~1
  if (name.includes('아침')) {
    return { min: 0, max: 1, step: 1, unit: '(0 또는 1)' };
  }

  // Fallback to dataset profile min/max
  const min = columnProfile?.min !== undefined ? columnProfile.min : 0;
  const max = columnProfile?.max !== undefined ? columnProfile.max : 100;
  const span = max - min;
  const step = span <= 5 ? 0.5 : span <= 20 ? 1 : 5;
  return { min, max, step, unit: '' };
}

export const PredictionPanel: React.FC<PredictionPanelProps> = ({
  modelResult,
  dataset,
}) => {
  const { config, predictSingle, targetStats } = modelResult;
  const isRegression = config.taskType === 'regression';
  const isFatigueTarget = config.target.includes('피로') || config.target.includes('1~10');

  // Initialize input form with column means or bounds
  const [formInputs, setFormInputs] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    config.features.forEach((feat) => {
      const p = dataset.columnProfiles[feat];
      if (p?.type === 'number') {
        const bounds = getFeatureBounds(feat, p);
        const rawMean = p.mean ?? bounds.min;
        init[feat] = Math.min(bounds.max, Math.max(bounds.min, rawMean));
      } else {
        init[feat] = p?.sampleValues?.[0] ?? '';
      }
    });
    return init;
  });

  const [realtimePredict, setRealtimePredict] = useState(true);
  const [currentPrediction, setCurrentPrediction] = useState<any>(null);

  // Batch prediction state
  const [batchRows, setBatchRows] = useState<Record<string, any>[] | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);

  // Run prediction with clamping
  const runPrediction = (inputs: Record<string, any>) => {
    try {
      const res = predictSingle(inputs);
      if (typeof res.predicted === 'number' && isFatigueTarget) {
        res.predicted = Math.max(1, Math.min(10, res.predicted));
      }
      setCurrentPrediction(res);
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (realtimePredict) {
      runPrediction(formInputs);
    }
  }, [formInputs, realtimePredict]);

  const handleInputChange = (feat: string, val: any) => {
    const p = dataset.columnProfiles[feat];
    if (p?.type === 'number') {
      const bounds = getFeatureBounds(feat, p);
      if (val === '' || val === null || isNaN(val)) {
        setFormInputs((prev) => ({
          ...prev,
          [feat]: bounds.min,
        }));
        return;
      }
      const num = Number(val);
      // Strictly clamp within allowed data range
      const clamped = Math.min(bounds.max, Math.max(bounds.min, num));
      setFormInputs((prev) => ({
        ...prev,
        [feat]: clamped,
      }));
    } else {
      setFormInputs((prev) => ({
        ...prev,
        [feat]: val,
      }));
    }
  };

  const resetToAverages = () => {
    const resetVals: Record<string, any> = {};
    config.features.forEach((feat) => {
      const p = dataset.columnProfiles[feat];
      if (p?.type === 'number') {
        const bounds = getFeatureBounds(feat, p);
        const rawMean = p.mean ?? bounds.min;
        resetVals[feat] = Math.min(bounds.max, Math.max(bounds.min, rawMean));
      } else {
        resetVals[feat] = p?.sampleValues?.[0] ?? '';
      }
    });
    setFormInputs(resetVals);
  };

  // Preset scenarios respecting valid ranges
  const applyHealthyScenario = () => {
    const healthy: Record<string, any> = { ...formInputs };
    Object.keys(healthy).forEach((k) => {
      const lower = k.toLowerCase();
      if (lower.includes('수면')) healthy[k] = 8.5; // between 3~10
      else if (lower.includes('카페인')) healthy[k] = 0; // between 0~5
      else if (lower.includes('스마트폰')) healthy[k] = 1.0; // between 0~12
      else if (lower.includes('운동')) healthy[k] = 60; // between 0~120
      else if (lower.includes('아침')) healthy[k] = 1; // 1
      else if (lower.includes('공부')) healthy[k] = 20;
      else if (lower.includes('출석')) healthy[k] = 98;
    });
    setFormInputs(healthy);
  };

  const applyFatigueScenario = () => {
    const tired: Record<string, any> = { ...formInputs };
    Object.keys(tired).forEach((k) => {
      const lower = k.toLowerCase();
      if (lower.includes('수면')) tired[k] = 3.5; // between 3~10
      else if (lower.includes('카페인')) tired[k] = 4; // between 0~5
      else if (lower.includes('스마트폰')) tired[k] = 8.0; // between 0~12
      else if (lower.includes('운동')) tired[k] = 0; // between 0~120
      else if (lower.includes('아침')) tired[k] = 0; // 0
      else if (lower.includes('공부')) tired[k] = 4;
      else if (lower.includes('출석')) tired[k] = 60;
    });
    setFormInputs(tired);
  };

  // Handle batch file upload
  const handleBatchFile = async (file: File) => {
    setBatchError(null);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseFileBuffer(buffer, file.name);

      if (!parsed.rawRows || parsed.rawRows.length === 0) {
        throw new Error('파일에 데이터 행이 존재하지 않습니다.');
      }

      // Check if required features exist
      const missingFeats = config.features.filter((f) => !parsed.columns.includes(f));
      if (missingFeats.length > 0) {
        throw new Error(
          `업로드한 파일에 다음 필수 변수가 누락되었습니다: ${missingFeats.join(', ')}`
        );
      }

      // Predict for each row
      const predictedRows = parsed.rawRows.map((row) => {
        const rowInputs: Record<string, any> = {};
        config.features.forEach((f) => (rowInputs[f] = row[f]));
        const res = predictSingle(rowInputs);

        return {
          ...row,
          [`[예측_${config.target}]`]: res.predicted,
          ...(res.confidence !== undefined
            ? { [`[예측확률_%]`]: res.confidence }
            : {}),
        };
      });

      setBatchRows(predictedRows);
    } catch (err: any) {
      setBatchError(err.message || '배치 예측 처리 중 오류가 발생했습니다.');
    }
  };

  const handleDownloadBatch = () => {
    if (!batchRows) return;
    exportToExcel(batchRows, `일괄예측결과_${config.target}.xlsx`);
  };

  return (
    <div className="space-y-8">
      {/* Top Section: Single Sample Interactive Predictor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Controls Form (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-neutral-200 rounded-xl p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-neutral-200">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-neutral-800" />
              <div>
                <h3 className="text-sm font-bold text-neutral-900">
                  새 데이터 입력 폼 ({config.features.length}개 변수)
                </h3>
                <p className="text-xs text-neutral-500">
                  값을 조절하면 학습된 모델이 즉시 결과를 예측합니다.
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={applyHealthyScenario}
                className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded transition-colors whitespace-nowrap"
              >
                좋은 상태 프리셋
              </button>
              <button
                type="button"
                onClick={applyFatigueScenario}
                className="px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded transition-colors whitespace-nowrap"
              >
                나쁜 상태 프리셋
              </button>
              <button
                type="button"
                onClick={resetToAverages}
                className="p-1 text-neutral-500 hover:text-neutral-900 rounded hover:bg-neutral-100 transition-colors"
                title="평균값으로 초기화"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {config.features.map((feat) => {
              const p = dataset.columnProfiles[feat];
              const isNum = p?.type === 'number';
              const curVal = formInputs[feat];

              if (!isNum) {
                return (
                  <div key={feat} className="space-y-1">
                    <label className="block text-xs font-semibold text-neutral-700">
                      {feat}
                    </label>
                    <select
                      value={curVal || ''}
                      onChange={(e) => handleInputChange(feat, e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-hidden focus:border-neutral-900"
                    >
                      {p?.sampleValues.map((opt) => (
                        <option key={String(opt)} value={String(opt)}>
                          {String(opt)}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }

              // Numeric Slider + Number Input strictly bounded to data limits
              const bounds = getFeatureBounds(feat, p);
              const isBinary = bounds.min === 0 && bounds.max === 1;

              return (
                <div key={feat} className="p-3 bg-neutral-50 rounded-lg border border-neutral-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-neutral-800">
                        {feat}
                      </span>
                      <span className="ml-2 text-[10px] text-neutral-400 font-mono">
                        (허용범위: {bounds.min} ~ {bounds.max}{bounds.unit})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isBinary ? (
                        /* Binary Quick Toggle Buttons */
                        <div className="flex items-center gap-1 bg-white p-0.5 border border-neutral-200 rounded-md">
                          <button
                            type="button"
                            onClick={() => handleInputChange(feat, 0)}
                            className={`px-2 py-0.5 text-xs font-medium rounded ${
                              curVal === 0
                                ? 'bg-neutral-900 text-white font-bold'
                                : 'text-neutral-500 hover:text-neutral-900'
                            }`}
                          >
                            0 (안함)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInputChange(feat, 1)}
                            className={`px-2 py-0.5 text-xs font-medium rounded ${
                              curVal === 1
                                ? 'bg-neutral-900 text-white font-bold'
                                : 'text-neutral-500 hover:text-neutral-900'
                            }`}
                          >
                            1 (함)
                          </button>
                        </div>
                      ) : (
                        /* Strictly Clamped Number Input */
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={bounds.min}
                            max={bounds.max}
                            step={bounds.step}
                            value={curVal ?? bounds.min}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === '') {
                                handleInputChange(feat, bounds.min);
                              } else {
                                handleInputChange(feat, parseFloat(raw));
                              }
                            }}
                            onBlur={(e) => {
                              const raw = parseFloat(e.target.value);
                              if (isNaN(raw)) {
                                handleInputChange(feat, bounds.min);
                              } else {
                                handleInputChange(
                                  feat,
                                  Math.min(bounds.max, Math.max(bounds.min, raw))
                                );
                              }
                            }}
                            className="w-20 px-2 py-0.5 text-xs font-mono font-bold text-right bg-white border border-neutral-300 rounded focus:outline-hidden focus:border-neutral-900 tabular-nums"
                          />
                          {bounds.unit && (
                            <span className="text-[11px] text-neutral-500 font-mono">
                              {bounds.unit}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-neutral-400 font-mono tabular-nums w-10">
                      {bounds.min}{bounds.unit}
                    </span>
                    <input
                      type="range"
                      min={bounds.min}
                      max={bounds.max}
                      step={bounds.step}
                      value={curVal ?? bounds.min}
                      onChange={(e) =>
                        handleInputChange(feat, parseFloat(e.target.value))
                      }
                      className="flex-1 accent-neutral-900 cursor-pointer"
                    />
                    <span className="text-[10px] text-neutral-400 font-mono tabular-nums w-10 text-right">
                      {bounds.max}{bounds.unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Prediction Output Visual Card (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-white border-2 border-neutral-900 rounded-xl p-6 shadow-sm flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
                <span>예측 결과 (Model Output)</span>
                <span className="text-neutral-400 font-mono">
                  목표: {config.target}
                </span>
              </div>

              {currentPrediction ? (
                <div className="py-4 text-center">
                  <div className="text-xs text-neutral-500 mb-1">
                    현재 입력 조건에 따른 모델 예측치
                  </div>
                  <div className="text-5xl font-black text-neutral-900 font-mono tabular-nums tracking-tight my-2">
                    {currentPrediction.predicted}
                    {isRegression && (
                      <span className="text-xl font-normal text-neutral-400 ml-1">
                        {isFatigueTarget ? '점' : ''}
                      </span>
                    )}
                  </div>

                  {/* Fatigue Score 1~10 Range Status & Visual Meter */}
                  {isFatigueTarget && (
                    <div className="mt-3 px-2">
                      <div className="flex justify-between text-[10px] font-mono text-neutral-400 mb-1">
                        <span>1 (가뿐함)</span>
                        <span>5 (보통)</span>
                        <span>10 (극심한 피로)</span>
                      </div>
                      <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden p-0.5 border border-neutral-200">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            Number(currentPrediction.predicted) <= 3
                              ? 'bg-emerald-500'
                              : Number(currentPrediction.predicted) <= 6
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{
                            width: `${Math.max(
                              4,
                              Math.min(
                                100,
                                ((Number(currentPrediction.predicted) - 1) / 9) * 100
                              )
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-2 flex items-center justify-center gap-1.5 font-mono">
                        <span className="font-semibold text-neutral-700">
                          피로점수 범위: 1점 ~ 10점
                        </span>
                        <span className="text-neutral-300">·</span>
                        <span className="text-neutral-500">
                          {Number(currentPrediction.predicted) <= 1
                            ? '(최소 1점으로 제한됨)'
                            : Number(currentPrediction.predicted) >= 10
                            ? '(최대 10점으로 제한됨)'
                            : '(정상 범위 내 예측)'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Classification Confidence */}
                  {currentPrediction.confidence !== undefined && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full text-xs font-semibold font-mono tabular-nums">
                      <CheckCircle className="w-3.5 h-3.5" />
                      신뢰도: {currentPrediction.confidence}%
                    </div>
                  )}

                  {/* Class Probabilities */}
                  {currentPrediction.probabilities && (
                    <div className="mt-6 space-y-2 text-left">
                      <div className="text-xs font-semibold text-neutral-600 mb-1">
                        클래스별 예측 확률:
                      </div>
                      {Object.entries(currentPrediction.probabilities).map(
                        ([label, prob]: [string, any]) => (
                          <div key={label} className="space-y-1">
                            <div className="flex justify-between text-xs font-mono">
                              <span className="font-medium text-neutral-700">{label}</span>
                              <span className="tabular-nums font-bold text-neutral-900">{prob}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-neutral-900 rounded-full transition-all"
                                style={{ width: `${prob}%` }}
                              />
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {/* Feature Contributions for Linear Regression */}
                  {currentPrediction.contributions && (
                    <div className="mt-6 pt-4 border-t border-neutral-200 text-left">
                      <div className="text-xs font-semibold text-neutral-700 mb-2">
                        주요 변수별 예측 기여도:
                      </div>
                      <div className="space-y-1.5 text-xs font-mono tabular-nums">
                        {Object.entries(currentPrediction.contributions)
                          .slice(0, 4)
                          .map(([feat, contrib]: [string, any]) => {
                            const isPos = contrib >= 0;
                            return (
                              <div
                                key={feat}
                                className="flex items-center justify-between py-0.5 text-neutral-600"
                              >
                                <span className="truncate max-w-[180px]">{feat}</span>
                                <span
                                  className={`font-semibold ${
                                    isPos ? 'text-blue-600' : 'text-rose-600'
                                  }`}
                                >
                                  {isPos ? `+${contrib}` : contrib}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-neutral-400 text-xs">
                  입력값을 설정하고 예측 버튼을 클릭하세요.
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={realtimePredict}
                  onChange={(e) => setRealtimePredict(e.target.checked)}
                  className="rounded border-neutral-300 text-neutral-900 focus:ring-0"
                />
                <span>슬라이더 조작 시 실시간 예측</span>
              </label>

              {!realtimePredict && (
                <button
                  type="button"
                  onClick={() => runPrediction(formInputs)}
                  className="px-3 py-1.5 bg-neutral-900 text-white rounded font-medium hover:bg-neutral-800 transition-colors"
                >
                  지금 예측하기
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Batch File Prediction & Download */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-neutral-200">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-neutral-800" />
              <h3 className="text-sm font-bold text-neutral-900">
                대량 엑셀 파일 일괄 예측 (Batch Prediction)
              </h3>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              동일한 입력 변수가 포함된 새로운 엑셀/CSV 파일을 올리면 수천 행의 결과를 한 번에 계산하고 다운로드할 수 있습니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={batchFileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleBatchFile(e.target.files[0]);
                }
              }}
              accept=".xlsx, .xls, .csv"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => batchFileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              새 파일 업로드하여 일괄 예측
            </button>
            {batchRows && (
              <button
                type="button"
                onClick={handleDownloadBatch}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                결과 엑셀(.xlsx) 다운로드
              </button>
            )}
          </div>
        </div>

        {batchError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-xs mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{batchError}</span>
          </div>
        )}

        {batchRows ? (
          <div className="overflow-x-auto border border-neutral-200 rounded-lg">
            <table className="w-full text-left text-xs font-mono tabular-nums">
              <thead className="bg-neutral-100 text-neutral-700 text-[11px] font-semibold border-b border-neutral-200">
                <tr>
                  <th className="py-2 px-3 text-center w-10">#</th>
                  {config.features.map((f) => (
                    <th key={f} className="py-2 px-3 whitespace-nowrap">
                      {f}
                    </th>
                  ))}
                  <th className="py-2 px-3 bg-neutral-900 text-white font-bold whitespace-nowrap">
                    예측_{config.target}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {batchRows.slice(0, 5).map((row, idx) => (
                  <tr key={idx} className="hover:bg-neutral-50">
                    <td className="py-1.5 px-3 text-center text-neutral-400">
                      {idx + 1}
                    </td>
                    {config.features.map((f) => (
                      <td key={f} className="py-1.5 px-3 text-neutral-800 whitespace-nowrap">
                        {String(row[f] ?? '')}
                      </td>
                    ))}
                    <td className="py-1.5 px-3 font-bold text-emerald-600 bg-emerald-50/40 whitespace-nowrap">
                      {String(row[`[예측_${config.target}]`])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-2 text-center text-xs text-neutral-500 bg-neutral-50">
              총 {batchRows.length}개 행 중 상위 5개 미리보기 (전체 데이터는 엑셀 다운로드로 확인 가능)
            </div>
          </div>
        ) : (
          <div className="p-6 text-center border border-dashed border-neutral-200 rounded-lg text-neutral-400 text-xs">
            신규 환자, 학생, 또는 내일 일정 데이터를 담은 엑셀 파일을 업로드하면 즉시 일괄 예측표를 생성합니다.
          </div>
        )}
      </div>
    </div>
  );
};
