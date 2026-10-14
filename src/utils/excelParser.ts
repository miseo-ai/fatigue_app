import * as XLSX from 'xlsx';
import { ColumnProfile, DataType, ParsedDataset } from '../types';

export function parseFileBuffer(
  data: ArrayBuffer | Uint8Array,
  fileName: string,
  preferredSheet?: string
): ParsedDataset {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetNames = workbook.SheetNames;
  const currentSheet = (preferredSheet && sheetNames.includes(preferredSheet))
    ? preferredSheet
    : sheetNames[0];

  const worksheet = workbook.Sheets[currentSheet];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
    defval: null,
    blankrows: false,
  });

  return processRawData(jsonData, fileName, sheetNames, currentSheet);
}

export function parseCSVString(
  csvText: string,
  fileName: string = 'sample_data.csv'
): ParsedDataset {
  const workbook = XLSX.read(csvText, { type: 'string' });
  const sheetNames = workbook.SheetNames;
  const currentSheet = sheetNames[0];
  const worksheet = workbook.Sheets[currentSheet];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
    defval: null,
    blankrows: false,
  });

  return processRawData(jsonData, fileName, sheetNames, currentSheet);
}

function processRawData(
  rawRows: Record<string, any>[],
  fileName: string,
  sheetNames: string[],
  currentSheet: string
): ParsedDataset {
  if (!rawRows || rawRows.length === 0) {
    return {
      fileName,
      sheetNames,
      currentSheet,
      columns: [],
      columnProfiles: {},
      rawRows: [],
      cleanedRows: [],
      droppedRowsCount: 0,
    };
  }

  // Extract all unique column keys
  const columnSet = new Set<string>();
  rawRows.forEach((row) => {
    Object.keys(row).forEach((col) => {
      if (col && col.trim() !== '') {
        columnSet.add(col.trim());
      }
    });
  });
  const columns = Array.from(columnSet);

  // Analyze each column
  const columnProfiles: Record<string, ColumnProfile> = {};

  columns.forEach((col) => {
    let missingCount = 0;
    const values: any[] = [];
    let numericCount = 0;

    rawRows.forEach((row) => {
      const val = row[col];
      if (val === null || val === undefined || val === '' || (typeof val === 'number' && isNaN(val))) {
        missingCount++;
      } else {
        values.push(val);
        const parsed = Number(val);
        if (!isNaN(parsed) && typeof val !== 'boolean') {
          numericCount++;
        }
      }
    });

    const isMostlyNumeric = values.length > 0 && (numericCount / values.length >= 0.8);
    const type: DataType = isMostlyNumeric ? 'number' : 'string';

    const uniqueValues = Array.from(new Set(values));
    const profile: ColumnProfile = {
      name: col,
      type,
      missingCount,
      uniqueCount: uniqueValues.length,
      sampleValues: uniqueValues.slice(0, 5),
    };

    if (type === 'number') {
      const numList = values
        .map((v) => Number(v))
        .filter((v) => !isNaN(v))
        .sort((a, b) => a - b);

      if (numList.length > 0) {
        profile.min = numList[0];
        profile.max = numList[numList.length - 1];
        const sum = numList.reduce((acc, curr) => acc + curr, 0);
        profile.mean = Number((sum / numList.length).toFixed(3));

        const mid = Math.floor(numList.length / 2);
        profile.median = numList.length % 2 === 0
          ? Number(((numList[mid - 1] + numList[mid]) / 2).toFixed(3))
          : numList[mid];

        const variance = numList.reduce((acc, curr) => acc + Math.pow(curr - profile.mean!, 2), 0) / numList.length;
        profile.std = Number(Math.sqrt(variance).toFixed(3));
      }
    }

    columnProfiles[col] = profile;
  });

  return {
    fileName,
    sheetNames,
    currentSheet,
    columns,
    columnProfiles,
    rawRows,
    cleanedRows: rawRows,
    droppedRowsCount: 0,
  };
}

export function exportToExcel(
  rows: Record<string, any>[],
  fileName: string = 'predictions.xlsx'
) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Predictions');
  XLSX.writeFile(workbook, fileName);
}
