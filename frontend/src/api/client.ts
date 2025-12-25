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
} from '../types';

const API_BASE_URL = '';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Contract endpoints
export const contractsApi = {
  upload: async (file: File): Promise<UploadResponse> => {
    console.log('[Upload] Starting upload for file:', file.name, 'size:', file.size);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('/api/contracts/upload', {
        method: 'POST',
        body: formData,
      });
      
      console.log('[Upload] Response status:', response.status);
      
      if (!response.ok && response.status !== 409) {
        const errorText = await response.text();
        console.error('[Upload] Error response:', errorText);
        throw new Error(errorText || `Upload failed with status ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[Upload] Response data:', data);
      
      if (response.status === 409) {
        return { ...data, is_duplicate: true };
      }
      
      return data;
    } catch (error) {
      console.error('[Upload] Error:', error);
      if (error instanceof TypeError) {
        throw new Error('Unable to connect to the server. Please check your connection and try again.');
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

// Models endpoint
export const modelsApi = {
  getAll: async (): Promise<ModelsResponse> => {
    const response = await api.get('/api/models/picker');
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

export default api;
