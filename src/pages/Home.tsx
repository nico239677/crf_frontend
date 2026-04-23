import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FileUpload } from '../components/FileUpload';
import { AnalysisResults } from '../components/AnalysisResults';
import { Chat } from '../components/Chat';
import { ReportsTable } from '../components/ReportsTable';
import { SchemaEditor } from '../components/SchemaEditor';
import { analyzeCRF, bulkPreview, bulkConfirm } from '../services/crfService';
import type { ChatMessage, PreviewRecord, BulkUploadResponse } from '../services/crfService';
import type { AnalysisResponse } from '../types/crf';
import { Loader2, Activity, FileSearch, MessageSquare, Upload, Database, Settings2, LogOut } from 'lucide-react';

type Tab = 'analysis' | 'chat' | 'bulk' | 'reports' | 'schema';

interface HomeProps {
  onSignOut?: () => void;
  userEmail?: string;
}

export const Home: React.FC<HomeProps> = ({ onSignOut, userEmail }) => {
  const [activeTab, setActiveTab] = useState<Tab>('analysis');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResponse | null>(null);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkDragOver, setBulkDragOver] = useState(false);
  const [bulkPreviewRecords, setBulkPreviewRecords] = useState<PreviewRecord[]>([]);
  const [bulkPreviewErrors, setBulkPreviewErrors] = useState<{ crh_number: string | null; error: string }[]>([]);
  const [bulkConfirmResult, setBulkConfirmResult] = useState<BulkUploadResponse | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatLastActivity = useRef<number>(Date.now());

  const INACTIVITY_MS = 30 * 60 * 1000;

  const handleTabChange = useCallback((tab: Tab) => {
    if (tab === 'chat') {
      if (Date.now() - chatLastActivity.current > INACTIVITY_MS) {
        setChatMessages([]);
      }
    }
    setActiveTab(tab);
  }, []);

  const handleChatMessagesChange = useCallback((msgs: ChatMessage[]) => {
    setChatMessages(msgs);
    chatLastActivity.current = Date.now();
  }, []);

  const handleNewDiscussion = useCallback(() => {
    setChatMessages([]);
    chatLastActivity.current = Date.now();
  }, []);

  const analysisMutation = useMutation({
    mutationFn: (file: File) => analyzeCRF(file, true, 5, selectedTable ?? undefined),
    onSuccess: (data) => {
      setAnalysisResults(data);
    },
    onError: (error: any) => {
      console.error('Analysis failed:', error);
    },
  });

  const bulkPreviewMutation = useMutation({
    mutationFn: (files: File[]) => bulkPreview(files, selectedTable ?? 'main'),
    onSuccess: (data) => {
      setBulkPreviewRecords(data.records);
      setBulkPreviewErrors(data.errors);
    },
    onError: (error: any) => {
      console.error('Bulk preview failed:', error);
    },
  });

  const bulkConfirmMutation = useMutation({
    mutationFn: (records: PreviewRecord[]) => bulkConfirm(records, selectedTable ?? 'main'),
    onSuccess: (data) => {
      setBulkConfirmResult(data);
    },
    onError: (error: any) => {
      console.error('Bulk confirm failed:', error);
    },
  });

  const isBulkPDF = bulkFiles.length > 0 && bulkFiles[0].name.toLowerCase().endsWith('.pdf');

  const handleRemoveRow = (rowIdx: number) => {
    setBulkPreviewRecords((prev) => prev.filter((_, i) => i !== rowIdx));
  };

  const handleCellEdit = (rowIdx: number, col: string, value: string) => {
    setBulkPreviewRecords((prev) =>
      prev.map((r, i) => i === rowIdx ? { ...r, data: { ...r.data, [col]: value } } : r)
    );
  };

  const resetBulk = () => {
    setBulkFiles([]);
    setBulkPreviewRecords([]);
    setBulkPreviewErrors([]);
    setBulkConfirmResult(null);
    bulkPreviewMutation.reset();
    bulkConfirmMutation.reset();
  };

  // When user removes all rows from preview, go back to drop zone
  useEffect(() => {
    if (bulkPreviewMutation.isSuccess && bulkPreviewRecords.length === 0 && !bulkConfirmMutation.isSuccess) {
      resetBulk();
    }
  }, [bulkPreviewRecords.length, bulkPreviewMutation.isSuccess, bulkConfirmMutation.isSuccess]);

  const handleBulkDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setBulkDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length === 0) return;
    const allPDF = dropped.every((f) => f.name.toLowerCase().endsWith('.pdf'));
    const isCSV = dropped.length === 1 && dropped[0].name.toLowerCase().endsWith('.csv');
    if (allPDF || isCSV) {
      setBulkFiles(dropped);
      bulkPreviewMutation.reset();
    }
  };

  const handleBulkInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      setBulkFiles(files);
      bulkPreviewMutation.reset();
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setAnalysisResults(null);
  };

  const handleAnalyze = () => {
    if (selectedFile) {
      analysisMutation.mutate(selectedFile);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3">
              <Activity className="w-10 h-10 text-blue-600" />
              <h1 className="text-4xl font-bold text-gray-900">Clinical Data Platform</h1>
            </div>
            {onSignOut && (
              <div className="flex items-center gap-3">
                {userEmail && (
                  <span className="text-sm text-gray-500 hidden sm:block">{userEmail}</span>
                )}
                <button
                  onClick={onSignOut}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                  title="Se déconnecter"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Déconnexion</span>
                </button>
              </div>
            )}
          </div>
          <p className="text-lg text-gray-600 text-center">
            Upload a Case Report Form to extract patient data and get prescription recommendations
          </p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => handleTabChange('analysis')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'analysis'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileSearch className="w-4 h-4" />
            Analysis
          </button>
          <button
            onClick={() => handleTabChange('chat')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'chat'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Chat
          </button>
          <button
            onClick={() => handleTabChange('bulk')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'bulk'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload multiple CRs
          </button>
          <button
            onClick={() => handleTabChange('reports')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'reports'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Database className="w-4 h-4" />
            Reports
          </button>
          <button
            onClick={() => handleTabChange('schema')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'schema'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            Schéma
          </button>
        </div>

        {/* Analysis Tab */}
        {activeTab === 'analysis' && (
          <>
            {/* Upload Section */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload CRF Document</h2>
              <FileUpload onFileSelect={handleFileSelect} maxSize={10} />

              {selectedFile && !analysisMutation.isPending && !analysisResults && (
                <div className="mt-6">
                  <button
                    onClick={handleAnalyze}
                    className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Analyze Document
                  </button>
                </div>
              )}
            </div>

            {/* Loading State */}
            {analysisMutation.isPending && (
              <div className="bg-white rounded-lg shadow-sm p-8">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                  <div className="text-center">
                    <p className="text-lg font-medium text-gray-900">Analyzing your document...</p>
                    <p className="text-sm text-gray-600 mt-1">
                      This may take a few moments. We're extracting patient data using AI.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Results Section */}
            {analysisResults && !analysisMutation.isPending && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Analysis Results</h2>
                <AnalysisResults results={analysisResults} />

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setAnalysisResults(null);
                    }}
                    className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    Analyze Another Document
                  </button>
                </div>
              </div>
            )}

            {/* Error State */}
            {analysisMutation.isError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-red-900 mb-2">Analysis Failed</h3>
                <p className="text-red-700">
                  {(analysisMutation.error as any)?.response?.data?.detail ||
                   (analysisMutation.error as Error)?.message ||
                   'An unexpected error occurred. Please try again.'}
                </p>
                <button
                  onClick={() => analysisMutation.reset()}
                  className="mt-4 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}
          </>
        )}

        {/* Bulk Upload Tab */}
        {activeTab === 'bulk' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Bulk Upload</h2>
            <p className="text-sm text-gray-500 mb-6">
              Upload a CSV file or one or more PDF files. Records are extracted and shown for review before insertion.
            </p>

            {/* Stage 1: Drop zone (no files selected yet) */}
            {bulkFiles.length === 0 && (
              <div
                onDragOver={(e) => { e.preventDefault(); setBulkDragOver(true); }}
                onDragLeave={() => setBulkDragOver(false)}
                onDrop={handleBulkDrop}
                className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors duration-200 cursor-pointer ${
                  bulkDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
                }`}
                onClick={() => document.getElementById('bulk-input')?.click()}
              >
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">Drop your CSV or PDF files here, or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">.csv (single file) or .pdf (one or more)</p>
                <input
                  id="bulk-input"
                  type="file"
                  accept=".csv,.pdf"
                  multiple
                  className="hidden"
                  onChange={handleBulkInput}
                />
              </div>
            )}

            {/* Stage 2: Files selected, not yet previewed */}
            {bulkFiles.length > 0 && !bulkPreviewMutation.isSuccess && (
              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 space-y-2">
                  {bulkFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Upload className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{f.name}</p>
                        <p className="text-xs text-gray-400">{(f.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                  ))}
                  {!bulkPreviewMutation.isPending && (
                    <button onClick={resetBulk} className="text-gray-400 hover:text-gray-600 transition-colors text-xs pt-1">
                      Remove all
                    </button>
                  )}
                </div>

                {!bulkPreviewMutation.isPending && (
                  <button
                    onClick={() => bulkPreviewMutation.mutate(bulkFiles)}
                    className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    {isBulkPDF ? 'Extract & Preview' : 'Parse & Preview'}
                  </button>
                )}

                {bulkPreviewMutation.isPending && (
                  <div className="flex items-center justify-center gap-3 py-4">
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    <p className="text-sm text-gray-600">
                      {isBulkPDF ? 'Extracting data from PDFs...' : 'Parsing records...'}
                    </p>
                  </div>
                )}

                {bulkPreviewMutation.isError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-red-800">Extraction failed</p>
                    <p className="text-sm text-red-700 mt-1">
                      {(bulkPreviewMutation.error as Error)?.message || 'An unexpected error occurred.'}
                    </p>
                    <button
                      onClick={() => bulkPreviewMutation.mutate(bulkFiles)}
                      className="mt-3 bg-red-600 text-white py-2 px-4 rounded-lg text-sm hover:bg-red-700 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Stage 3: Preview table + confirm */}
            {bulkPreviewMutation.isSuccess && bulkPreviewRecords.length > 0 && !bulkConfirmMutation.isSuccess && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-gray-900">{bulkPreviewRecords.length}</span> record{bulkPreviewRecords.length !== 1 ? 's' : ''} extracted — review before inserting
                  </p>
                  <button onClick={resetBulk} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                    Start over
                  </button>
                </div>

                {/* Extraction errors (partial failures) */}
                {bulkPreviewErrors.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-yellow-800 mb-1">{bulkPreviewErrors.length} file(s) failed extraction:</p>
                    <ul className="list-disc list-inside text-xs text-yellow-700 space-y-0.5">
                      {bulkPreviewErrors.map((err, i) => (
                        <li key={i}>{err.crh_number ? `${err.crh_number}: ` : ''}{err.error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Duplicate summary */}
                {bulkPreviewRecords.some((r) => r.duplicate_of) && (
                  <div className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-300 rounded-lg text-sm">
                    <span className="text-orange-500 font-bold flex-shrink-0">⚠</span>
                    <div>
                      <span className="font-semibold text-orange-900">
                        {bulkPreviewRecords.filter((r) => r.duplicate_of).length} duplicate{bulkPreviewRecords.filter((r) => r.duplicate_of).length !== 1 ? 's' : ''} detected.
                      </span>{' '}
                      <span className="text-orange-800">Highlighted rows already exist in the database with identical fields.</span>
                    </div>
                  </div>
                )}

                {/* Preview table — Reports-style single row per record */}
                {(() => {
                  const columns = Array.from(
                    new Set(bulkPreviewRecords.flatMap((r) => Object.keys(r.data)))
                  );
                  return (
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            {/* Status column */}
                            <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap"></th>
                            {columns.map((col) => (
                              <th
                                key={col}
                                className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap"
                              >
                                {col}
                              </th>
                            ))}
                            {/* Remove column — sticky right */}
                            <th className="sticky right-0 bg-gray-50 px-3 py-2 border-l border-gray-200"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {bulkPreviewRecords.map((record, i) => {
                            const isDuplicate = Boolean(record.duplicate_of);
                            return (
                              <tr key={i} className={isDuplicate ? 'bg-orange-50' : 'hover:bg-gray-50'}>
                                {/* Status: duplicate warning */}
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {isDuplicate && (
                                    <span
                                      className="inline-flex items-center gap-1 text-orange-700 font-medium"
                                      title={`Duplicate of ${record.duplicate_of}`}
                                    >
                                      ⚠ {record.duplicate_of}
                                    </span>
                                  )}
                                </td>
                                {/* Data cells — click to edit */}
                                {columns.map((col) => {
                                  const val = record.data[col];
                                  const display = val === null || val === undefined ? '' : String(val);
                                  const isEditing = editingCell?.row === i && editingCell?.col === col;
                                  return (
                                    <td
                                      key={col}
                                      className={`px-1 py-1 max-w-[160px] ${isDuplicate ? 'text-orange-900' : 'text-gray-700'}`}
                                    >
                                      {isEditing ? (
                                        <input
                                          autoFocus
                                          className="w-full min-w-[80px] px-2 py-1 border border-blue-400 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                          value={display}
                                          onChange={(e) => handleCellEdit(i, col, e.target.value)}
                                          onBlur={() => setEditingCell(null)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === 'Escape') setEditingCell(null);
                                          }}
                                        />
                                      ) : (
                                        <div
                                          className="px-2 py-1 rounded cursor-pointer hover:bg-blue-50 hover:ring-1 hover:ring-blue-200 truncate"
                                          title={`${display} — click to edit`}
                                          onClick={() => setEditingCell({ row: i, col })}
                                        >
                                          {display || <span className="text-gray-300 italic">—</span>}
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                                {/* Remove button — sticky right */}
                                <td className="sticky right-0 px-3 py-2 border-l border-gray-200 bg-white">
                                  <button
                                    onClick={() => handleRemoveRow(i)}
                                    className="text-gray-300 hover:text-red-500 transition-colors"
                                    title="Remove this record"
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                {/* Confirm button */}
                {!bulkConfirmMutation.isPending && (
                  <button
                    onClick={() => bulkConfirmMutation.mutate(bulkPreviewRecords)}
                    disabled={bulkPreviewRecords.length === 0}
                    className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Confirm & Insert {bulkPreviewRecords.length} record{bulkPreviewRecords.length !== 1 ? 's' : ''}
                  </button>
                )}

                {bulkConfirmMutation.isPending && (
                  <div className="flex items-center justify-center gap-3 py-4">
                    <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
                    <p className="text-sm text-gray-600">Inserting records...</p>
                  </div>
                )}

                {bulkConfirmMutation.isError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-red-800">Insertion failed</p>
                    <p className="text-sm text-red-700 mt-1">
                      {(bulkConfirmMutation.error as Error)?.message || 'An unexpected error occurred.'}
                    </p>
                    <button
                      onClick={() => bulkConfirmMutation.mutate(bulkPreviewRecords)}
                      className="mt-3 bg-red-600 text-white py-2 px-4 rounded-lg text-sm hover:bg-red-700 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Stage 4: Confirm success */}
            {bulkConfirmMutation.isSuccess && bulkConfirmResult && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-1">
                <p className="text-sm font-semibold text-green-800">Insertion complete</p>
                <p className="text-sm text-green-700">Inserted: {bulkConfirmResult.inserted.length}</p>
                <p className="text-sm text-green-700">Updated: {bulkConfirmResult.updated.length}</p>
                <p className="text-sm text-green-700">Skipped (already exist): {bulkConfirmResult.skipped.length}</p>
                {bulkConfirmResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-red-700">Errors:</p>
                    <ul className="list-disc list-inside text-sm text-red-600 mt-1 space-y-0.5">
                      {bulkConfirmResult.errors.map((err, i) => (
                        <li key={i}>{err.crh_number ? `${err.crh_number}: ` : ''}{err.error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <button
                  onClick={resetBulk}
                  className="mt-3 w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  Upload Another File
                </button>
              </div>
            )}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <Chat
              messages={chatMessages}
              onMessagesChange={handleChatMessagesChange}
              onNewDiscussion={handleNewDiscussion}
            />
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <ReportsTable selectedTable={selectedTable} onTableChange={setSelectedTable} />
          </div>
        )}

        {/* Schema Tab */}
        {activeTab === 'schema' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <SchemaEditor selectedTable={selectedTable} onTableChange={setSelectedTable} />
          </div>
        )}
      </div>
    </div>
  );
};
