import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Loader2,
  AlertCircle,
  Search,
  Plus,
  Briefcase,
  Trash2,
  Edit2,
  MoreVertical,
} from 'lucide-react';
import { portfoliosApi } from '../api/client';
import type { PortfolioListItem } from '../types';

// Format currency helper
function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

// Format percentage helper
function formatPercent(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return `${(num * 100).toFixed(1)}%`;
}

// Format date helper
function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function PortfoliosPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['portfolios'],
    queryFn: () => portfoliosApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => portfoliosApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      setDeleteModalOpen(null);
    },
  });

  const portfolios = data?.portfolios || [];

  // Filter portfolios by search
  const filteredPortfolios = portfolios.filter((portfolio) =>
    portfolio.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (portfolio.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const handleCreateNew = () => {
    navigate('/portfolios/new');
  };

  const handleEdit = (id: string) => {
    navigate(`/portfolios/${id}`);
    setActiveMenu(null);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--slate-400)' }} />
        <span className="ml-2" style={{ color: 'var(--slate-500)' }}>Loading portfolios...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">Failed to load portfolios</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--slate-900)' }}>
            Modeled Portfolios
          </h1>
          <p className="mt-1" style={{ color: 'var(--slate-500)' }}>
            View and manage your constructed insurance portfolios.
          </p>
        </div>
        <button
          onClick={handleCreateNew}
          className="px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          style={{
            backgroundColor: 'var(--accelerant-blue)',
            color: 'white',
          }}
        >
          <Plus className="h-4 w-4" />
          New Portfolio
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--slate-400)' }} />
        <input
          type="text"
          placeholder="Search portfolios..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-2"
          style={{
            borderColor: 'var(--slate-300)',
            backgroundColor: 'white',
          }}
        />
      </div>

      {/* Portfolios Table */}
      {filteredPortfolios.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ border: '1px solid var(--slate-200)', backgroundColor: 'var(--slate-50)' }}
        >
          <Briefcase className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--slate-300)' }} />
          <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--slate-700)' }}>
            {searchQuery ? 'No portfolios match your search' : 'No portfolios yet'}
          </h3>
          <p className="mb-4" style={{ color: 'var(--slate-500)' }}>
            {searchQuery
              ? 'Try adjusting your search terms.'
              : 'Create your first portfolio by selecting insurance products.'}
          </p>
          {!searchQuery && (
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: 'var(--accelerant-blue)',
                color: 'white',
              }}
            >
              Create Portfolio
            </button>
          )}
        </div>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--slate-200)' }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: 'var(--slate-50)' }}>
                <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--slate-600)' }}>
                  Portfolio Name
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium" style={{ color: 'var(--slate-600)' }}>
                  Products
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium" style={{ color: 'var(--slate-600)' }}>
                  Total Premium
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium" style={{ color: 'var(--slate-600)' }}>
                  Avg Loss Ratio
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--slate-600)' }}>
                  Created
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium" style={{ color: 'var(--slate-600)' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPortfolios.map((portfolio) => (
                <tr
                  key={portfolio.id}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                  style={{ borderTop: '1px solid var(--slate-100)' }}
                  onClick={() => handleEdit(portfolio.id)}
                >
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-medium" style={{ color: 'var(--slate-900)' }}>
                        {portfolio.name}
                      </span>
                      {portfolio.description && (
                        <p className="text-sm mt-0.5" style={{ color: 'var(--slate-500)' }}>
                          {portfolio.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center" style={{ color: 'var(--slate-600)' }}>
                    {portfolio.item_count}
                  </td>
                  <td className="px-4 py-3 text-right font-medium" style={{ color: 'var(--slate-900)' }}>
                    {formatCurrency(portfolio.total_premium)}
                  </td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--slate-600)' }}>
                    {formatPercent(portfolio.avg_loss_ratio)}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--slate-600)' }}>
                    {formatDate(portfolio.created_at)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="relative inline-block">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenu(activeMenu === portfolio.id ? null : portfolio.id);
                        }}
                        className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <MoreVertical className="h-4 w-4" style={{ color: 'var(--slate-500)' }} />
                      </button>
                      {activeMenu === portfolio.id && (
                        <div
                          className="absolute right-0 mt-1 w-36 rounded-lg shadow-lg py-1 z-10"
                          style={{ backgroundColor: 'white', border: '1px solid var(--slate-200)' }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(portfolio.id);
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                            style={{ color: 'var(--slate-700)' }}
                          >
                            <Edit2 className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteModalOpen(portfolio.id);
                              setActiveMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
            style={{ border: '1px solid var(--slate-200)' }}
          >
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--slate-900)' }}>
              Delete Portfolio
            </h3>
            <p className="mb-6" style={{ color: 'var(--slate-600)' }}>
              Are you sure you want to delete this portfolio? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteModalOpen(null)}
                className="px-4 py-2 rounded-lg font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--slate-100)',
                  color: 'var(--slate-700)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteModalOpen)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                style={{
                  backgroundColor: '#DC2626',
                  color: 'white',
                }}
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close menu */}
      {activeMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setActiveMenu(null)}
        />
      )}
    </div>
  );
}
