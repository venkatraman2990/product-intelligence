import { useCallback, useState } from 'react';
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { contractsApi } from '../../api/client';
import type { UploadResponse } from '../../types';

interface FileUploaderProps {
  onUploadComplete?: (response: UploadResponse) => void;
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export default function FileUploader({ onUploadComplete }: FileUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: contractsApi.upload,
    onSuccess: (data) => {
      setUploadStatus('success');
      setUploadResult(data);
      onUploadComplete?.(data);
    },
    onError: (error: Error) => {
      setUploadStatus('error');
      setErrorMessage(error.message || 'Upload failed');
    },
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const validateFile = (file: File): boolean => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    const maxSize = 50 * 1024 * 1024; // 50MB

    if (!allowedTypes.includes(file.type)) {
      setErrorMessage('Invalid file type. Please upload PDF or Word documents.');
      return false;
    }

    if (file.size > maxSize) {
      setErrorMessage('File too large. Maximum size is 50MB.');
      return false;
    }

    return true;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setErrorMessage(null);

    const file = e.dataTransfer.files[0];
    if (file && validateFile(file)) {
      setSelectedFile(file);
      setUploadStatus('idle');
      setUploadResult(null);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      setSelectedFile(file);
      setUploadStatus('idle');
      setUploadResult(null);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      setUploadStatus('uploading');
      setErrorMessage(null);
      uploadMutation.mutate(selectedFile);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setUploadStatus('idle');
    setUploadResult(null);
    setErrorMessage(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full">
      {/* Drop zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <Upload className={`mx-auto h-12 w-12 ${dragActive ? 'text-indigo-500' : 'text-gray-400'}`} />
        <p className="mt-4 text-sm text-gray-600">
          <span className="font-semibold text-indigo-600">Click to upload</span> or drag and drop
        </p>
        <p className="mt-1 text-xs text-gray-500">PDF or Word documents (max 50MB)</p>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          <span className="text-sm">{errorMessage}</span>
        </div>
      )}

      {/* Selected file */}
      {selectedFile && (
        <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <File className="h-8 w-8 text-gray-400" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
            <button
              onClick={handleClear}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Upload progress */}
          {uploadStatus === 'uploading' && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Uploading...</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-indigo-600 h-2 rounded-full animate-pulse w-full" />
              </div>
            </div>
          )}

          {/* Upload success */}
          {uploadStatus === 'success' && uploadResult && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center text-green-700">
                <CheckCircle className="h-5 w-5 mr-2" />
                <span className="text-sm font-medium">
                  {uploadResult.is_duplicate ? 'Duplicate detected' : 'Upload successful'}
                </span>
              </div>
              <p className="mt-1 text-xs text-green-600">{uploadResult.message}</p>
              {uploadResult.page_count && (
                <p className="text-xs text-green-600">{uploadResult.page_count} pages extracted</p>
              )}
            </div>
          )}

          {/* Upload button */}
          {uploadStatus === 'idle' && (
            <button
              onClick={handleUpload}
              className="mt-3 w-full px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Upload Document
            </button>
          )}
        </div>
      )}
    </div>
  );
}
