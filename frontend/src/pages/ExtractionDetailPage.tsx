import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Download,
  FileText,
} from 'lucide-react';
import { extractionsApi, exportsApi } from '../api/client';
import ResultsTable from '../components/results/ResultsTable';

export default function ExtractionDetailPage() {
  const { id } = useParams<{ id: string }>();

  const {
    data: extraction,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['extraction', id],
    queryFn: () => extractionsApi.get(id!),
    enabled: !!id,
    refetchInterval: (data) =>
      data?.status === 'processing' || data?.status === 'pending' ? 2000 : false,
  });

  const handleExport = async (format: 'xlsx' | 'csv' | 'json') => {
    if (!id) return;
    const response = await exportsApi.create({
      extraction_ids: [id],
      format,
    });
    window.open(exportsApi.download(response.download_url.split('/').pop()!), '_blank');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !extraction) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
        <p className="mt-2 text-gray-500">Extraction not found</p>
        <Link
          to="/contracts"
          className="mt-4 inline-flex items-center text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to contracts
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Link
            to={`/contracts/${extraction.contract_id}`}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="ml-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Extraction Results
            </h1>
            <p className="text-sm text-gray-500">
              {extraction.model_provider} / {extraction.model_name}
            </p>
          </div>
        </div>
        {extraction.status === 'completed' && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleExport('xlsx')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </button>
            <button
              onClick={() => handleExport('json')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </button>
          </div>
        )}
      </div>

      {/* Status banner */}
      {extraction.status === 'processing' && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-center">
          <Loader2 className="h-5 w-5 text-indigo-500 animate-spin mr-3" />
          <span className="text-indigo-700">Extracting data from document...</span>
        </div>
      )}

      {extraction.status === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
          <span className="text-red-700">
            {extraction.error_message || 'Extraction failed'}
          </span>
        </div>
      )}

      {extraction.status === 'completed' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
          <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
          <span className="text-green-700">
            Extraction completed • {extraction.fields_extracted || 0} fields extracted
          </span>
        </div>
      )}

      {/* Metadata */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-sm font-medium text-gray-700 mb-4">
          Extraction Details
        </h2>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <dt className="text-xs text-gray-500">Status</dt>
            <dd className="text-sm font-medium text-gray-900 capitalize">
              {extraction.status}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Model</dt>
            <dd className="text-sm font-medium text-gray-900">
              {extraction.model_name}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Started</dt>
            <dd className="text-sm font-medium text-gray-900">
              {extraction.started_at ? formatDate(extraction.started_at) : '-'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Completed</dt>
            <dd className="text-sm font-medium text-gray-900">
              {extraction.completed_at ? formatDate(extraction.completed_at) : '-'}
            </dd>
          </div>
        </dl>
      </div>

      {/* Results */}
      {extraction.status === 'completed' && extraction.extracted_data && (
        <ResultsTable
          data={extraction.extracted_data}
          notes={extraction.extraction_notes}
        />
      )}
    </div>
  );
}
