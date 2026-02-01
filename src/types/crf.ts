/**
 * TypeScript types for CRF analysis
 */

export interface ExtractionResult {
  crh_number: string | null;
  data: Record<string, any>;
  success: boolean;
  error: string | null;
}

export interface SimilarCase {
  crh_number: string;
  similarity_score: number;
  summary: string;
  data: Record<string, any>;
}

export interface AnalysisResponse {
  extraction: ExtractionResult;
  recommendation: string;
  similar_cases: SimilarCase[];
}

export interface UploadState {
  file: File | null;
  uploading: boolean;
  progress: number;
}
