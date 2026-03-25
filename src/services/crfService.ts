import { PYTHON_API_BASE_URL } from '../config';
import type { AnalysisResponse, ExtractionResult } from '../types/crf';

/**
 * Upload and analyze a CRF PDF file
 */
export const analyzeCRF = async (
  file: File,
  findSimilar: boolean = true,
  numSimilar: number = 5
): Promise<AnalysisResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  console.log("Form data is ", file)

  console.log("Calling the analyze API:", `${PYTHON_API_BASE_URL}/analyze?find_similar=${findSimilar}&num_similar=${numSimilar}`)
  const response = await fetch(
    `${PYTHON_API_BASE_URL}/analyze?find_similar=${findSimilar}&num_similar=${numSimilar}`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    console.log("Error to analyze form data")
    const errorData = await response.json().catch(() => ({ detail: 'Analysis failed' }));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

/**
 * Extract data from CRF PDF (without analysis)
 */
export const extractCRFData = async (file: File): Promise<ExtractionResult> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(
    `${PYTHON_API_BASE_URL}/api/extract`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Extraction failed' }));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  response: string;
}

/**
 * Send a chat message to the /chat-with-data endpoint
 */
export const sendChatMessage = async (
  message: string,
  history: ChatMessage[]
): Promise<ChatResponse> => {
  const response = await fetch(`${PYTHON_API_BASE_URL}/chat-with-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Chat request failed' }));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

/**
 * Save a CRF document's embedding to Supabase via the backend
 */
export const saveEmbedding = async (
  crh_number: string | null,
  data: Record<string, any>
): Promise<void> => {
  const response = await fetch(`${PYTHON_API_BASE_URL}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ crh_number, data }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Save failed' }));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }
};

export interface BulkUploadResponse {
  message: string;
  processed: number;
  skipped: number;
  errors: string[];
}

/**
 * Bulk upload CRF data from a CSV file
 */
export const bulkUploadCSV = async (file: File): Promise<BulkUploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${PYTHON_API_BASE_URL}/bulk-upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Bulk upload failed' }));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

export interface PatientRecord {
  id?: string | number;
  crh_number: string | null;
  data: Record<string, any>;
  created_at?: string;
  [key: string]: any;
}

/**
 * Fetch all patients from the crf_patients table
 */
export const getPatients = async (): Promise<PatientRecord[]> => {
  const response = await fetch(`${PYTHON_API_BASE_URL}/patients`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch patients' }));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

/**
 * Check API health
 */
export const checkHealth = async (): Promise<{ status: string; version: string }> => {
  const response = await fetch(`${PYTHON_API_BASE_URL}/api/health`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};
