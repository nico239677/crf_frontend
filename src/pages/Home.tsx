import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FileUpload } from '../components/FileUpload';
import { AnalysisResults } from '../components/AnalysisResults';
import { Chat } from '../components/Chat';
import { analyzeCRF } from '../services/crfService';
import type { AnalysisResponse } from '../types/crf';
import { Loader2, Activity, FileSearch, MessageSquare } from 'lucide-react';

type Tab = 'analysis' | 'chat';

export const Home: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('analysis');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResponse | null>(null);

  const analysisMutation = useMutation({
    mutationFn: (file: File) => analyzeCRF(file, true, 5),
    onSuccess: (data) => {
      setAnalysisResults(data);
    },
    onError: (error: any) => {
      console.error('Analysis failed:', error);
    },
  });

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

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <Chat />
          </div>
        )}
      </div>
    </div>
  );
};
