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
  const [autoExtractTriggered, setAutoExtractTriggered] = useState(false);

  const {
    data: contract,
    isLoading: contractLoading,
    error: contractError,
  } = useQuery({
    queryKey: ['contract', id],
    queryFn: () => contractsApi.get(id!),
    enabled: !!id,
  });

  const { data: extractions, refetch: refetchExtractions } = useQuery({
    queryKey: ['extractions', id],
    queryFn: () => extractionsApi.listByContract(id!),
    enabled: !!id,
    refetchInterval: activeExtraction ? 2000 : false,
  });

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

  useEffect(() => {
    if (extractions && activeExtraction) {
      const extraction = extractions.find((e: Extraction) => e.id === activeExtraction);
      if (extraction && (extraction.status === 'completed' || extraction.status === 'failed')) {
        setActiveExtraction(null);
        queryClient.invalidateQueries({ queryKey: ['extractions', id] });
      }
    }
  }, [extractions, activeExtraction, queryClient, id]);

  // Auto-start extraction when navigating from UploadPage with a pre-selected model
  useEffect(() => {
    if (
      location.state?.selectedModel &&
      contract &&
      extractions !== undefined &&
      extractions.length === 0 &&
      !autoExtractTriggered &&
      !activeExtraction &&
      !startExtractionMutation.isPending &&
      selectedModel
    ) {
      setAutoExtractTriggered(true);
      startExtractionMutation.mutate({
        contractId: id!,
        provider: selectedModel.provider,
        model: selectedModel.model,
      });
    }
  }, [contract, extractions, location.state, autoExtractTriggered, activeExtraction, startExtractionMutation, selectedModel, id]);

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
    const parts = response.download_url.split('/');
    const filename = parts[parts.length - 2];
    window.open(exportsApi.download(filename), '_blank');
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
        return <CheckCircle className="h-5 w-5" style={{ color: 'var(--success-green)' }} />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--accelerant-blue)' }} />;
      default:
        return <Clock className="h-5 w-5" style={{ color: 'var(--slate-400)' }} />;
    }
  };

  if (contractLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--slate-400)' }} />
      </div>
    );
  }

  if (contractError || !contract) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
        <p className="mt-2" style={{ color: 'var(--slate-500)' }}>Contract not found</p>
        <Link
          to="/contracts"
          className="mt-4 inline-flex items-center"
          style={{ color: 'var(--accelerant-blue)' }}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to contracts
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Link
            to="/contracts"
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--slate-400)' }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="ml-3">
            <h1 className="page-title">{contract.original_filename}</h1>
            <p className="text-description">
              {contract.page_count} pages &bull; Uploaded {formatDate(contract.uploaded_at)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="card">
            <div className="flex items-center mb-4">
              <FileText className="h-10 w-10" style={{ color: 'var(--slate-400)' }} />
              <div className="ml-3">
                <p className="text-sm font-medium" style={{ color: 'var(--slate-900)' }}>
                  {contract.file_type.toUpperCase()}
                </p>
                <p className="text-xs" style={{ color: 'var(--slate-500)' }}>
                  {(contract.file_size_bytes / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            {contract.extracted_text && (
              <div className="mt-4">
                <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--slate-600)' }}>
                  Text Preview
                </h3>
                <p 
                  className="text-sm line-clamp-6 p-3 rounded-xl"
                  style={{ 
                    color: 'var(--slate-600)',
                    backgroundColor: 'var(--slate-50)'
                  }}
                >
                  {contract.extracted_text.slice(0, 500)}...
                </p>
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="card-title mb-4">Select Model for Extraction</h3>
            <ModelPicker
              onSelect={handleModelSelect}
              disabled={startExtractionMutation.isPending || !!activeExtraction}
              initialModel={selectedModel}
            />
            <button
              onClick={handleStartExtraction}
              disabled={
                !selectedModel ||
                startExtractionMutation.isPending ||
                !!activeExtraction
              }
              className="btn-primary w-full mt-4"
            >
              {startExtractionMutation.isPending || activeExtraction ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Start Extraction
                </>
              )}
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {extractions?.length === 0 ? (
            <div className="card text-center py-12">
              <FileText className="mx-auto h-12 w-12" style={{ color: 'var(--slate-300)' }} />
              <p className="mt-2" style={{ color: 'var(--slate-500)' }}>No extractions yet</p>
              <p className="text-sm" style={{ color: 'var(--slate-400)' }}>
                Select a model and start extraction
              </p>
            </div>
          ) : (
            extractions?.map((extraction: Extraction) => (
              <div key={extraction.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div 
                  className="px-5 py-4 flex items-center justify-between border-b"
                  style={{ backgroundColor: 'var(--slate-50)', borderColor: 'var(--slate-200)' }}
                >
                  <div className="flex items-center">
                    {getStatusIcon(extraction.status)}
                    <div className="ml-3">
                      <p className="text-sm font-medium" style={{ color: 'var(--slate-900)' }}>
                        {extraction.model_provider} / {extraction.model_name}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--slate-500)' }}>
                        {extraction.completed_at
                          ? formatDate(extraction.completed_at)
                          : extraction.started_at
                          ? `Started ${formatDate(extraction.started_at)}`
                          : 'Pending'}
                      </p>
                    </div>
                  </div>
                  {extraction.status === 'completed' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleExport(extraction.id, 'xlsx')}
                        className="btn-secondary text-sm py-1.5 px-3"
                      >
                        <Download className="h-4 w-4" />
                        Excel
                      </button>
                      <button
                        onClick={() => handleExport(extraction.id, 'json')}
                        className="btn-secondary text-sm py-1.5 px-3"
                      >
                        <Download className="h-4 w-4" />
                        JSON
                      </button>
                    </div>
                  )}
                </div>

                {extraction.status === 'processing' && (
                  <div className="px-6 py-8 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin" style={{ color: 'var(--accelerant-blue)' }} />
                    <p className="mt-2 text-sm" style={{ color: 'var(--slate-500)' }}>
                      Extracting data from document...
                    </p>
                  </div>
                )}

                {extraction.status === 'failed' && (
                  <div className="px-6 py-4" style={{ backgroundColor: '#FEF2F2' }}>
                    <p className="text-sm text-red-700">
                      {extraction.error_message || 'Extraction failed'}
                    </p>
                  </div>
                )}

                {extraction.status === 'completed' && extraction.extracted_data && (
                  <div className="p-5">
                    <ResultsTable
                      data={extraction.extracted_data}
                      notes={extraction.extraction_notes}
                      documentText={contract.extracted_text || ''}
                      contractId={id}
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
