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

// Members endpoints
export const membersApi = {
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
};

export default api;
