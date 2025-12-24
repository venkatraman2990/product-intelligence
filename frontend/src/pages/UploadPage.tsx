import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
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
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Contract</h1>
        <p className="text-gray-500 mt-1">
          Upload a PDF or Word document to extract key information
        </p>
      </div>

      {/* Step 1: Upload */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <span className="flex items-center justify-center w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full font-medium text-sm">
            1
          </span>
          <h2 className="ml-3 text-lg font-medium text-gray-900">
            Select Document
          </h2>
        </div>
        <FileUploader onUploadComplete={handleUploadComplete} />
      </div>

      {/* Step 2: Select Model */}
      {uploadResult && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <span className="flex items-center justify-center w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full font-medium text-sm">
              2
            </span>
            <h2 className="ml-3 text-lg font-medium text-gray-900">
              Select Extraction Model
            </h2>
          </div>
          <ModelPicker onSelect={handleModelSelect} />
        </div>
      )}

      {/* Document Preview */}
      {uploadResult && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Document Preview</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 font-medium">
              {uploadResult.page_count} pages detected
            </p>
            {uploadResult.text_preview && (
              <p className="mt-2 text-sm text-gray-500 line-clamp-4">
                {uploadResult.text_preview}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Continue button */}
      {uploadResult && selectedModel && (
        <div className="flex justify-end">
          <button
            onClick={handleContinue}
            className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Continue to Extraction
            <ArrowRight className="ml-2 h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
