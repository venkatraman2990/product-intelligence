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
    const maxSize = 50 * 1024 * 1024;

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
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className="relative border-2 border-dashed rounded-xl p-8 text-center transition-all"
        style={{
          borderColor: dragActive ? 'var(--accelerant-blue)' : 'var(--slate-200)',
          backgroundColor: dragActive ? 'var(--accelerant-blue-light)' : 'transparent',
        }}
      >
        <input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <Upload 
          className="mx-auto h-12 w-12" 
          style={{ color: dragActive ? 'var(--accelerant-blue)' : 'var(--slate-400)' }} 
        />
        <p className="mt-4 text-sm" style={{ color: 'var(--slate-600)' }}>
          <span className="font-semibold" style={{ color: 'var(--accelerant-blue)' }}>Click to upload</span> or drag and drop
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--slate-500)' }}>PDF or Word documents (max 50MB)</p>
      </div>

      {errorMessage && (
        <div 
          className="mt-4 p-3 rounded-xl flex items-center"
          style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}
        >
          <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
          <span className="text-sm text-red-700">{errorMessage}</span>
        </div>
      )}

      {selectedFile && (
        <div 
          className="mt-4 p-4 rounded-xl"
          style={{ backgroundColor: 'white', border: '1px solid var(--slate-200)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <File className="h-8 w-8" style={{ color: 'var(--slate-400)' }} />
              <div className="ml-3">
                <p className="text-sm font-medium" style={{ color: 'var(--slate-900)' }}>{selectedFile.name}</p>
                <p className="text-xs" style={{ color: 'var(--slate-500)' }}>{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
            <button
              onClick={handleClear}
              className="p-1 rounded-lg transition-colors"
              style={{ color: 'var(--slate-400)' }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {uploadStatus === 'uploading' && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1" style={{ color: 'var(--slate-500)' }}>
                <span>Uploading...</span>
              </div>
              <div className="w-full rounded-full h-2" style={{ backgroundColor: 'var(--slate-200)' }}>
                <div 
                  className="h-2 rounded-full animate-pulse w-full" 
                  style={{ backgroundColor: 'var(--accelerant-blue)' }}
                />
              </div>
            </div>
          )}

          {uploadStatus === 'success' && uploadResult && (
            <div 
              className="mt-3 p-3 rounded-xl"
              style={{ backgroundColor: 'var(--emerald-50)', border: '1px solid var(--emerald-200)' }}
            >
              <div className="flex items-center" style={{ color: 'var(--emerald-700)' }}>
                <CheckCircle className="h-5 w-5 mr-2" />
                <span className="text-sm font-medium">
                  {uploadResult.is_duplicate ? 'Duplicate detected' : 'Upload successful'}
                </span>
              </div>
              <p className="mt-1 text-xs" style={{ color: 'var(--success-green)' }}>{uploadResult.message}</p>
              {uploadResult.page_count && (
                <p className="text-xs" style={{ color: 'var(--success-green)' }}>{uploadResult.page_count} pages extracted</p>
              )}
            </div>
          )}

          {uploadStatus === 'idle' && (
            <button onClick={handleUpload} className="btn-primary w-full mt-3">
              Upload Document
            </button>
          )}
        </div>
      )}
    </div>
  );
}
