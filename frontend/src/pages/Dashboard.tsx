import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileText, Upload, CheckCircle, Database, FileSpreadsheet, Download } from 'lucide-react';
import { contractsApi } from '../api/client';

export default function Dashboard() {
  const { data: contractsData, isLoading } = useQuery({
    queryKey: ['contracts', 0, 100],
    queryFn: () => contractsApi.list(0, 100),
  });

  const totalContracts = contractsData?.total || 0;
  const extractedCount = 0;

  const stats = [
    {
      name: 'Total Contracts',
      value: totalContracts,
      description: 'Documents uploaded and ready for processing',
      icon: FileText,
      bgColor: '#EEF2FF',
      iconColor: '#3B82F6',
    },
    {
      name: 'Total Fields',
      value: extractedCount > 0 ? extractedCount * 25 : 0,
      description: 'Total extracted data fields across all contracts',
      icon: Database,
      bgColor: '#EEF2FF',
      iconColor: '#3B82F6',
    },
    {
      name: 'Extracted',
      value: extractedCount,
      description: 'Contracts with completed extractions',
      icon: CheckCircle,
      bgColor: '#ECFDF5',
      iconColor: '#10B981',
    },
    {
      name: 'Pending',
      value: totalContracts - extractedCount,
      description: 'Contracts awaiting extraction',
      icon: Upload,
      bgColor: '#FEF3C7',
      iconColor: '#F59E0B',
      badge: totalContracts - extractedCount > 0 ? 'Action Needed' : null,
    },
  ];

  const features = [
    {
      name: 'Contracts',
      description: 'Browse and manage uploaded contract documents.',
      icon: FileText,
      buttonText: 'View Contracts',
      href: '/contracts',
      buttonColor: '#10B981',
    },
    {
      name: 'Upload Documents',
      description: 'Upload new PDF or Word contracts for extraction.',
      icon: Upload,
      buttonText: 'Upload',
      href: '/upload',
      buttonColor: '#3B82F6',
    },
    {
      name: 'Bulk Import',
      description: 'Upload multiple contracts at once for batch processing.',
      icon: Download,
      buttonText: 'Import Contracts',
      href: '/upload',
      buttonColor: '#F59E0B',
    },
    {
      name: 'Export Data',
      description: 'Export extracted data to Excel or JSON formats.',
      icon: FileSpreadsheet,
      buttonText: 'Export',
      href: '/contracts',
      buttonColor: '#10B981',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 
          className="text-2xl font-semibold"
          style={{ color: 'var(--slate-900)' }}
        >
          Welcome to your workspace
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat) => (
          <div 
            key={stat.name} 
            className="bg-white rounded-xl p-5 border"
            style={{ borderColor: 'var(--slate-200)' }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--slate-600)' }}>
                  {stat.name}
                </p>
                <p className="text-3xl font-bold mt-1" style={{ color: 'var(--slate-900)' }}>
                  {isLoading ? '-' : stat.value}
                </p>
              </div>
              <div 
                className="p-2.5 rounded-xl"
                style={{ backgroundColor: stat.bgColor }}
              >
                <stat.icon className="h-5 w-5" style={{ color: stat.iconColor }} />
              </div>
            </div>
            <p className="text-xs mt-3" style={{ color: 'var(--slate-500)' }}>
              {stat.description}
            </p>
            {stat.badge && (
              <span 
                className="inline-block mt-2 px-2 py-0.5 text-xs font-medium rounded"
                style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}
              >
                {stat.badge}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {features.map((feature) => (
          <div 
            key={feature.name}
            className="bg-white rounded-xl p-6 border text-center"
            style={{ borderColor: 'var(--slate-200)' }}
          >
            <div 
              className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-4"
              style={{ backgroundColor: `${feature.buttonColor}15` }}
            >
              <feature.icon className="h-6 w-6" style={{ color: feature.buttonColor }} />
            </div>
            <h3 className="font-semibold" style={{ color: 'var(--slate-900)' }}>
              {feature.name}
            </h3>
            <p className="text-sm mt-2 mb-4" style={{ color: 'var(--slate-500)' }}>
              {feature.description}
            </p>
            <Link
              to={feature.href}
              className="inline-block w-full py-2.5 px-4 rounded-full text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: feature.buttonColor }}
            >
              {feature.buttonText}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
