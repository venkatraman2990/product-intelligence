import axios from 'axios';
import type {
  Contract,
  ContractListResponse,
  ContractPreview,
  Extraction,
  ExtractionStatus,
  ModelsResponse,
  UploadResponse,
  ExportRequest,
  ExportResponse,
  MemberListResponse,
  GWPTreeResponse,
  MemberContractListResponse,
  MemberContract,
} from '../types';

const API_BASE_URL = '';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Contract endpoints
export const contractsApi = {
  upload: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await api.post('/api/contracts/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number; data?: UploadResponse } };
        if (axiosError.response?.status === 409 && axiosError.response?.data) {
          return {
            ...axiosError.response.data,
            is_duplicate: true,
          };
        }
      }
      throw error;
    }
  },

  list: async (skip = 0, limit = 20): Promise<ContractListResponse> => {
    const response = await api.get('/api/contracts/', {
      params: { skip, limit },
    });
    return response.data;
  },

  get: async (id: string): Promise<Contract> => {
    const response = await api.get(`/api/contracts/${id}`);
    return response.data;
  },

  getPreview: async (id: string): Promise<ContractPreview> => {
    const response = await api.get(`/api/contracts/${id}/preview`);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/contracts/${id}`);
  },
};

// Extraction endpoints
export const extractionsApi = {
  create: async (contractId: string, modelProvider: string, modelName: string): Promise<Extraction> => {
    const response = await api.post('/api/extractions/', {
      contract_id: contractId,
      model_provider: modelProvider,
      model_name: modelName,
    });
    return response.data;
  },

  get: async (id: string): Promise<Extraction> => {
    const response = await api.get(`/api/extractions/${id}`);
    return response.data;
  },

  getStatus: async (id: string): Promise<ExtractionStatus> => {
    const response = await api.get(`/api/extractions/${id}/status`);
    return response.data;
  },

  update: async (id: string, data: Record<string, unknown>): Promise<Extraction> => {
    const response = await api.patch(`/api/extractions/${id}`, {
      extracted_data: data,
    });
    return response.data;
  },

  listByContract: async (contractId: string): Promise<Extraction[]> => {
    const response = await api.get(`/api/extractions/contract/${contractId}`);
    return response.data;
  },
};

// Anthropic models response type
export interface AnthropicModel {
  id: string;
  display_name: string;
  family: string;
  version: string;
  created_at: string;
  description: string;
}

export interface AnthropicModelsResponse {
  is_configured: boolean;
  featured_models: AnthropicModel[];
  other_models: AnthropicModel[];
}

// OpenAI models response type
export interface OpenAIModel {
  id: string;
  display_name: string;
  family: string;
  created: number;
  description: string;
}

export interface OpenAIModelsResponse {
  is_configured: boolean;
  featured_models: OpenAIModel[];
  other_models: OpenAIModel[];
}

// Models endpoint
export const modelsApi = {
  getAll: async (): Promise<ModelsResponse> => {
    const response = await api.get('/api/models/picker');
    return response.data;
  },
  
  getAnthropic: async (): Promise<AnthropicModelsResponse> => {
    const response = await api.get('/api/models/anthropic');
    return response.data;
  },

  getOpenAI: async (): Promise<OpenAIModelsResponse> => {
    const response = await api.get('/api/models/openai');
    return response.data;
  },
};

// Export endpoints
export const exportsApi = {
  create: async (request: ExportRequest): Promise<ExportResponse> => {
    const response = await api.post('/api/exports/', request);
    return response.data;
  },

  download: (filename: string): string => {
    return `${API_BASE_URL}/api/exports/${filename}/download`;
  },
};

// ============================================
// CONTRACT-PRODUCT LINKING TYPES
// ============================================

export interface ProductInfo {
  id: string;
  lob: { code: string; name: string };
  cob: { code: string; name: string };
  product: { code: string; name: string };
  sub_product: { code: string; name: string };
  mpp: { code: string; name: string };
  total_gwp: string;
}

export interface ContractProductLink {
  id: string;
  extraction_id: string;
  gwp_breakdown_id: string;
  link_reason?: string;
  created_at: string;
  updated_at?: string;
  product_info?: ProductInfo;
  has_extraction: boolean;
  extraction_status?: string;
}

export interface ContractProductLinksResponse {
  links: ContractProductLink[];
  total: number;
}

export interface ProductSuggestion {
  gwp_breakdown_id: string;
  product_info: ProductInfo;
  confidence: number;
  reason: string;
}

export interface SuggestProductsResponse {
  extraction_id: string;
  suggestions: ProductSuggestion[];
}

export interface ExtractedFieldData {
  value?: string;
  citation?: string;
  relevance_score?: number;
  reasoning?: string;
}

export interface ProductExtractionResponse {
  id: string;
  contract_link_id: string;
  model_provider: string;
  model_name?: string;
  extracted_data: Record<string, ExtractedFieldData>;
  analysis_summary?: string;
  confidence_score?: number;
  status: string;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export interface BatchAnalyzeResponse {
  extraction_id: string;
  links_analyzed: number;
  status: string;
}

// Members endpoints
export const membersApi = {
  getStats: async (): Promise<{ member_count: number; product_count: number }> => {
    const response = await api.get('/api/members/stats');
    return response.data;
  },

  list: async (skip = 0, limit = 50, search?: string): Promise<MemberListResponse> => {
    const response = await api.get('/api/members/', {
      params: { skip, limit, search },
    });
    return response.data;
  },

  get: async (id: string): Promise<MemberListResponse['members'][0] & { gwp_breakdowns: unknown[] }> => {
    const response = await api.get(`/api/members/${id}`);
    return response.data;
  },

  getGWPTree: async (id: string): Promise<GWPTreeResponse> => {
    const response = await api.get(`/api/members/${id}/gwp-tree`);
    return response.data;
  },

  getContracts: async (id: string): Promise<MemberContractListResponse> => {
    const response = await api.get(`/api/members/${id}/contracts`);
    return response.data;
  },

  linkContract: async (memberId: string, contractId: string, versionNumber?: string): Promise<MemberContract> => {
    const response = await api.post(`/api/members/${memberId}/contracts`, {
      contract_id: contractId,
      version_number: versionNumber || 'v1',
    });
    return response.data;
  },

  createNewVersion: async (
    memberId: string,
    oldContractId: string,
    newContractId: string,
    effectiveDate?: string
  ): Promise<MemberContract> => {
    const response = await api.post(
      `/api/members/${memberId}/contracts/${oldContractId}/new-version`,
      null,
      { params: { new_contract_id: newContractId, effective_date: effectiveDate } }
    );
    return response.data;
  },

  getMembersForContract: async (contractId: string): Promise<{
    members: Array<{
      id: string;
      member_id: string;
      name: string;
      link_id: string;
      version_number: string;
      is_current: boolean;
    }>;
    total: number;
  }> => {
    const response = await api.get(`/api/members/by-contract/${contractId}`);
    return response.data;
  },

  getGWPBreakdowns: async (memberId: string): Promise<{
    breakdowns: Array<{
      id: string;
      lob: { code: string; name: string };
      cob: { code: string; name: string };
      product: { code: string; name: string };
      sub_product: { code: string; name: string };
      mpp: { code: string; name: string };
      total_gwp: string;
    }>;
  }> => {
    const response = await api.get(`/api/members/${memberId}/gwp-tree`);
    return response.data;
  },

  createTermMapping: async (data: {
    extraction_id: string;
    gwp_breakdown_id: string;
    field_path: string;
  }): Promise<unknown> => {
    const response = await api.post('/api/members/term-mappings', data);
    return response.data;
  },

  getTermMappingsForExtraction: async (extractionId: string): Promise<{
    mappings: Array<{
      id: string;
      extraction_id: string;
      gwp_breakdown_id: string;
      field_path: string;
    }>;
    total: number;
  }> => {
    const response = await api.get(`/api/members/term-mappings/extraction/${extractionId}`);
    return response.data;
  },

  unlinkContract: async (memberId: string, contractId: string): Promise<{ message: string }> => {
    const response = await api.delete(`/api/members/${memberId}/contracts/${contractId}`);
    return response.data;
  },

  suggestMappings: async (data: {
    extraction_id: string;
    member_id: string;
    model_provider: string;
    extracted_fields: Array<{ path: string; value: string }>;
    product_combinations: Array<{
      id: string;
      lob: { code: string; name: string };
      cob: { code: string; name: string };
      product: { code: string; name: string };
      sub_product: { code: string; name: string };
      mpp: { code: string; name: string };
      total_gwp: string;
    }>;
  }): Promise<{
    suggestions: Array<{
      field_path: string;
      gwp_breakdown_id: string;
      confidence: number;
      reason: string;
    }>;
  }> => {
    const response = await api.post('/api/members/term-mappings/suggest', data);
    return response.data;
  },

  // ============================================
  // CONTRACT-PRODUCT LINKING (NEW)
  // ============================================

  createContractProductLinks: async (data: {
    extraction_id: string;
    gwp_breakdown_ids: string[];
    link_reason?: string;
  }): Promise<ContractProductLinksResponse> => {
    const response = await api.post('/api/members/contract-links', data);
    return response.data;
  },

  getContractProductLinks: async (extractionId: string): Promise<ContractProductLinksResponse> => {
    const response = await api.get(`/api/members/contract-links/extraction/${extractionId}`);
    return response.data;
  },

  deleteContractProductLink: async (linkId: string): Promise<{ message: string }> => {
    const response = await api.delete(`/api/members/contract-links/${linkId}`);
    return response.data;
  },

  suggestProductsForContract: async (data: {
    extraction_id: string;
    member_id: string;
    model_provider?: string;
  }): Promise<SuggestProductsResponse> => {
    const response = await api.post('/api/members/contract-links/suggest', {
      ...data,
      model_provider: data.model_provider || 'anthropic',
    });
    return response.data;
  },

  // ============================================
  // PRODUCT EXTRACTION (AI ANALYSIS)
  // ============================================

  analyzeProductExtraction: async (data: {
    contract_link_id: string;
    model_provider?: string;
    force?: boolean;
  }): Promise<ProductExtractionResponse> => {
    const response = await api.post('/api/members/product-extractions/analyze', {
      ...data,
      model_provider: data.model_provider || 'anthropic',
      force: data.force || false,
    });
    return response.data;
  },

  getProductExtraction: async (linkId: string): Promise<ProductExtractionResponse> => {
    const response = await api.get(`/api/members/product-extractions/${linkId}`);
    return response.data;
  },

  batchAnalyzeProducts: async (data: {
    extraction_id: string;
    model_provider?: string;
  }): Promise<BatchAnalyzeResponse> => {
    const response = await api.post('/api/members/product-extractions/batch-analyze', {
      ...data,
      model_provider: data.model_provider || 'anthropic',
    });
    return response.data;
  },
};

// ============================================
// AUTHORITIES TYPES
// ============================================

export interface AuthorityListItem {
  id: string;
  member_id: string;
  contract_id: string;
  contract_name: string;
  lob_name: string;
  cob_name: string;
  product_name: string;
  sub_product_name: string;
  mpp_name: string;
  field_count: number;
  created_at: string;
  updated_at?: string;
}

export interface AuthorityListResponse {
  authorities: AuthorityListItem[];
  total: number;
  skip: number;
  limit: number;
}

export interface Authority {
  id: string;
  product_extraction_id: string;
  contract_link_id: string;
  member_id: string;
  gwp_breakdown_id: string;
  lob_name: string;
  cob_name: string;
  product_name: string;
  sub_product_name: string;
  mpp_name: string;
  contract_id: string;
  contract_name: string;
  extracted_data: Record<string, ExtractedFieldData>;
  analysis_summary?: string;
  created_at: string;
  updated_at?: string;
}

export interface AuthorityUpdate {
  extracted_data?: Record<string, ExtractedFieldData>;
  analysis_summary?: string;
}

// Authorities endpoints
export const authoritiesApi = {
  list: async (params?: {
    skip?: number;
    limit?: number;
    search?: string;
    member_id?: string;
  }): Promise<AuthorityListResponse> => {
    const response = await api.get('/api/authorities', { params });
    return response.data;
  },

  get: async (id: string): Promise<Authority> => {
    const response = await api.get(`/api/authorities/${id}`);
    return response.data;
  },

  update: async (id: string, data: AuthorityUpdate): Promise<Authority> => {
    const response = await api.patch(`/api/authorities/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/api/authorities/${id}`);
    return response.data;
  },
};

// ============================================
// SYSTEM PROMPTS TYPES & API
// ============================================

export interface SystemPrompt {
  id: string;
  prompt_key: string;
  display_name: string;
  description?: string;
  prompt_content: string;
  is_custom: boolean;
  created_at: string;
  updated_at?: string;
}

export interface SystemPromptListResponse {
  prompts: SystemPrompt[];
  total: number;
}

export const promptsApi = {
  list: async (): Promise<SystemPromptListResponse> => {
    const response = await api.get('/api/prompts/');
    return response.data;
  },

  get: async (promptKey: string): Promise<SystemPrompt> => {
    const response = await api.get(`/api/prompts/${promptKey}`);
    return response.data;
  },

  update: async (promptKey: string, promptContent: string): Promise<SystemPrompt> => {
    const response = await api.put(`/api/prompts/${promptKey}`, {
      prompt_content: promptContent,
    });
    return response.data;
  },

  reset: async (promptKey: string): Promise<SystemPrompt> => {
    const response = await api.post(`/api/prompts/${promptKey}/reset`);
    return response.data;
  },

  getDefault: async (promptKey: string): Promise<{ prompt_key: string; default_content: string }> => {
    const response = await api.get(`/api/prompts/${promptKey}/default`);
    return response.data;
  },
};

export default api;
