import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileText, Upload, Clock, CheckCircle } from 'lucide-react';
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
      color: 'bg-blue-500',
    },
    {
      name: 'Ready for Extraction',
      value: contractsData?.contracts?.filter((c) => !c.is_deleted).length || 0,
      icon: Clock,
      color: 'bg-yellow-500',
    },
    {
      name: 'Extracted',
      value: 0, // Would need separate query for extractions
      icon: CheckCircle,
      color: 'bg-green-500',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Contract extraction and intelligence</p>
        </div>
        <Link
          to="/upload"
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Contract
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="bg-white rounded-lg border border-gray-200 p-6 flex items-center"
          >
            <div className={`${stat.color} p-3 rounded-lg`}>
              <stat.icon className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">{stat.name}</p>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? '-' : stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent contracts */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Recent Contracts</h2>
          <Link
            to="/contracts"
            className="text-sm text-indigo-600 hover:text-indigo-700"
          >
            View all
          </Link>
        </div>
        <div className="divide-y divide-gray-200">
          {isLoading ? (
            <div className="px-6 py-8 text-center text-gray-500">Loading...</div>
          ) : contractsData?.contracts?.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-2 text-gray-500">No contracts uploaded yet</p>
              <Link
                to="/upload"
                className="mt-4 inline-flex items-center text-sm text-indigo-600 hover:text-indigo-700"
              >
                <Upload className="h-4 w-4 mr-1" />
                Upload your first contract
              </Link>
            </div>
          ) : (
            contractsData?.contracts?.slice(0, 5).map((contract) => (
              <Link
                key={contract.id}
                to={`/contracts/${contract.id}`}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center">
                  <FileText className="h-8 w-8 text-gray-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">
                      {contract.original_filename}
                    </p>
                    <p className="text-xs text-gray-500">
                      {contract.page_count} pages • {(contract.file_size_bytes / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(contract.uploaded_at).toLocaleDateString()}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
