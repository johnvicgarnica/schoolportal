import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Save,
  Download,
  Plus,
  Trash2,
  ExternalLink,
  X,
  Table,
  Check,
  Eye,
  RefreshCw,
  Sparkles,
  Sheet,
  Columns,
  Rows
} from 'lucide-react';
import { FacultyPersonalFile } from '../types';
import { getFacultyFileData } from '../lib/firebase';

interface GoogleDocsSpreadsheetEditorProps {
  file: FacultyPersonalFile;
  fileDataUrl: string; // Base64 data URL
  onClose: () => void;
  onSaveFile: (updatedFile: FacultyPersonalFile) => Promise<void>;
  readOnly?: boolean;
}

export const GoogleDocsSpreadsheetEditor: React.FC<GoogleDocsSpreadsheetEditorProps> = ({
  file,
  fileDataUrl,
  onClose,
  onSaveFile,
  readOnly = false,
}) => {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheetName, setActiveSheetName] = useState<string>('');
  const [sheetData, setSheetData] = useState<(string | number)[][]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessToast, setSaveSuccessToast] = useState<boolean>(false);
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [cellInputValue, setCellInputValue] = useState<string>('');
  const [viewMode, setViewMode] = useState<'editor' | 'google-docs-viewer'>('editor');

  const cellInputRef = useRef<HTMLInputElement | null>(null);

  // Parse fileDataUrl on mount
  useEffect(() => {
    let isMounted = true;

    const processWorkbook = (rawData: string) => {
      try {
        const base64Data = rawData.includes(',') ? rawData.split(',')[1] : rawData;
        const wb = XLSX.read(base64Data, { type: 'base64', cellDates: true, raw: false });

        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        const firstSheet = wb.SheetNames[0] || 'Sheet1';
        setActiveSheetName(firstSheet);

        const ws = wb.Sheets[firstSheet];
        const data = XLSX.utils.sheet_to_json<(string | number)[]>(ws, {
          header: 1,
          defval: '',
          blankrows: true,
        });

        // Guarantee minimum grid size for comfortable editing (at least 15 rows and 10 cols)
        const paddedRows = (data && data.length > 0 ? data : [['']]) as (string | number)[][];
        while (paddedRows.length < 15) {
          paddedRows.push(new Array(Math.max(10, paddedRows[0]?.length || 10)).fill(''));
        }
        setSheetData(paddedRows);
      } catch (err) {
        console.error('Error parsing spreadsheet:', err);
        const fallbackGrid: (string | number)[][] = Array.from({ length: 20 }, (_, r) =>
          Array.from({ length: 10 }, (_, c) => (r === 0 ? `Column ${c + 1}` : ''))
        );
        setSheetData(fallbackGrid);
        setSheetNames(['Sheet1']);
        setActiveSheetName('Sheet1');
      }
    };

    const initialData = fileDataUrl || file.fileData;
    if (initialData) {
      processWorkbook(initialData);
      return;
    }

    // Try fetching from database if not loaded yet
    getFacultyFileData(file)
      .then((data) => {
        if (!isMounted) return;
        if (data) {
          processWorkbook(data);
        } else {
          // If no binary exists anywhere, initialize template
          const defaultRows: (string | number)[][] = [
            ['School Form 2 (SF 2) Daily Attendance Report', '', '', '', '', '', '', '', '', ''],
            ['School Name: San Vicente National High School', '', '', 'School ID: 304868', '', '', '', 'District: Bislig City', '', ''],
            ['Grade Level:', file.gradeLevel || 'Grade 11', '', 'Section:', file.section || 'Diamond', '', 'Month:', 'October', '', ''],
            ['No.', 'Learner Name (Last, First, Middle)', '1', '2', '3', '4', '5', 'Total Absent', 'Total Tardy', 'Remarks'],
            ['1', 'Dela Cruz, Juan M.', 'P', 'P', 'P', 'P', 'P', '0', '0', ''],
            ['2', 'Santos, Maria C.', 'P', 'P', 'A', 'P', 'P', '1', '0', ''],
            ['3', 'Garnica, John Vic', 'P', 'P', 'P', 'P', 'P', '0', '0', ''],
            ['4', 'Reyes, Angelo B.', 'P', 'P', 'P', 'P', 'P', '0', '0', ''],
            ['5', 'Bautista, Sarah L.', 'P', 'P', 'P', 'P', 'P', '0', '0', ''],
          ];
          const newWb = XLSX.utils.book_new();
          const ws = XLSX.utils.aoa_to_sheet(defaultRows);
          XLSX.utils.book_append_sheet(newWb, ws, 'SF2_Attendance');
          setWorkbook(newWb);
          setSheetNames(['SF2_Attendance']);
          setActiveSheetName('SF2_Attendance');
          setSheetData(defaultRows);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Error fetching file data:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [fileDataUrl, file]);

  // Switch Active Sheet
  const handleSheetChange = (newSheetName: string) => {
    if (!workbook || newSheetName === activeSheetName) return;
    setActiveSheetName(newSheetName);
    const ws = workbook.Sheets[newSheetName];
    if (ws) {
      const data = XLSX.utils.sheet_to_json<(string | number)[]>(ws, {
        header: 1,
        defval: '',
        blankrows: true,
      });
      const paddedRows = (data && data.length > 0 ? data : [['']]) as (string | number)[][];
      while (paddedRows.length < 15) {
        paddedRows.push(new Array(Math.max(10, paddedRows[0]?.length || 10)).fill(''));
      }
      setSheetData(paddedRows);
      setSelectedCell({ r: 0, c: 0 });
      setCellInputValue(String(paddedRows[0]?.[0] || ''));
    }
  };

  // Select Cell
  const handleSelectCell = (r: number, c: number) => {
    setSelectedCell({ r, c });
    const val = sheetData[r]?.[c] ?? '';
    setCellInputValue(String(val));
  };

  // Update cell value
  const handleCellValueChange = (newValue: string, targetR = selectedCell.r, targetC = selectedCell.c) => {
    setSheetData((prev) => {
      const copy = prev.map((row) => [...row]);
      while (copy.length <= targetR) {
        copy.push([]);
      }
      while (copy[targetR].length <= targetC) {
        copy[targetR].push('');
      }
      copy[targetR][targetC] = newValue;
      return copy;
    });
    setHasUnsavedChanges(true);
  };

  // Convert column index to Excel column name (0 -> A, 1 -> B, 26 -> AA)
  const getColName = (idx: number): string => {
    let name = '';
    let temp = idx;
    while (temp >= 0) {
      name = String.fromCharCode((temp % 26) + 65) + name;
      temp = Math.floor(temp / 26) - 1;
    }
    return name;
  };

  // Max columns across all rows
  const maxCols = useMemo(() => {
    let m = 8;
    for (const row of sheetData) {
      if (row.length > m) m = row.length;
    }
    return Math.max(m, 10);
  }, [sheetData]);

  // Add row
  const handleAddRow = () => {
    setSheetData((prev) => [...prev, new Array(maxCols).fill('')]);
    setHasUnsavedChanges(true);
  };

  // Delete current selected row
  const handleDeleteRow = () => {
    if (sheetData.length <= 1) return;
    setSheetData((prev) => prev.filter((_, idx) => idx !== selectedCell.r));
    setSelectedCell((prev) => ({
      r: Math.max(0, prev.r - 1),
      c: prev.c,
    }));
    setHasUnsavedChanges(true);
  };

  // Add column
  const handleAddColumn = () => {
    setSheetData((prev) => prev.map((row) => [...row, '']));
    setHasUnsavedChanges(true);
  };

  // Format Bytes helper
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Save changes to Firebase
  const handleSaveToFirebase = async () => {
    setIsSaving(true);
    try {
      // Build workbook from current sheetData
      const wb = workbook ? { ...workbook } : XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(sheetData);

      if (!wb.Sheets) wb.Sheets = {};
      wb.Sheets[activeSheetName || 'Sheet1'] = ws;
      if (!wb.SheetNames || !wb.SheetNames.includes(activeSheetName || 'Sheet1')) {
        wb.SheetNames = [activeSheetName || 'Sheet1'];
      }

      // Encode as Base64 .xlsx
      const updatedBase64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
      const updatedDataUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${updatedBase64}`;

      // Calculate approximate size
      const approxBytes = Math.round((updatedBase64.length * 3) / 4);

      const updatedFileDoc: FacultyPersonalFile = {
        ...file,
        fileData: updatedDataUrl,
        fileSizeBytes: approxBytes,
        fileSizeFormatted: formatBytes(approxBytes),
        format: 'xlsx',
      };

      await onSaveFile(updatedFileDoc);
      setWorkbook(wb);
      setHasUnsavedChanges(false);
      setSaveSuccessToast(true);
      setTimeout(() => setSaveSuccessToast(false), 3000);
    } catch (err) {
      console.error('Error saving spreadsheet changes to Firebase:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Download XLSX
  const handleDownloadXlsx = () => {
    try {
      const wb = workbook ? { ...workbook } : XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      if (!wb.Sheets) wb.Sheets = {};
      wb.Sheets[activeSheetName || 'Sheet1'] = ws;
      XLSX.writeFile(wb, file.fileName || 'School_Form_2.xlsx');
    } catch (err) {
      console.error('Error exporting spreadsheet:', err);
    }
  };

  // Google Docs / Sheets Viewer Link
  const googleDocsViewerUrl = useMemo(() => {
    if (file.downloadUrl) {
      return `https://docs.google.com/viewer?url=${encodeURIComponent(file.downloadUrl)}&embedded=true`;
    }
    return '';
  }, [file.downloadUrl]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Spreadsheet Editor: ${file.title}`}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-2 sm:p-4 select-none animate-fadeIn"
    >
      {/* Top Floating Notification */}
      {saveSuccessToast && (
        <div className="fixed top-6 z-60 bg-emerald-600 text-white px-5 py-2.5 rounded-full shadow-2xl border border-emerald-400 font-mono text-xs font-bold flex items-center space-x-2 animate-bounce">
          <Check className="w-4 h-4 text-white" />
          <span>Saved to Firebase successfully!</span>
        </div>
      )}

      {/* Main Google Docs / Sheets Editor Window */}
      <div className="bg-[#0f172a] border border-[#24334b] rounded-3xl w-full h-[95vh] max-w-7xl flex flex-col overflow-hidden shadow-2xl text-slate-100">
        {/* Header Bar (Styled like Google Sheets with DepEd Official Theme) */}
        <div className="bg-[#131d31] border-b border-[#24334b] px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30 shadow-inner shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-base font-bold font-mono text-white truncate max-w-md">
                  {file.title || file.fileName}
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase shrink-0">
                  Google Docs / Sheets Integration
                </span>
                {hasUnsavedChanges && (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold shrink-0">
                    Unsaved edits
                  </span>
                )}
              </div>
              <div className="text-[11px] font-mono text-slate-400 flex items-center space-x-2 mt-0.5">
                <span>{file.fileName}</span>
                <span>•</span>
                <span>{file.fileSizeFormatted}</span>
                {file.gradeLevel && (
                  <>
                    <span>•</span>
                    <span className="text-blue-300">{file.gradeLevel}</span>
                  </>
                )}
                {file.section && (
                  <>
                    <span>•</span>
                    <span className="text-purple-300">{file.section}</span>
                  </>
                )}
                <span>•</span>
                <span className="text-emerald-400">Firebase Cloud Stored</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* View Mode Toggle */}
            <div className="bg-[#0b1220] p-0.5 rounded-xl border border-[#24334b] flex items-center text-xs font-mono">
              <button
                type="button"
                onClick={() => setViewMode('editor')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                  viewMode === 'editor'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Live Editor</span>
              </button>
              {googleDocsViewerUrl && (
                <button
                  type="button"
                  onClick={() => setViewMode('google-docs-viewer')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                    viewMode === 'google-docs-viewer'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Google Docs View</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleDownloadXlsx}
              title="Download Excel spreadsheet"
              className="px-3 py-1.5 bg-[#172236] hover:bg-[#20304c] text-slate-200 border border-[#2d3e57] rounded-xl text-xs font-mono font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Export .xlsx</span>
            </button>

            {!readOnly && (
              <button
                type="button"
                onClick={handleSaveToFirebase}
                disabled={isSaving}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-mono font-bold transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save to Firebase</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 bg-[#172236] hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 rounded-xl transition-all cursor-pointer border border-[#24334b]"
              title="Close editor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Formula Bar */}
        {viewMode === 'editor' && (
          <div className="bg-[#10192a] border-b border-[#24334b] px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono shrink-0">
            {/* Quick Spreadsheet Operations */}
            <div className="flex items-center space-x-2">
              {!readOnly && (
                <>
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="px-2.5 py-1 bg-[#172236] hover:bg-[#20304c] text-slate-300 hover:text-white rounded-lg border border-[#2d3e57] flex items-center space-x-1 cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>+ Row</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteRow}
                    className="px-2.5 py-1 bg-[#172236] hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 rounded-lg border border-[#2d3e57] flex items-center space-x-1 cursor-pointer transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>- Row</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAddColumn}
                    className="px-2.5 py-1 bg-[#172236] hover:bg-[#20304c] text-slate-300 hover:text-white rounded-lg border border-[#2d3e57] flex items-center space-x-1 cursor-pointer transition-all"
                  >
                    <Columns className="w-3.5 h-3.5 text-blue-400" />
                    <span>+ Column</span>
                  </button>
                </>
              )}
            </div>

            {/* Formula / Active Cell Value Bar */}
            <div className="flex items-center space-x-2 flex-1 min-w-[240px] max-w-xl">
              <span className="bg-[#172236] border border-[#2d3e57] px-2.5 py-1 rounded-lg text-emerald-300 font-bold font-mono text-xs shrink-0">
                {getColName(selectedCell.c)}
                {selectedCell.r + 1}
              </span>
              <span className="text-slate-500 font-serif italic text-xs">fx</span>
              <input
                ref={cellInputRef}
                type="text"
                value={cellInputValue}
                disabled={readOnly}
                onChange={(e) => {
                  setCellInputValue(e.target.value);
                  handleCellValueChange(e.target.value);
                }}
                placeholder="Enter text or number into cell..."
                className="w-full bg-[#0b1220] border border-[#24334b] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-2.5 py-1 text-xs font-mono text-white placeholder-slate-500 outline-none transition-all"
              />
            </div>

            <div className="text-[11px] text-slate-400 font-mono hidden lg:block">
              Click any cell to edit • Press Tab or Enter to navigate
            </div>
          </div>
        )}

        {/* Content Area: Grid Editor or Google Docs Webview */}
        <div className="flex-1 overflow-auto bg-[#070c16] relative">
          {viewMode === 'google-docs-viewer' && googleDocsViewerUrl ? (
            <iframe
              src={googleDocsViewerUrl}
              title="Google Docs Spreadsheet Viewer"
              className="w-full h-full border-0"
            />
          ) : (
            <div className="min-w-full inline-block align-top">
              <table className="border-collapse table-auto text-xs font-mono w-full select-text">
                {/* Column Headers (A, B, C...) */}
                <thead className="bg-[#121c2e] sticky top-0 z-20 shadow-xs">
                  <tr>
                    <th className="w-12 min-w-12 max-w-12 px-2 py-1.5 text-center text-slate-500 font-bold border border-[#24334b] bg-[#0d1524]">
                      #
                    </th>
                    {Array.from({ length: maxCols }, (_, cIdx) => (
                      <th
                        key={cIdx}
                        className={`min-w-[120px] px-2 py-1.5 text-center font-bold border border-[#24334b] ${
                          selectedCell.c === cIdx ? 'bg-emerald-950/70 text-emerald-300' : 'text-slate-400'
                        }`}
                      >
                        {getColName(cIdx)}
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* Grid Rows */}
                <tbody>
                  {sheetData.map((row, rIdx) => {
                    const isSelectedRow = selectedCell.r === rIdx;
                    return (
                      <tr key={rIdx} className={isSelectedRow ? 'bg-[#142036]' : 'hover:bg-[#0c1424]'}>
                        {/* Row Header Number */}
                        <td
                          className={`w-12 min-w-12 max-w-12 px-2 py-1 text-center font-bold border border-[#24334b] select-none ${
                            isSelectedRow ? 'bg-emerald-950/70 text-emerald-300' : 'bg-[#0d1524] text-slate-500'
                          }`}
                        >
                          {rIdx + 1}
                        </td>

                        {/* Row Cells */}
                        {Array.from({ length: maxCols }, (_, cIdx) => {
                          const cellVal = row[cIdx] ?? '';
                          const isSelected = selectedCell.r === rIdx && selectedCell.c === cIdx;
                          return (
                            <td
                              key={cIdx}
                              onClick={() => handleSelectCell(rIdx, cIdx)}
                              className={`border border-[#1e2a3f] px-2 py-1 transition-colors relative cursor-text min-w-[120px] max-w-[280px] truncate ${
                                isSelected
                                  ? 'bg-blue-900/40 ring-2 ring-emerald-400 z-10 text-white font-medium'
                                  : 'text-slate-200'
                              }`}
                            >
                              {isSelected && !readOnly ? (
                                <input
                                  type="text"
                                  autoFocus
                                  value={cellInputValue}
                                  onChange={(e) => {
                                    setCellInputValue(e.target.value);
                                    handleCellValueChange(e.target.value, rIdx, cIdx);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSelectCell(Math.min(sheetData.length - 1, rIdx + 1), cIdx);
                                    } else if (e.key === 'Tab') {
                                      e.preventDefault();
                                      handleSelectCell(rIdx, Math.min(maxCols - 1, cIdx + 1));
                                    }
                                  }}
                                  className="w-full bg-transparent text-white outline-none border-none p-0 text-xs font-mono font-medium"
                                />
                              ) : (
                                <span>{String(cellVal)}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bottom Sheet Navigation Bar (Tabs) */}
        {viewMode === 'editor' && (
          <div className="bg-[#10192a] border-t border-[#24334b] px-4 py-2 flex items-center justify-between text-xs font-mono shrink-0">
            <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
              <span className="text-slate-400 font-bold flex items-center space-x-1 mr-2">
                <Sheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sheets:</span>
              </span>
              {sheetNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleSheetChange(name)}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer border ${
                    activeSheetName === name
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                      : 'bg-[#172236] text-slate-300 border-[#2d3e57] hover:bg-[#20304c]'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>

            <div className="text-[11px] font-mono text-slate-400">
              {sheetData.length} rows × {maxCols} columns
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
