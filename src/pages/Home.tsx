import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FileUpload } from '../components/FileUpload';
import { AnalysisResults } from '../components/AnalysisResults';
import { Chat } from '../components/Chat';
import { ReportsTable } from '../components/ReportsTable';
import { SchemaEditor } from '../components/SchemaEditor';
import { analyzeCRF, bulkUploadCSV, bulkUploadPDFs } from '../services/crfService';
import type { AnalysisResponse } from '../types/crf';
import { Loader2, Activity, FileSearch, MessageSquare, Upload, Database, Settings2 } from 'lucide-react';

type Tab = 'analysis' | 'chat' | 'bulk' | 'reports' | 'schema';

export const Home: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('analysis');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResponse | null>(null);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkDragOver, setBulkDragOver] = useState(false);

  const analysisMutation = useMutation({
    mutationFn: (file: File) => analyzeCRF(file, true, 5),
    onSuccess: (data) => {
      setAnalysisResults(data);
    },
    onError: (error: any) => {
      console.error('Analysis failed:', error);
    },
  });

  const bulkUploadMutation = useMutation({
    mutationFn: (files: File[]) => {
      if (files[0]?.name.toLowerCase().endsWith('.csv')) {
        return bulkUploadCSV(files[0]);
      }
      return bulkUploadPDFs(files);
    },
    onError: (error: any) => {
      console.error('Bulk upload failed:', error);
    },
  });

  const isBulkPDF = bulkFiles.length > 0 && bulkFiles[0].name.toLowerCase().endsWith('.pdf');

  const handleBulkDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setBulkDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length === 0) return;
    const allPDF = dropped.every((f) => f.name.toLowerCase().endsWith('.pdf'));
    const isCSV = dropped.length === 1 && dropped[0].name.toLowerCase().endsWith('.csv');
    if (allPDF || isCSV) {
      setBulkFiles(dropped);
      bulkUploadMutation.reset();
    }
  };

  const handleBulkInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      setBulkFiles(files);
      bulkUploadMutation.reset();
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
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <Activity className="w-10 h-10 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">CRF Analysis</h1>
          </div>
          <p className="text-lg text-gray-600">
            Upload a Case Report Form to extract patient data and get prescription recommendations
          </p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => setActiveTab('analysis')}
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
            onClick={() => setActiveTab('chat')}
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
            onClick={() => setActiveTab('bulk')}
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
            onClick={() => setActiveTab('reports')}
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
            onClick={() => setActiveTab('schema')}
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
              Upload a CSV file or one or more PDF files to extract, embed, and insert records into the database.
            </p>

            {/* Drop zone */}
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

            {/* Selected files + actions */}
            {bulkFiles.length > 0 && (
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
                  {!bulkUploadMutation.isPending && (
                    <button
                      onClick={() => { setBulkFiles([]); bulkUploadMutation.reset(); }}
                      className="text-gray-400 hover:text-gray-600 transition-colors text-xs pt-1"
                    >
                      Remove all
                    </button>
                  )}
                </div>

                {!bulkUploadMutation.isSuccess && !bulkUploadMutation.isPending && (
                  <button
                    onClick={() => bulkUploadMutation.mutate(bulkFiles)}
                    className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Upload &amp; Process
                  </button>
                )}

                {bulkUploadMutation.isPending && (
                  <div className="flex items-center justify-center gap-3 py-4">
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    <p className="text-sm text-gray-600">
                      {isBulkPDF ? 'Extracting and processing PDFs...' : 'Processing records...'}
                    </p>
                  </div>
                )}

                {bulkUploadMutation.isSuccess && bulkUploadMutation.data && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-1">
                    <p className="text-sm font-semibold text-green-800">Upload complete</p>
                    <p className="text-sm text-green-700">Inserted: {bulkUploadMutation.data.inserted.length}</p>
                    <p className="text-sm text-green-700">Updated: {bulkUploadMutation.data.updated.length}</p>
                    <p className="text-sm text-green-700">Skipped (already exist): {bulkUploadMutation.data.skipped.length}</p>
                    {bulkUploadMutation.data.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-red-700">Errors:</p>
                        <ul className="list-disc list-inside text-sm text-red-600 mt-1 space-y-0.5">
                          {bulkUploadMutation.data.errors.map((err, i) => (
                            <li key={i}>{err.crh_number ? `${err.crh_number}: ` : ''}{err.error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <button
                      onClick={() => { setBulkFiles([]); bulkUploadMutation.reset(); }}
                      className="mt-3 w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                    >
                      Upload Another File
                    </button>
                  </div>
                )}

                {bulkUploadMutation.isError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-red-800">Upload failed</p>
                    <p className="text-sm text-red-700 mt-1">
                      {(bulkUploadMutation.error as Error)?.message || 'An unexpected error occurred.'}
                    </p>
                    <button
                      onClick={() => bulkUploadMutation.mutate(bulkFiles)}
                      className="mt-3 bg-red-600 text-white py-2 px-4 rounded-lg text-sm hover:bg-red-700 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <Chat />
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <ReportsTable />
          </div>
        )}

        {/* Schema Tab */}
        {activeTab === 'schema' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <SchemaEditor />
          </div>
        )}
      </div>
    </div>
  );
};
