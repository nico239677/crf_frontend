import React from 'react';
import { CheckCircle, AlertCircle, FileText, Users } from 'lucide-react';
import type { AnalysisResponse } from '../types/crf';

interface AnalysisResultsProps {
  results: AnalysisResponse;
}

export const AnalysisResults: React.FC<AnalysisResultsProps> = ({ results }) => {
  const { extraction, recommendation, similar_cases } = results;

  return (
    <div className="space-y-6">
      {/* Extraction Status */}
      <div className={`p-4 rounded-lg ${extraction.success ? 'bg-green-50' : 'bg-red-50'}`}>
        <div className="flex items-center space-x-2">
          {extraction.success ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          <span className={`font-medium ${extraction.success ? 'text-green-900' : 'text-red-900'}`}>
            {extraction.success ? 'Extraction Successful' : 'Extraction Failed'}
          </span>
        </div>
        {extraction.crh_number && (
          <p className="mt-2 text-sm text-gray-700">CRH Number: {extraction.crh_number}</p>
        )}
        {extraction.error && (
          <p className="mt-2 text-sm text-red-700">Error: {extraction.error}</p>
        )}
      </div>

      {/* Extracted Data */}
      {extraction.success && Object.keys(extraction.data).length > 0 && (
        <div className="border border-gray-200 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Extracted Patient Data</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(extraction.data).map(([key, value]) => (
              <div key={key} className="bg-gray-50 p-3 rounded">
                <p className="text-xs text-gray-500 uppercase tracking-wide">{key.replace(/_/g, ' ')}</p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {value !== null && value !== undefined ? String(value) : 'N/A'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation */}
      {recommendation && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Prescription Recommendation
          </h3>
          {/* <p className="text-gray-700">{recommendation}</p> */}
        </div>
      )}

      {/* Similar Cases */}
      {similar_cases && similar_cases.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Users className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">Similar Cases</h3>
          </div>
          <div className="space-y-4">
            {similar_cases.map((case_, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                {/* Header with CRH number and similarity score */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 text-base">{case_.crh_number}</p>
                    <p className="text-sm text-gray-600 mt-1">{case_.summary}</p>
                  </div>
                  <span className="text-sm font-medium text-purple-600 bg-purple-100 px-3 py-1 rounded-full">
                    {(case_.similarity_score * 100).toFixed(1)}% match
                  </span>
                </div>

                {/* Extracted Data from Similar Case */}
                {case_.data && Object.keys(case_.data).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                      Patient Data
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.entries(case_.data).map(([key, value]) => (
                        <div key={key} className="bg-white p-2 rounded text-xs">
                          <p className="text-gray-500 uppercase tracking-wide">
                            {key.replace(/_/g, ' ')}
                          </p>
                          <p className="mt-0.5 font-medium text-gray-900">
                            {value !== null && value !== undefined ? String(value) : 'N/A'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
