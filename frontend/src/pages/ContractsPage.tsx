import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileText, Search, ChevronLeft, ChevronRight, Upload, Trash2 } from 'lucide-react';
import { contractsApi } from '../api/client';

export default function ContractsPage() {
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const limit = 10;

  const { data, isLoading, error } = useQuery({
    queryKey: ['contracts', page, limit],
    queryFn: () => contractsApi.list(page * limit, limit),
  });

  const filteredContracts = data?.contracts?.filter((contract) =>
    contract.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Contracts</h1>
          <p className="text-description mt-1">
            {data?.total || 0} contracts uploaded
          </p>
        </div>
        <Link to="/upload" className="btn-primary">
          <Upload className="h-4 w-4" />
          Upload New
        </Link>
      </div>

      <div className="relative">
        <Search 
          className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5" 
          style={{ color: 'var(--slate-400)' }} 
        />
        <input
          type="text"
          placeholder="Search contracts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div className="px-6 py-12 text-center" style={{ color: 'var(--slate-500)' }}>
            Loading...
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center text-red-500">
            Failed to load contracts
          </div>
        ) : filteredContracts?.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <FileText className="mx-auto h-12 w-12" style={{ color: 'var(--slate-300)' }} />
            <p className="mt-2" style={{ color: 'var(--slate-500)' }}>No contracts found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--slate-50)' }}>
              <tr className="border-b" style={{ borderColor: 'var(--slate-200)' }}>
                <th className="table-header text-left px-5 py-3">Document</th>
                <th className="table-header text-left px-5 py-3">Type</th>
                <th className="table-header text-left px-5 py-3">Size</th>
                <th className="table-header text-left px-5 py-3">Pages</th>
                <th className="table-header text-left px-5 py-3">Uploaded</th>
                <th className="table-header text-right px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredContracts?.map((contract) => (
                <tr 
                  key={contract.id} 
                  className="border-t transition-colors"
                  style={{ borderColor: 'var(--slate-100)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--slate-50)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td className="px-5 py-4">
                    <Link
                      to={`/contracts/${contract.id}`}
                      className="flex items-center group"
                    >
                      <FileText className="h-6 w-6" style={{ color: 'var(--slate-400)' }} />
                      <span 
                        className="ml-3 text-sm font-medium group-hover:underline"
                        style={{ color: 'var(--slate-900)' }}
                      >
                        {contract.original_filename}
                      </span>
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <span className="badge badge-internal">
                      {contract.file_type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm" style={{ color: 'var(--slate-500)' }}>
                    {formatFileSize(contract.file_size_bytes)}
                  </td>
                  <td className="px-5 py-4 text-sm" style={{ color: 'var(--slate-500)' }}>
                    {contract.page_count || '-'}
                  </td>
                  <td className="px-5 py-4 text-sm" style={{ color: 'var(--slate-500)' }}>
                    {formatDate(contract.uploaded_at)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button 
                      className="p-2 rounded-lg transition-colors hover:bg-red-50"
                      style={{ color: 'var(--slate-400)' }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div 
            className="px-5 py-3 flex items-center justify-between border-t"
            style={{ backgroundColor: 'var(--slate-50)', borderColor: 'var(--slate-200)' }}
          >
            <span className="text-sm" style={{ color: 'var(--slate-500)' }}>
              Showing {page * limit + 1} to{' '}
              {Math.min((page + 1) * limit, data?.total || 0)} of {data?.total || 0}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  borderColor: 'var(--slate-200)',
                  backgroundColor: 'white'
                }}
              >
                <ChevronLeft className="h-4 w-4" style={{ color: 'var(--slate-600)' }} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  borderColor: 'var(--slate-200)',
                  backgroundColor: 'white'
                }}
              >
                <ChevronRight className="h-4 w-4" style={{ color: 'var(--slate-600)' }} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
