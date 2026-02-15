import React, { useState } from 'react';
import { CheckCircle, AlertCircle, FileText, Users, ChevronDown, ChevronRight, Save, Loader2 } from 'lucide-react';
import type { AnalysisResponse } from '../types/crf';
import { saveEmbedding } from '../services/crfService';

interface AnalysisResultsProps {
  results: AnalysisResponse;
}

export const AnalysisResults: React.FC<AnalysisResultsProps> = ({ results }) => {
  const { extraction, recommendation, similar_cases } = results;
  const [expandedCases, setExpandedCases] = useState<Set<number>>(new Set());
  const [editedData, setEditedData] = useState<Record<string, any>>(extraction.data);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleFieldChange = (key: string, value: string) => {
    setEditedData(prev => ({ ...prev, [key]: value }));
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      await saveEmbedding(extraction.crh_number, editedData);
      setSaveStatus('success');
      console.log('Embedding saved successfully', { crh_number: extraction.crh_number, data: editedData });
    } catch (error) {
      setSaveStatus('error');
      console.error('Failed to save embedding:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCase = (index: number) => {
    const newExpanded = new Set(expandedCases);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedCases(newExpanded);
  };

  const isValueDifferent = (caseValue: any, extractedValue: any): boolean => {
    // Normalize values for comparison
    const normalizeValue = (val: any): string => {
      if (val === null || val === undefined) return '';
      return String(val).toLowerCase().trim();
    };

    return normalizeValue(caseValue) !== normalizeValue(extractedValue);
  };

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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Extracted Patient Data</h3>
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                saveStatus === 'success'
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : saveStatus === 'error'
                  ? 'bg-red-100 text-red-700 border border-red-300'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isSaving ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : saveStatus === 'error' ? 'Error' : 'Save'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(editedData).map(([key, value]) => (
              <div key={key} className="bg-gray-50 p-3 rounded">
                <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">
                  {key.replace(/_/g, ' ')}
                </label>
                <input
                  type="text"
                  value={value !== null && value !== undefined ? String(value) : ''}
                  onChange={e => handleFieldChange(key, e.target.value)}
                  className="w-full text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
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
            {similar_cases.map((case_, index) => {
              const isExpanded = expandedCases.has(index);
              return (
                <div key={index} className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                  {/* Clickable Header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => toggleCase(index)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        {/* Chevron Icon */}
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-600 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-600 flex-shrink-0" />
                        )}
                        <p className="font-semibold text-gray-900 text-base">{case_.crh_number}</p>
                      </div>
                      <span className="text-sm font-medium text-purple-600 bg-purple-100 px-3 py-1 rounded-full">
                        {(case_.similarity_score * 100).toFixed(1)}% match
                      </span>
                    </div>
                  </div>

                  {/* Collapsible Extracted Data */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-300">
                      {/* Patient Data Section */}
                      {case_.data && Object.keys(case_.data).length > 0 ? (
                        <>
                          <div className="flex justify-between items-center mb-3 mt-3">
                            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                              Patient Data ({Object.keys(case_.data).length} fields)
                            </p>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
                            {Object.entries(case_.data).map(([key, value]) => {
                              const extractedValue = extraction.data[key];
                              const isDifferent = isValueDifferent(value, extractedValue);

                              return (
                                <div
                                  key={key}
                                  className={`p-2 rounded text-xs ${
                                    isDifferent ? 'bg-red-50 border border-red-200' : 'bg-white'
                                  }`}
                                >
                                  <p className="text-gray-500 uppercase tracking-wide">
                                    {key.replace(/_/g, ' ')}
                                  </p>
                                  <p className={`mt-0.5 font-medium ${
                                    isDifferent ? 'text-red-700' : 'text-gray-900'
                                  }`}>
                                    {value !== null && value !== undefined ? String(value) : 'N/A'}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <div className="mt-3 p-4 bg-yellow-50 border border-yellow-200 rounded">
                          <p className="text-sm text-yellow-800">
                            No patient data available. Backend needs to send the 'data' field with CSV values for this CRH.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
