import { PYTHON_API_BASE_URL } from '../config';
import { getAccessToken } from '../config/supabase';
import type { AnalysisResponse, ExtractionResult } from '../types/crf';

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

/**
 * Upload and analyze a CRF PDF file
 */
export const analyzeCRF = async (
  file: File,
  findSimilar: boolean = true,
  numSimilar: number = 5,
  tableName: string = 'main'
): Promise<AnalysisResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  console.log("Form data is ", file)

  const url = `${PYTHON_API_BASE_URL}/analyze?find_similar=${findSimilar}&num_similar=${numSimilar}&table_name=${encodeURIComponent(tableName)}`;
  console.log("Calling the analyze API:", url)
  const response = await fetch(
    url,
    {
      method: 'POST',
      headers: await authHeaders(),
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
  has_subset?: boolean;  // true when this assistant message produced a downloadable subset
}

export interface ChatResponse {
  response: string;
  conversation_id: string;
  has_subset: boolean;
}

/**
 * Send a chat message to the /chat-with-data endpoint
 */
export const sendChatMessage = async (
  message: string,
): Promise<ChatResponse> => {
  const response = await fetch(
    `${PYTHON_API_BASE_URL}/chat-with-data`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...await authHeaders() },
      body: JSON.stringify({ message }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Chat request failed' }));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

/**
 * Download the most recent filtered patient subset as CSV
 */
export const downloadChatSubset = async (): Promise<void> => {
  const response = await fetch(
    `${PYTHON_API_BASE_URL}/chat/download`,
    { headers: await authHeaders() }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Download failed' }));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'patients_subset.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Confirm and persist a CRF record to Supabase (crf_patients + embeddings)
 */
export const saveEmbedding = async (
  crh_number: string | null,
  data: Record<string, any>
): Promise<void> => {
  const response = await fetch(`${PYTHON_API_BASE_URL}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify({ crh_number, data }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Confirm failed' }));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }
};

export interface BulkUploadResponse {
  inserted: string[];
  updated: string[];
  skipped: string[];
  errors: { crh_number: string | null; error: string }[];
}

/**
 * Bulk upload CRF data from a CSV file
 */
export const bulkUploadCSV = async (file: File): Promise<BulkUploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${PYTHON_API_BASE_URL}/bulk-upload`, {
    method: 'POST',
    headers: await authHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Bulk upload failed' }));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

/**
 * Bulk upload CRF data from one or more PDF files
 */
export const bulkUploadPDFs = async (files: File[]): Promise<BulkUploadResponse> => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const response = await fetch(`${PYTHON_API_BASE_URL}/bulk-upload-pdfs`, {
    method: 'POST',
    headers: await authHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Bulk upload failed' }));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

export interface PreviewRecord {
  crh_number: string | null;
  data: Record<string, any>;
  duplicate_of: string | null;
}

export interface BulkPreviewResponse {
  records: PreviewRecord[];
  errors: { crh_number: string | null; error: string }[];
}

/**
 * Extract/parse records from CSV or PDF files without inserting (preview step)
 */
export const bulkPreview = async (
  files: File[],
  tableName: string = 'main'
): Promise<BulkPreviewResponse> => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const response = await fetch(
    `${PYTHON_API_BASE_URL}/bulk-preview?table_name=${encodeURIComponent(tableName)}`,
    {
      method: 'POST',
      headers: await authHeaders(),
      body: formData,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Preview failed' }));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

/**
 * Confirm insertion of pre-extracted bulk records into crf_data
 */
export const bulkConfirm = async (
  records: PreviewRecord[],
  tableName: string = 'main'
): Promise<BulkUploadResponse> => {
  const response = await fetch(
    `${PYTHON_API_BASE_URL}/bulk-confirm?table_name=${encodeURIComponent(tableName)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...await authHeaders() },
      body: JSON.stringify({ records }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Confirm failed' }));
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
 * Rename a table (updates table_name in crf_config and crf_data)
 */
export const renameTable = async (oldName: string, newName: string): Promise<void> => {
  const response = await fetch(`${PYTHON_API_BASE_URL}/tables/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify({ old_name: oldName, new_name: newName }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Rename failed' }));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }
};

/**
 * Fetch all table names for the current user (reads crf_config directly via Supabase)
 */
export const getTables = async (): Promise<string[]> => {
  const { getSupabase } = await import('../config/supabase');
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('crf_config')
    .select('table_name');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { table_name: string }) => r.table_name);
};

/**
 * Fetch all patients from the crf_patients table
 */
export const getPatients = async (tableName: string = 'main'): Promise<PatientRecord[]> => {
  console.log("Getting all CRs")
  const response = await fetch(`${PYTHON_API_BASE_URL}/patients?table_name=${encodeURIComponent(tableName)}`, {
    headers: await authHeaders(),
  });

  console.log(response)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch patients' }));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

export interface SchemaField {
  name: string;
  type: string;
  description: string;
  sections: string[];
  optional: boolean;
  constraints: Record<string, number | string | undefined>;
  literal_values: string[];
}

/**
 * Fetch the current CRF field schema
 */
export const getSchema = async (tableName: string = 'main'): Promise<SchemaField[]> => {
  const response = await fetch(`${PYTHON_API_BASE_URL}/schema?table_name=${encodeURIComponent(tableName)}`, {
    headers: await authHeaders(),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch schema' }));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }
  return await response.json();
};

/**
 * Update the CRF field schema (rename/add columns + save JSON)
 */
export const updateSchema = async (
  fields: SchemaField[],
  renames: Record<string, string> = {},
  tableName: string = 'main'
): Promise<{ status: string; fields: number; ddl_run: string[] }> => {
  const response = await fetch(`${PYTHON_API_BASE_URL}/schema?table_name=${encodeURIComponent(tableName)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify({ schema: fields, renames }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Schema update failed' }));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }
  return await response.json();
};

/**
 * Pre-warm the chatbot (loads all user tables — fire-and-forget)
 */
export const warmupChatbot = async (): Promise<void> => {
  const headers = await authHeaders();
  fetch(`${PYTHON_API_BASE_URL}/chatbot/warmup`, {
    method: 'POST',
    headers,
  }).catch(() => {/* warmup is best-effort */});
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
