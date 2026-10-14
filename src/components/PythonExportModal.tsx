import React, { useState } from 'react';
import { X, Copy, Check, Terminal } from 'lucide-react';
import { MLConfig } from '../types';

interface PythonExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: MLConfig;
  fileName: string;
}

export const PythonExportModal: React.FC<PythonExportModalProps> = ({
  isOpen,
  onClose,
  config,
  fileName,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const { features, target, taskType, algorithm, testSplitRatio } = config;
  const isRegression = taskType === 'regression';

  const pythonModelImport = isRegression
    ? algorithm === 'linear_regression'
      ? 'from sklearn.linear_model import LinearRegression\nmodel = LinearRegression()'
      : algorithm === 'ridge_regression'
      ? 'from sklearn.linear_model import Ridge\nmodel = Ridge(alpha=1.0)'
      : algorithm === 'random_forest_reg'
      ? 'from sklearn.ensemble import RandomForestRegressor\nmodel = RandomForestRegressor(n_estimators=100, random_state=42)'
      : 'from sklearn.neighbors import KNeighborsRegressor\nmodel = KNeighborsRegressor(n_neighbors=5)'
    : algorithm === 'logistic_regression'
    ? 'from sklearn.linear_model import LogisticRegression\nmodel = LogisticRegression(max_iter=1000)'
    : algorithm === 'random_forest_clf'
    ? 'from sklearn.ensemble import RandomForestClassifier\nmodel = RandomForestClassifier(n_estimators=100, random_state=42)'
    : 'from sklearn.neighbors import KNeighborsClassifier\nmodel = KNeighborsClassifier(n_neighbors=5)';

  const pythonMetricEval = isRegression
    ? `from sklearn.metrics import r2_score, root_mean_squared_error, mean_absolute_error

train_pred = model.predict(X_train)
test_pred = model.predict(X_test)

print(f"훈련 R2 점수: {r2_score(y_train, train_pred):.4f}")
print(f"테스트 R2 점수: {r2_score(y_test, test_pred):.4f}")
print(f"테스트 RMSE: {root_mean_squared_error(y_test, test_pred):.4f}")
print(f"테스트 MAE: {mean_absolute_error(y_test, test_pred):.4f}")`
    : `from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

train_pred = model.predict(X_train)
test_pred = model.predict(X_test)

print(f"훈련 정확도: {accuracy_score(y_train, train_pred)*100:.2f}%")
print(f"테스트 정확도: {accuracy_score(y_test, test_pred)*100:.2f}%")
print("\\n[분류 리포트]\\n", classification_report(y_test, test_pred))`;

  const codeString = `import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
${pythonModelImport.split('\n')[0]}

# 1. 데이터 불러오기
df = pd.read_excel("${fileName}") if "${fileName}".endswith(('.xlsx', '.xls')) else pd.read_csv("${fileName}")

# 2. 독립변수(X) 및 종속변수(y) 정의
feature_cols = ${JSON.stringify(features)}
target_col = "${target}"

# 결측치 처리
df_clean = df.dropna(subset=[target_col] + feature_cols)
X = pd.get_dummies(df_clean[feature_cols], drop_first=True)
y = df_clean[target_col]

# 3. 훈련 / 테스트 세트 분할 (${Math.round((1 - testSplitRatio) * 100)} : ${Math.round(testSplitRatio * 100)})
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=${testSplitRatio}, random_state=42
)

# 4. 피처 스케일링
scaler = StandardScaler()
X_train = scaler.fit_transform(X_train)
X_test = scaler.transform(X_test)

# 5. 모델 학습
${pythonModelImport.split('\n')[1]}
model.fit(X_train, y_train)

# 6. 모델 평가 (정확도 확인)
${pythonMetricEval}

# 7. 새 데이터 예측 예시
# sample_input = X.iloc[[0]]
# pred = model.predict(scaler.transform(sample_input))
# print("새 데이터 예측값:", pred)
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-neutral-200">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200 bg-neutral-50">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-neutral-800" />
            <h3 className="text-sm font-bold text-neutral-900">
              Python scikit-learn 코드 내보내기
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto font-mono text-xs bg-neutral-900 text-neutral-200">
          <pre className="whitespace-pre overflow-x-auto leading-relaxed">
            {codeString}
          </pre>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-200 bg-neutral-50 text-xs">
          <span className="text-neutral-500">
            Jupyter Notebook이나 파이썬 환경에 붙여넣어 바로 실행할 수 있습니다.
          </span>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-4 py-2 font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors whitespace-nowrap"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>복사 완료!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>코드 복사</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
