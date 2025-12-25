import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileText, Upload, Clock, CheckCircle, ChevronRight } from 'lucide-react';
import { contractsApi } from '../api/client';

export default function Dashboard() {
  const { data: contractsData, isLoading } = useQuery({
    queryKey: ['contracts', 0, 10],
    queryFn: () => contractsApi.list(0, 10),
  });

  const stats = [
    {
      name: 'Total Contracts',
      value: contractsData?.total || 0,
      icon: FileText,
      bgColor: 'var(--accelerant-blue-light)',
      iconColor: 'var(--accelerant-blue)',
    },
    {
      name: 'Ready for Extraction',
      value: contractsData?.contracts?.filter((c) => !c.is_deleted).length || 0,
      icon: Clock,
      bgColor: '#FEF3C7',
      iconColor: '#D97706',
    },
    {
      name: 'Extracted',
      value: 0,
      icon: CheckCircle,
      bgColor: 'var(--emerald-50)',
      iconColor: 'var(--success-green)',
    },
  ];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-description mt-1">Contract extraction and intelligence</p>
        </div>
        <Link to="/upload" className="btn-primary">
          <Upload className="h-4 w-4" />
          Upload Contract
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="card flex items-center">
            <div 
              className="p-3 rounded-xl"
              style={{ backgroundColor: stat.bgColor }}
            >
              <stat.icon className="h-6 w-6" style={{ color: stat.iconColor }} />
            </div>
            <div className="ml-4">
              <p className="text-sm" style={{ color: 'var(--slate-500)' }}>{stat.name}</p>
              <p className="text-2xl font-semibold" style={{ color: 'var(--slate-900)' }}>
                {isLoading ? '-' : stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div 
          className="px-5 py-4 flex items-center justify-between border-b"
          style={{ borderColor: 'var(--slate-200)' }}
        >
          <div className="flex items-center gap-3">
            <h2 className="section-header">Recent Contracts</h2>
            <span className="count-badge">{contractsData?.total || 0}</span>
          </div>
          <Link
            to="/contracts"
            className="text-sm font-medium flex items-center gap-1 hover:underline"
            style={{ color: 'var(--accelerant-blue)' }}
          >
            View all
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="px-6 py-12 text-center" style={{ color: 'var(--slate-500)' }}>
            Loading...
          </div>
        ) : contractsData?.contracts?.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <FileText className="mx-auto h-12 w-12" style={{ color: 'var(--slate-300)' }} />
            <p className="mt-2" style={{ color: 'var(--slate-500)' }}>No contracts uploaded yet</p>
            <Link
              to="/upload"
              className="mt-4 inline-flex items-center text-sm font-medium"
              style={{ color: 'var(--accelerant-blue)' }}
            >
              <Upload className="h-4 w-4 mr-1" />
              Upload your first contract
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="w-full">
              <thead style={{ backgroundColor: 'var(--slate-50)' }}>
                <tr>
                  <th className="table-header text-left px-5 py-3">Document</th>
                  <th className="table-header text-left px-5 py-3">Type</th>
                  <th className="table-header text-left px-5 py-3">Size</th>
                  <th className="table-header text-left px-5 py-3">Pages</th>
                  <th className="table-header text-left px-5 py-3">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {contractsData?.contracts?.slice(0, 5).map((contract) => (
                  <tr 
                    key={contract.id} 
                    className="border-t transition-colors hover:bg-slate-50"
                    style={{ borderColor: 'var(--slate-100)' }}
                  >
                    <td className="px-5 py-4">
                      <Link
                        to={`/contracts/${contract.id}`}
                        className="flex items-center group"
                      >
                        <FileText className="h-5 w-5 transition-colors" style={{ color: 'var(--slate-400)' }} />
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
