import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Shield, Search, Loader2, AlertCircle, ChevronRight, FileText, Tag } from 'lucide-react';
import { authoritiesApi } from '../api/client';

export default function AuthoritiesPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['authorities', debouncedSearch],
    queryFn: () => authoritiesApi.list({ skip: 0, limit: 100, search: debouncedSearch || undefined }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--accelerant-blue)' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl flex items-center" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
        <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
        <span className="text-red-700">Failed to load authorities</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--slate-900)' }}>
            Authorities
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--slate-500)' }}>
            Editable authority records from contract-product extractions
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg" style={{ backgroundColor: 'var(--slate-100)' }}>
          <Shield className="h-4 w-4" style={{ color: 'var(--accelerant-blue)' }} />
          <span className="font-medium" style={{ color: 'var(--slate-700)' }}>
            {data?.total || 0} records
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={{ color: 'var(--slate-400)' }} />
        <input
          type="text"
          placeholder="Search by contract name, product, LOB..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border transition-colors"
          style={{
            borderColor: 'var(--slate-200)',
            backgroundColor: 'white',
          }}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: 'var(--slate-200)' }}>
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: 'var(--slate-50)' }}>
              <th className="text-left px-6 py-3 text-sm font-medium" style={{ color: 'var(--slate-600)' }}>
                Contract
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium" style={{ color: 'var(--slate-600)' }}>
                Product Combination
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium" style={{ color: 'var(--slate-600)' }}>
                Fields
              </th>
              <th className="text-left px-6 py-3 text-sm font-medium" style={{ color: 'var(--slate-600)' }}>
                Created
              </th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {data?.authorities.map((authority) => (
              <tr
                key={authority.id}
                className="border-t hover:bg-slate-50 transition-colors cursor-pointer"
                style={{ borderColor: 'var(--slate-100)' }}
              >
                <td className="px-6 py-4">
                  <Link to={`/authorities/${authority.id}`} className="block">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" style={{ color: 'var(--slate-400)' }} />
                      <span className="font-medium" style={{ color: 'var(--slate-900)' }}>
                        {authority.contract_name}
                      </span>
                    </div>
                  </Link>
                </td>
                <td className="px-6 py-4">
                  <Link to={`/authorities/${authority.id}`} className="block">
                    <div className="flex items-center gap-1 text-sm" style={{ color: 'var(--slate-600)' }}>
                      <span>{authority.lob_name}</span>
                      <ChevronRight className="h-3 w-3" style={{ color: 'var(--slate-400)' }} />
                      <span>{authority.cob_name}</span>
                      <ChevronRight className="h-3 w-3" style={{ color: 'var(--slate-400)' }} />
                      <span>{authority.product_name}</span>
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--slate-400)' }}>
                      {authority.sub_product_name} / {authority.mpp_name}
                    </div>
                  </Link>
                </td>
                <td className="px-6 py-4">
                  <Link to={`/authorities/${authority.id}`} className="block">
                    <div className="flex items-center gap-1">
                      <Tag className="h-4 w-4" style={{ color: 'var(--accelerant-blue)' }} />
                      <span className="font-medium" style={{ color: 'var(--slate-700)' }}>
                        {authority.field_count}
                      </span>
                      <span className="text-sm" style={{ color: 'var(--slate-500)' }}>fields</span>
                    </div>
                  </Link>
                </td>
                <td className="px-6 py-4">
                  <Link to={`/authorities/${authority.id}`} className="block">
                    <span className="text-sm" style={{ color: 'var(--slate-500)' }}>
                      {new Date(authority.created_at).toLocaleDateString()}
                    </span>
                  </Link>
                </td>
                <td className="px-6 py-4">
                  <Link to={`/authorities/${authority.id}`}>
                    <ChevronRight className="h-5 w-5" style={{ color: 'var(--slate-400)' }} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data?.authorities.length === 0 && (
          <div className="text-center py-12">
            <Shield className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--slate-300)' }} />
            <p className="font-medium" style={{ color: 'var(--slate-600)' }}>
              No authorities found
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--slate-500)' }}>
              Authority records are created automatically when AI product extraction completes
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
