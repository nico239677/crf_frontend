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
  console.log("Calling the chat API:", `${PYTHON_API_BASE_URL}/chat-with-data`)
  console.log("With the body", JSON.stringify({ message, history }))
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
