import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle } from 'lucide-react';
import FileUploader from '../components/upload/FileUploader';
import ModelPicker from '../components/extraction/ModelPicker';
import type { UploadResponse } from '../types';

export default function UploadPage() {
  const navigate = useNavigate();
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [selectedModel, setSelectedModel] = useState<{
    provider: string;
    model: string;
  } | null>(null);

  const handleUploadComplete = useCallback((response: UploadResponse) => {
    setUploadResult(response);
  }, []);

  const handleModelSelect = useCallback((provider: string, model: string) => {
    setSelectedModel({ provider, model });
  }, []);

  const handleContinue = () => {
    if (uploadResult) {
      const contractId = uploadResult.existing_contract_id || uploadResult.id;
      navigate(`/contracts/${contractId}`, {
        state: { selectedModel },
      });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="page-title">Upload Contract</h1>
        <p className="text-description mt-1">
          Upload a PDF or Word document to extract key information
        </p>
      </div>

      <div className="card">
        <div className="flex items-center mb-5">
          <span 
            className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium"
            style={{ 
              backgroundColor: uploadResult ? 'var(--emerald-50)' : 'var(--accelerant-blue-light)',
              color: uploadResult ? 'var(--success-green)' : 'var(--accelerant-blue)'
            }}
          >
            {uploadResult ? <CheckCircle className="h-4 w-4" /> : '1'}
          </span>
          <h2 className="ml-3 section-header">Select Document</h2>
        </div>
        <FileUploader onUploadComplete={handleUploadComplete} />
      </div>

      {uploadResult && (
        <div className="card">
          <div className="flex items-center mb-5">
            <span 
              className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium"
              style={{ 
                backgroundColor: selectedModel ? 'var(--emerald-50)' : 'var(--accelerant-blue-light)',
                color: selectedModel ? 'var(--success-green)' : 'var(--accelerant-blue)'
              }}
            >
              {selectedModel ? <CheckCircle className="h-4 w-4" /> : '2'}
            </span>
            <h2 className="ml-3 section-header">Select Extraction Model</h2>
          </div>
          <ModelPicker onSelect={handleModelSelect} />
        </div>
      )}

      {uploadResult && (
        <div className="card">
          <h3 className="card-title mb-3">Document Preview</h3>
          <div 
            className="rounded-xl p-4"
            style={{ backgroundColor: 'var(--slate-50)' }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--slate-900)' }}>
              {uploadResult.page_count} pages detected
            </p>
            {uploadResult.text_preview && (
              <p 
                className="mt-2 text-sm line-clamp-4"
                style={{ color: 'var(--slate-500)' }}
              >
                {uploadResult.text_preview}
              </p>
            )}
          </div>
        </div>
      )}

      {uploadResult && selectedModel && (
        <div className="flex justify-end">
          <button onClick={handleContinue} className="btn-primary">
            Continue to Extraction
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
