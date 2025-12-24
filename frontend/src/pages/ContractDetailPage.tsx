import { useState, useCallback, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  ArrowLeft,
  Play,
  Loader2,
  CheckCircle,
  AlertCircle,
  Download,
  Clock,
} from 'lucide-react';
import { contractsApi, extractionsApi, exportsApi } from '../api/client';
import ModelPicker from '../components/extraction/ModelPicker';
import ResultsTable from '../components/results/ResultsTable';
import type { Extraction } from '../types';

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [selectedModel, setSelectedModel] = useState<{
    provider: string;
    model: string;
  } | null>(location.state?.selectedModel || null);

  const [activeExtraction, setActiveExtraction] = useState<string | null>(null);

  // Fetch contract details
  const {
    data: contract,
    isLoading: contractLoading,
    error: contractError,
  } = useQuery({
    queryKey: ['contract', id],
    queryFn: () => contractsApi.get(id!),
    enabled: !!id,
  });

  // Fetch extractions for this contract
  const { data: extractions, refetch: refetchExtractions } = useQuery({
    queryKey: ['extractions', id],
    queryFn: () => extractionsApi.listByContract(id!),
    enabled: !!id,
    refetchInterval: activeExtraction ? 2000 : false, // Poll when extraction is running
  });

  // Start extraction mutation
  const startExtractionMutation = useMutation({
    mutationFn: ({
      contractId,
      provider,
      model,
    }: {
      contractId: string;
      provider: string;
      model: string;
    }) => extractionsApi.create(contractId, provider, model),
    onSuccess: (data) => {
      setActiveExtraction(data.id);
      refetchExtractions();
    },
  });

  // Check extraction status and stop polling when complete
  useEffect(() => {
    if (extractions && activeExtraction) {
      const extraction = extractions.find((e: Extraction) => e.id === activeExtraction);
      if (extraction && (extraction.status === 'completed' || extraction.status === 'failed')) {
        setActiveExtraction(null);
        queryClient.invalidateQueries({ queryKey: ['extractions', id] });
      }
    }
  }, [extractions, activeExtraction, queryClient, id]);

  const handleModelSelect = useCallback((provider: string, model: string) => {
    setSelectedModel({ provider, model });
  }, []);

  const handleStartExtraction = () => {
    if (id && selectedModel) {
      startExtractionMutation.mutate({
        contractId: id,
        provider: selectedModel.provider,
        model: selectedModel.model,
      });
    }
  };

  const handleExport = async (extractionId: string, format: 'xlsx' | 'csv' | 'json') => {
    const response = await exportsApi.create({
      extraction_ids: [extractionId],
      format,
    });
    // Download the file
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  if (contractLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (contractError || !contract) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
        <p className="mt-2 text-gray-500">Contract not found</p>
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
            to="/contracts"
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="ml-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {contract.original_filename}
            </h1>
            <p className="text-sm text-gray-500">
              {contract.page_count} pages • Uploaded{' '}
              {formatDate(contract.uploaded_at)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Document info and extraction controls */}
        <div className="lg:col-span-1 space-y-6">
          {/* Document info */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <FileText className="h-10 w-10 text-gray-400" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">
                  {contract.file_type.toUpperCase()}
                </p>
                <p className="text-xs text-gray-500">
                  {(contract.file_size_bytes / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            {contract.extracted_text && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Text Preview
                </h3>
                <p className="text-sm text-gray-600 line-clamp-6 bg-gray-50 p-3 rounded-lg">
                  {contract.extracted_text.slice(0, 500)}...
                </p>
              </div>
            )}
          </div>

          {/* Model picker */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">
              Select Model for Extraction
            </h3>
            <ModelPicker
              onSelect={handleModelSelect}
              disabled={startExtractionMutation.isPending || !!activeExtraction}
            />
            <button
              onClick={handleStartExtraction}
              disabled={
                !selectedModel ||
                startExtractionMutation.isPending ||
                !!activeExtraction
              }
              className="mt-4 w-full inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {startExtractionMutation.isPending || activeExtraction ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Extraction
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right column: Extraction results */}
        <div className="lg:col-span-2 space-y-6">
          {extractions?.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-2 text-gray-500">No extractions yet</p>
              <p className="text-sm text-gray-400">
                Select a model and start extraction
              </p>
            </div>
          ) : (
            extractions?.map((extraction: Extraction) => (
              <div
                key={extraction.id}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden"
              >
                {/* Extraction header */}
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center">
                    {getStatusIcon(extraction.status)}
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">
                        {extraction.model_provider} / {extraction.model_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {extraction.completed_at
                          ? formatDate(extraction.completed_at)
                          : extraction.started_at
                          ? `Started ${formatDate(extraction.started_at)}`
                          : 'Pending'}
                      </p>
                    </div>
                  </div>
                  {extraction.status === 'completed' && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleExport(extraction.id, 'xlsx')}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Excel
                      </button>
                      <button
                        onClick={() => handleExport(extraction.id, 'json')}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        JSON
                      </button>
                    </div>
                  )}
                </div>

                {/* Extraction content */}
                {extraction.status === 'processing' && (
                  <div className="px-6 py-8 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" />
                    <p className="mt-2 text-sm text-gray-500">
                      Extracting data from document...
                    </p>
                  </div>
                )}

                {extraction.status === 'failed' && (
                  <div className="px-6 py-4 bg-red-50">
                    <p className="text-sm text-red-700">
                      {extraction.error_message || 'Extraction failed'}
                    </p>
                  </div>
                )}

                {extraction.status === 'completed' &&
                  extraction.extracted_data && (
                    <div className="p-4">
                      <ResultsTable
                        data={extraction.extracted_data}
                        notes={extraction.extraction_notes}
                      />
                    </div>
                  )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
