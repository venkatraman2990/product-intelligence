import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Download,
} from 'lucide-react';
import { extractionsApi, exportsApi, contractsApi } from '../api/client';
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
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === 'processing' || data?.status === 'pending' ? 2000 : false;
    },
  });

  const { data: contract } = useQuery({
    queryKey: ['contract', extraction?.contract_id],
    queryFn: () => contractsApi.get(extraction!.contract_id),
    enabled: !!extraction?.contract_id,
  });

  const handleExport = async (format: 'xlsx' | 'csv' | 'json') => {
    if (!id) return;
    const response = await exportsApi.create({
      extraction_ids: [id],
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--slate-400)' }} />
      </div>
    );
  }

  if (error || !extraction) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
        <p className="mt-2" style={{ color: 'var(--slate-500)' }}>Extraction not found</p>
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
            to={`/contracts/${extraction.contract_id}`}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--slate-400)' }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="ml-3">
            <h1 className="page-title">Extraction Results</h1>
            <p className="text-description">
              {extraction.model_provider} / {extraction.model_name}
            </p>
          </div>
        </div>
        {extraction.status === 'completed' && (
          <div className="flex items-center gap-2">
            <button onClick={() => handleExport('xlsx')} className="btn-secondary">
              <Download className="h-4 w-4" />
              Export Excel
            </button>
            <button onClick={() => handleExport('csv')} className="btn-secondary">
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button onClick={() => handleExport('json')} className="btn-secondary">
              <Download className="h-4 w-4" />
              Export JSON
            </button>
          </div>
        )}
      </div>

      {extraction.status === 'processing' && (
        <div 
          className="card flex items-center"
          style={{ backgroundColor: 'var(--accelerant-blue-light)', borderColor: 'var(--accelerant-blue-border)' }}
        >
          <Loader2 className="h-5 w-5 animate-spin mr-3" style={{ color: 'var(--accelerant-blue)' }} />
          <span style={{ color: 'var(--accelerant-blue)' }}>Extracting data from document...</span>
        </div>
      )}

      {extraction.status === 'failed' && (
        <div 
          className="card flex items-center"
          style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA' }}
        >
          <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
          <span className="text-red-700">
            {extraction.error_message || 'Extraction failed'}
          </span>
        </div>
      )}

      {extraction.status === 'completed' && (
        <div 
          className="card flex items-center"
          style={{ backgroundColor: 'var(--emerald-50)', borderColor: 'var(--emerald-200)' }}
        >
          <CheckCircle className="h-5 w-5 mr-3" style={{ color: 'var(--success-green)' }} />
          <span style={{ color: 'var(--emerald-700)' }}>
            Extraction completed &bull; {extraction.fields_extracted || 0} fields extracted
          </span>
        </div>
      )}

      <div className="card">
        <h2 className="card-title mb-4">Extraction Details</h2>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <dt className="text-xs" style={{ color: 'var(--slate-500)' }}>Status</dt>
            <dd className="text-sm font-medium capitalize" style={{ color: 'var(--slate-900)' }}>
              {extraction.status}
            </dd>
          </div>
          <div>
            <dt className="text-xs" style={{ color: 'var(--slate-500)' }}>Model</dt>
            <dd className="text-sm font-medium" style={{ color: 'var(--slate-900)' }}>
              {extraction.model_name}
            </dd>
          </div>
          <div>
            <dt className="text-xs" style={{ color: 'var(--slate-500)' }}>Started</dt>
            <dd className="text-sm font-medium" style={{ color: 'var(--slate-900)' }}>
              {extraction.started_at ? formatDate(extraction.started_at) : '-'}
            </dd>
          </div>
          <div>
            <dt className="text-xs" style={{ color: 'var(--slate-500)' }}>Completed</dt>
            <dd className="text-sm font-medium" style={{ color: 'var(--slate-900)' }}>
              {extraction.completed_at ? formatDate(extraction.completed_at) : '-'}
            </dd>
          </div>
        </dl>
      </div>

      {extraction.status === 'completed' && extraction.extracted_data && (
        <ResultsTable
          data={extraction.extracted_data}
          notes={extraction.extraction_notes}
          documentText={contract?.extracted_text || ''}
          contractId={extraction.contract_id}
        />
      )}
    </div>
  );
}
