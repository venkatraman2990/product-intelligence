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

// Member types
export interface Member {
  id: string;
  member_id: string;
  name: string;
  total_gwp: string;
  gwp_row_count: number;
  contract_count: number;
}

export interface MemberListResponse {
  members: Member[];
  total: number;
  skip: number;
  limit: number;
}

export interface GWPTreeNode {
  id: string;
  code: string;
  name: string;
  level: 'lob' | 'cob' | 'product' | 'sub_product' | 'mpp';
  total_gwp: string;
  loss_ratio?: string;
  children: GWPTreeNode[];
  gwp_breakdown_ids?: string[];
}

export interface GWPTreeResponse {
  member_id: string;
  member_name: string;
  total_gwp: string;
  tree: GWPTreeNode[];
}

export interface MemberContract {
  id: string;
  member_id: string;
  contract_id: string;
  version_number: string;
  is_current: boolean;
  effective_date: string | null;
  created_at: string;
  contract_filename: string | null;
  contract_file_type: string | null;
}

export interface MemberContractListResponse {
  contracts: MemberContract[];
  total: number;
}

// Portfolio types
export interface AuthorityProductInfo {
  id: string;
  lob_name: string;
  cob_name: string;
  product_name: string;
  sub_product_name: string;
  mpp_name: string;
  contract_name: string;
  total_gwp: string | null;
  loss_ratio: string | null;
  extracted_data: Record<string, unknown>;
}

export interface PortfolioItem {
  id: string;
  portfolio_id: string;
  authority_id: string;
  allocation_pct: string;
  created_at: string;
  authority: AuthorityProductInfo;
}

export interface PortfolioSummary {
  total_premium: string;
  max_annual_premium: string;
  avg_loss_ratio: string | null;
  avg_limit: string | null;
  growth_potential_pct: string | null;
  total_allocation: string;
}

export interface Portfolio {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string | null;
  items: PortfolioItem[];
  summary: PortfolioSummary;
}

export interface PortfolioListItem {
  id: string;
  name: string;
  description: string | null;
  item_count: number;
  total_premium: string;
  avg_loss_ratio: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface PortfolioListResponse {
  portfolios: PortfolioListItem[];
  total: number;
}

export interface InsuranceProduct {
  id: string;
  product_name: string;
  lob_name: string;
  cob_name: string;
  full_product_name: string;
  sub_product_name: string;
  mpp_name: string;
  premium_volume: string | null;
  loss_ratio: string | null;
  contract_name: string;
  member_id: string;
  extracted_data: Record<string, unknown>;
}

export interface InsuranceProductListResponse {
  products: InsuranceProduct[];
  total: number;
  lob_options: string[];
  cob_options: string[];
}
