import { useQuery, useQueries } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileText, Upload, Clock, CheckCircle, ChevronRight, Users, Package, Plus } from 'lucide-react';
import { contractsApi, membersApi } from '../api/client';

export default function Dashboard() {
  const { data: contractsData, isLoading } = useQuery({
    queryKey: ['contracts', 0, 10],
    queryFn: () => contractsApi.list(0, 10),
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['memberStats'],
    queryFn: () => membersApi.getStats(),
  });

  // Fetch members for each contract
  const contractIds = contractsData?.contracts?.slice(0, 5).map(c => c.id) || [];
  const memberQueries = useQueries({
    queries: contractIds.map(contractId => ({
      queryKey: ['contractMembers', contractId],
      queryFn: () => membersApi.getMembersForContract(contractId),
      enabled: !!contractId,
    })),
  });

  // Build a map of contractId -> member info
  const contractMemberMap: Record<string, { member_id: string; name: string } | null> = {};
  contractIds.forEach((contractId, index) => {
    const queryResult = memberQueries[index];
    if (queryResult?.data?.members?.length > 0) {
      const member = queryResult.data.members[0];
      contractMemberMap[contractId] = {
        member_id: member.member_id,
        name: member.name,
      };
    } else {
      contractMemberMap[contractId] = null;
    }
  });

  // Calculate stats from contracts data
  const extractedCount = contractsData?.contracts?.filter(
    (c) => c.extraction_count > 0
  ).length || 0;
  const readyCount = (contractsData?.total || 0) - extractedCount;

  const stats = [
    {
      name: 'Total Members',
      value: statsData?.member_count || 0,
      icon: Users,
      bgColor: '#E0E7FF',
      iconColor: '#4F46E5',
    },
    {
      name: 'Total Products',
      value: statsData?.product_count || 0,
      icon: Package,
      bgColor: '#FCE7F3',
      iconColor: '#DB2777',
    },
    {
      name: 'Total Contracts',
      value: contractsData?.total || 0,
      icon: FileText,
      bgColor: 'var(--accelerant-blue-light)',
      iconColor: 'var(--accelerant-blue)',
    },
    {
      name: 'Ready for Extraction',
      value: readyCount,
      icon: Clock,
      bgColor: '#FEF3C7',
      iconColor: '#D97706',
    },
    {
      name: 'Extracted',
      value: extractedCount,
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
          <p className="text-description mt-1">Accelerant Risk Exchange Insurance Product Control Tower</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/portfolios/new" className="btn-primary">
            <Plus className="h-4 w-4" />
            New Portfolio
          </Link>
          <Link to="/upload" className="btn-primary">
            <Upload className="h-4 w-4" />
            Upload Contract
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <div key={stat.name} className="card flex items-center p-3 min-w-0">
            <div
              className="p-2 rounded-lg flex-shrink-0"
              style={{ backgroundColor: stat.bgColor }}
            >
              <stat.icon className="h-5 w-5" style={{ color: stat.iconColor }} />
            </div>
            <div className="ml-2 min-w-0 overflow-hidden">
              <p className="text-xs leading-tight truncate" style={{ color: 'var(--slate-500)' }}>{stat.name}</p>
              <p className="text-lg font-semibold" style={{ color: 'var(--slate-900)' }}>
                {(isLoading || statsLoading) ? '-' : stat.value}
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
                  <th className="table-header text-left px-5 py-3">Member ID</th>
                  <th className="table-header text-left px-5 py-3">Member Name</th>
                  <th className="table-header text-left px-5 py-3">Document</th>
                  <th className="table-header text-left px-5 py-3">Type</th>
                  <th className="table-header text-left px-5 py-3">Size</th>
                  <th className="table-header text-left px-5 py-3">Pages</th>
                  <th className="table-header text-left px-5 py-3">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {contractsData?.contracts?.slice(0, 5).map((contract) => {
                  const memberInfo = contractMemberMap[contract.id];
                  return (
                    <tr
                      key={contract.id}
                      className="border-t transition-colors hover:bg-slate-50"
                      style={{ borderColor: 'var(--slate-100)' }}
                    >
                      <td className="px-5 py-4 text-sm" style={{ color: 'var(--slate-500)' }}>
                        {memberInfo?.member_id || '-'}
                      </td>
                      <td className="px-5 py-4 text-sm" style={{ color: 'var(--slate-900)' }}>
                        {memberInfo?.name || '-'}
                      </td>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
