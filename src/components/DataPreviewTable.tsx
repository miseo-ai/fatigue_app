import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, Hash, Type, AlertTriangle, ArrowRight, TableProperties } from 'lucide-react';
import { ParsedDataset } from '../types';

interface DataPreviewTableProps {
  dataset: ParsedDataset;
  onProceedToFeatures: () => void;
  onSheetChange?: (sheetName: string) => void;
}

export const DataPreviewTable: React.FC<DataPreviewTableProps> = ({
  dataset,
  onProceedToFeatures,
  onSheetChange,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  // Filter and sort rows
  const filteredRows = useMemo(() => {
    let rows = dataset.rawRows;

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((r) =>
        Object.values(r).some((val) =>
          String(val ?? '').toLowerCase().includes(term)
        )
      );
    }

    if (sortCol) {
      rows = [...rows].sort((a, b) => {
        const valA = a[sortCol];
        const valB = b[sortCol];

        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortAsc ? valA - valB : valB - valA;
        }
        return sortAsc
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    return rows;
  }, [dataset.rawRows, searchTerm, sortCol, sortAsc]);

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  const totalMissing = Object.values(dataset.columnProfiles).reduce(
    (sum, p) => sum + p.missingCount,
    0
  );

  return (
    <div className="space-y-6">
      {/* Dataset Summary Strip */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-800">
              <TableProperties className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-neutral-900 truncate max-w-xs sm:max-w-md">
                  {dataset.fileName}
                </h3>
                {dataset.sheetNames.length > 1 && (
                  <select
                    value={dataset.currentSheet}
                    onChange={(e) => onSheetChange && onSheetChange(e.target.value)}
                    className="text-xs font-medium border border-neutral-300 rounded px-2 py-0.5 bg-white text-neutral-800"
                  >
                    {dataset.sheetNames.map((sheet) => (
                      <option key={sheet} value={sheet}>
                        시트: {sheet}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-500 mt-1 font-mono tabular-nums">
                <span>총 {dataset.rawRows.length.toLocaleString()}행</span>
                <span aria-hidden="true">·</span>
                <span>{dataset.columns.length}개 변수(컬럼)</span>
                <span aria-hidden="true">·</span>
                {totalMissing > 0 ? (
                  <span className="text-amber-600 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 inline" />
                    결측치 {totalMissing}개 감지
                  </span>
                ) : (
                  <span className="text-neutral-500">결측치 없음 (완전한 데이터)</span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onProceedToFeatures}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors whitespace-nowrap shadow-xs"
          >
            <span>변수 및 모델 설정으로 이동</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Column Schema Profiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {dataset.columns.map((col) => {
          const profile = dataset.columnProfiles[col];
          const isNum = profile?.type === 'number';

          return (
            <div
              key={col}
              className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-left"
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-xs font-bold text-neutral-900 truncate" title={col}>
                  {col}
                </span>
                {isNum ? (
                  <span className="text-[10px] text-neutral-600 font-mono flex items-center gap-0.5">
                    <Hash className="w-3 h-3" />
                    수치
                  </span>
                ) : (
                  <span className="text-[10px] text-neutral-600 font-mono flex items-center gap-0.5">
                    <Type className="w-3 h-3" />
                    문자
                  </span>
                )}
              </div>

              {isNum ? (
                <div className="text-[11px] text-neutral-500 space-y-0.5 font-mono tabular-nums">
                  <div>범위: {profile.min} ~ {profile.max}</div>
                  <div>평균: {profile.mean}</div>
                </div>
              ) : (
                <div className="text-[11px] text-neutral-500 space-y-0.5 font-mono tabular-nums">
                  <div>고유값: {profile.uniqueCount}개</div>
                  <div className="truncate" title={profile.sampleValues.join(', ')}>
                    예: {profile.sampleValues.slice(0, 2).join(', ')}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Search and Table Controls */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-neutral-50/50">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="데이터 내용 실시간 검색..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-md focus:outline-hidden focus:border-neutral-900 transition-colors"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <span className="text-xs text-neutral-500 font-mono tabular-nums whitespace-nowrap">
              검색결과: {filteredRows.length.toLocaleString()}행
            </span>

            <div className="flex items-center gap-1.5 text-xs text-neutral-600">
              <span>표시:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-neutral-200 rounded px-2 py-1 text-xs font-mono"
              >
                <option value={10}>10개씩</option>
                <option value={25}>25개씩</option>
                <option value={50}>50개씩</option>
                <option value={100}>100개씩</option>
              </select>
            </div>
          </div>
        </div>

        {/* Scrollable Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-100 text-neutral-700 font-semibold border-b border-neutral-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center text-neutral-400 font-mono">#</th>
                {dataset.columns.map((col) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="py-2.5 px-3 cursor-pointer hover:bg-neutral-200/60 select-none whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col}</span>
                      {sortCol === col && (
                        <span className="text-neutral-900 font-mono">
                          {sortAsc ? '▲' : '▼'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 font-mono tabular-nums">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={dataset.columns.length + 1} className="py-8 text-center text-neutral-400">
                    검색 결과와 일치하는 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => {
                  const absoluteIndex = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={idx}
                      className="hover:bg-neutral-50/80 transition-colors"
                    >
                      <td className="py-2 px-3 text-center text-neutral-400 text-[11px]">
                        {absoluteIndex}
                      </td>
                      {dataset.columns.map((col) => {
                        const val = row[col];
                        const isNull = val === null || val === undefined || val === '';
                        return (
                          <td
                            key={col}
                            className={`py-2 px-3 whitespace-nowrap ${
                              isNull ? 'text-amber-500 italic bg-amber-50/40' : 'text-neutral-800'
                            }`}
                          >
                            {isNull ? '(결측값)' : String(val)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3 border-t border-neutral-200 flex items-center justify-between text-xs bg-neutral-50/50">
          <span className="text-neutral-500 font-mono tabular-nums">
            전체 {totalPages} 페이지 중 {currentPage} 페이지
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded border border-neutral-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono tabular-nums font-medium text-neutral-700">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded border border-neutral-200 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
