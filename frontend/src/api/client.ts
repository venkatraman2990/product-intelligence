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
    
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/contracts/upload', true);
      
      xhr.onload = function() {
        console.log('[Upload] Response received, status:', xhr.status);
        try {
          const data = JSON.parse(xhr.responseText);
          console.log('[Upload] Response data:', data);
          
          if (xhr.status === 409) {
            resolve({ ...data, is_duplicate: true });
          } else if (xhr.status >= 200 && xhr.status < 300) {
            resolve(data);
          } else {
            reject(new Error(data.detail || `Upload failed with status ${xhr.status}`));
          }
        } catch (e) {
          console.error('[Upload] Failed to parse response:', xhr.responseText);
          reject(new Error('Failed to parse server response'));
        }
      };
      
      xhr.onerror = function() {
        console.error('[Upload] XHR error occurred');
        reject(new Error('Unable to connect to the server. Please check your connection and try again.'));
      };
      
      xhr.ontimeout = function() {
        console.error('[Upload] Request timed out');
        reject(new Error('Upload timed out. Please try again.'));
      };
      
      xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          console.log('[Upload] Progress:', percent + '%');
        }
      };
      
      xhr.timeout = 120000;
      console.log('[Upload] Sending request...');
      xhr.send(formData);
    });
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
