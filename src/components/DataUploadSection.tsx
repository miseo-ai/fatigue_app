import React, { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { SLEEP_FATIGUE_CSV, SECONDARY_SAMPLE_CSV } from '../utils/sampleData';
import { parseCSVString, parseFileBuffer } from '../utils/excelParser';
import { ParsedDataset } from '../types';

interface DataUploadSectionProps {
  onDatasetLoaded: (dataset: ParsedDataset) => void;
  dataset: ParsedDataset | null;
}

export const DataUploadSection: React.FC<DataUploadSectionProps> = ({
  onDatasetLoaded,
  dataset,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
        throw new Error('지원되는 파일 형식은 .xlsx, .xls, .csv 입니다.');
      }

      if (ext === 'csv') {
        const text = await file.text();
        const parsed = parseCSVString(text, file.name);
        onDatasetLoaded(parsed);
      } else {
        const buffer = await file.arrayBuffer();
        const parsed = parseFileBuffer(buffer, file.name);
        onDatasetLoaded(parsed);
      }
    } catch (err: any) {
      setErrorMsg(err.message || '파일을 읽는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const loadPromptSample = () => {
    setIsLoading(true);
    setTimeout(() => {
      const parsed = parseCSVString(SLEEP_FATIGUE_CSV, '수면_카페인_피로도_데이터.csv');
      onDatasetLoaded(parsed);
      setIsLoading(false);
    }, 150);
  };

  const loadExamSample = () => {
    setIsLoading(true);
    setTimeout(() => {
      const parsed = parseCSVString(SECONDARY_SAMPLE_CSV, '학생_학습_합격예측_데이터.csv');
      onDatasetLoaded(parsed);
      setIsLoading(false);
    }, 150);
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-150 ${
          isDragging
            ? 'border-neutral-900 bg-neutral-50 scale-[0.99]'
            : 'border-neutral-300 hover:border-neutral-400 bg-white'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFile(e.target.files[0]);
            }
          }}
          accept=".xlsx, .xls, .csv"
          className="hidden"
        />

        <div className="flex flex-col items-center max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-700 mb-4">
            <UploadCloud className="w-7 h-7" />
          </div>

          <h3 className="text-base font-semibold text-neutral-900 mb-1">
            엑셀 또는 CSV 파일을 드래그하여 업로드
          </h3>
          <p className="text-xs text-neutral-500 mb-6">
            .xlsx, .xls, .csv 형식을 지원합니다 (헤더 행이 포함된 표 형태 권장)
          </p>

          <button
            type="button"
            className="px-4 py-2 text-xs font-semibold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors"
          >
            내 컴퓨터에서 파일 선택
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Preset Sample Datasets */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div>
            <h4 className="text-sm font-semibold text-neutral-900">
              실습용 샘플 데이터셋으로 바로 시작하기
            </h4>
            <p className="text-xs text-neutral-500 mt-0.5">
              별도의 파일이 없어도 즉시 준비된 데이터로 모델 학습과 예측을 테스트할 수 있습니다.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Preset 1: User's exact prompt dataset */}
          <button
            type="button"
            onClick={loadPromptSample}
            disabled={isLoading}
            className="flex items-start gap-3 p-4 bg-white border border-neutral-200 hover:border-neutral-400 rounded-lg text-left transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900 group-hover:text-emerald-700">
                  수면 & 피로도 데이터 (사용자 데이터셋)
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                수면시간, 카페인, 스마트폰, 운동, 아침식사로 피로점수(1~10)를 예측하는 180행 데이터셋
              </p>
              <div className="flex items-center gap-2 text-xs text-neutral-400 mt-2 font-mono tabular-nums">
                <span>180행</span>
                <span aria-hidden="true">·</span>
                <span>7개 컬럼</span>
                <span aria-hidden="true">·</span>
                <span>회귀/분류 가능</span>
              </div>
            </div>
          </button>

          {/* Preset 2: Student Exam dataset */}
          <button
            type="button"
            onClick={loadExamSample}
            disabled={isLoading}
            className="flex items-start gap-3 p-4 bg-white border border-neutral-200 hover:border-neutral-400 rounded-lg text-left transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900 group-hover:text-blue-700">
                  학습시간 & 합격 여부 데이터
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                공부시간, 출석률, 과제제출률, 모의고사 점수로 최종 합격 여부(1/0) 분류
              </p>
              <div className="flex items-center gap-2 text-xs text-neutral-400 mt-2 font-mono tabular-nums">
                <span>20행</span>
                <span aria-hidden="true">·</span>
                <span>7개 컬럼</span>
                <span aria-hidden="true">·</span>
                <span>이진 분류</span>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
