// Contract types
export interface Contract {
  id: string;
  filename: string;
  original_filename: string;
  file_type: string;
  file_size_bytes: number;
  file_hash: string;
  page_count: number | null;
  extracted_text: string | null;
  document_metadata: Record<string, unknown>;
  uploaded_at: string;
  is_deleted: boolean;
}

export interface ContractPreview {
  id: string;
  filename: string;
  page_count: number | null;
  text_preview: string;
  metadata: Record<string, unknown>;
}

// Extraction types
export interface Extraction {
  id: string;
  contract_id: string;
  version_id: string | null;
  model_provider: string;
  model_name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  extracted_data: Record<string, unknown>;
  extraction_notes: string[];
  fields_extracted: number | null;
  created_at: string;
}

export interface ExtractionStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  fields_extracted: number | null;
  error_message: string | null;
}

// Model types
export interface ExtractionModel {
  provider: string;
  model_name: string;
  display_name: string;
  description: string;
  is_configured: boolean;
  is_default: boolean;
}

export interface ModelsByProvider {
  anthropic: ExtractionModel[];
  openai: ExtractionModel[];
  landing_ai: ExtractionModel[];
}

export interface ModelsResponse {
  models: ModelsByProvider;
  configured_providers: string[];
}

// API response types
export interface ContractListResponse {
  contracts: Contract[];
  total: number;
  skip: number;
  limit: number;
}

export interface UploadResponse {
  id: string;
  filename: string;
  page_count: number | null;
  text_preview: string;
  is_duplicate: boolean;
  existing_contract_id?: string;
  message: string;
}

export interface ExportRequest {
  extraction_ids: string[];
  format: 'xlsx' | 'csv' | 'json';
}

export interface ExportResponse {
  export_id: string;
  format: string;
  extraction_count: number;
  download_url: string;
}
