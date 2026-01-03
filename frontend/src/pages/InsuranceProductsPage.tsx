import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Loader2,
  AlertCircle,
  Search,
  Package,
  FileText,
  ChevronDown,
  X,
} from 'lucide-react';
import { portfoliosApi } from '../api/client';
import type { InsuranceProduct } from '../types';
import ProductGuidelinesModal from '../components/portfolio/ProductGuidelinesModal';

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
  // Convert from decimal (0.65) to percentage (65%)
  return `${(num * 100).toFixed(1)}%`;
}

export default function InsuranceProductsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLob, setSelectedLob] = useState<string>('');
  const [selectedCob, setSelectedCob] = useState<string>('');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [guidelinesProduct, setGuidelinesProduct] = useState<InsuranceProduct | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['insurance-products', searchQuery, selectedLob, selectedCob],
    queryFn: () => portfoliosApi.listProducts({
      search: searchQuery || undefined,
      lob: selectedLob || undefined,
      cob: selectedCob || undefined,
      limit: 500,
    }),
  });

  const products = data?.products || [];
  const lobOptions = data?.lob_options || [];
  const cobOptions = data?.cob_options || [];

  // Filter COB options based on selected LOB
  const filteredCobOptions = useMemo(() => {
    if (!selectedLob) return cobOptions;
    const cobsForLob = new Set(
      products
        .filter(p => p.lob_name === selectedLob)
        .map(p => p.cob_name)
    );
    return cobOptions.filter(cob => cobsForLob.has(cob));
  }, [selectedLob, products, cobOptions]);

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedProducts(new Set(products.map(p => p.id)));
  };

  const clearSelection = () => {
    setSelectedProducts(new Set());
  };

  const handleCreatePortfolio = () => {
    // Navigate to portfolio creation with selected products
    const selectedIds = Array.from(selectedProducts);
    navigate('/portfolios/new', { state: { selectedProductIds: selectedIds } });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedLob('');
    setSelectedCob('');
  };

  const hasFilters = searchQuery || selectedLob || selectedCob;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--slate-400)' }} />
        <span className="ml-2" style={{ color: 'var(--slate-500)' }}>Loading products...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">Failed to load insurance products</span>
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
            Insurance Products
          </h1>
          <p className="mt-1" style={{ color: 'var(--slate-500)' }}>
            Browse and select from our available specialty insurance products to build your portfolio.
          </p>
        </div>
        <button
          onClick={handleCreatePortfolio}
          disabled={selectedProducts.size === 0}
          className="px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          style={{
            backgroundColor: selectedProducts.size > 0 ? 'var(--accelerant-blue)' : 'var(--slate-200)',
            color: selectedProducts.size > 0 ? 'white' : 'var(--slate-500)',
            cursor: selectedProducts.size > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          <Package className="h-4 w-4" />
          Create Portfolio ({selectedProducts.size})
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--slate-400)' }} />
          <input
            type="text"
            placeholder="Search by name or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-2"
            style={{
              borderColor: 'var(--slate-300)',
              backgroundColor: 'white',
            }}
          />
        </div>

        {/* Line of Business Filter */}
        <div className="relative min-w-[180px]">
          <select
            value={selectedLob}
            onChange={(e) => {
              setSelectedLob(e.target.value);
              setSelectedCob(''); // Reset COB when LOB changes
            }}
            className="w-full appearance-none px-3 py-2 pr-8 rounded-lg border focus:outline-none focus:ring-2"
            style={{
              borderColor: 'var(--slate-300)',
              backgroundColor: 'white',
              color: selectedLob ? 'var(--slate-900)' : 'var(--slate-500)',
            }}
          >
            <option value="">All Lines of Business</option>
            {lobOptions.map(lob => (
              <option key={lob} value={lob}>{lob}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--slate-400)' }} />
        </div>

        {/* Class of Business Filter */}
        <div className="relative min-w-[180px]">
          <select
            value={selectedCob}
            onChange={(e) => setSelectedCob(e.target.value)}
            className="w-full appearance-none px-3 py-2 pr-8 rounded-lg border focus:outline-none focus:ring-2"
            style={{
              borderColor: 'var(--slate-300)',
              backgroundColor: 'white',
              color: selectedCob ? 'var(--slate-900)' : 'var(--slate-500)',
            }}
          >
            <option value="">All Classes of Business</option>
            {filteredCobOptions.map(cob => (
              <option key={cob} value={cob}>{cob}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--slate-400)' }} />
        </div>

        {/* Clear Filters */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            style={{ color: 'var(--slate-600)' }}
          >
            <X className="h-4 w-4" />
            Clear filters
          </button>
        )}
      </div>

      {/* Selection Actions */}
      {products.length > 0 && (
        <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--slate-600)' }}>
          <span>{products.length} products</span>
          <span>|</span>
          <button
            onClick={selectAll}
            className="hover:underline"
            style={{ color: 'var(--accelerant-blue)' }}
          >
            Select all
          </button>
          {selectedProducts.size > 0 && (
            <>
              <span>|</span>
              <button
                onClick={clearSelection}
                className="hover:underline"
                style={{ color: 'var(--slate-600)' }}
              >
                Clear selection
              </button>
            </>
          )}
        </div>
      )}

      {/* Products Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--slate-200)' }}
      >
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: 'var(--slate-50)' }}>
              <th className="w-12 px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedProducts.size === products.length && products.length > 0}
                  onChange={(e) => e.target.checked ? selectAll() : clearSelection()}
                  className="rounded border-slate-300"
                />
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--slate-600)' }}>
                Product
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--slate-600)' }}>
                Line of Business
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--slate-600)' }}>
                Class
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium" style={{ color: 'var(--slate-600)' }}>
                Premium Volume
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium" style={{ color: 'var(--slate-600)' }}>
                Loss Ratio
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium" style={{ color: 'var(--slate-600)' }}>
                Guidelines
              </th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--slate-500)' }}>
                  No products found. {hasFilters && 'Try adjusting your filters.'}
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr
                  key={product.id}
                  className="hover:bg-slate-50 transition-colors"
                  style={{ borderTop: '1px solid var(--slate-100)' }}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedProducts.has(product.id)}
                      onChange={() => toggleProductSelection(product.id)}
                      className="rounded border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium" style={{ color: 'var(--slate-900)' }}>
                      {product.product_name}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--slate-600)' }}>
                    {product.lob_name}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--slate-600)' }}>
                    {product.cob_name}
                  </td>
                  <td className="px-4 py-3 text-right font-medium" style={{ color: 'var(--slate-900)' }}>
                    {formatCurrency(product.premium_volume)}
                  </td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--slate-600)' }}>
                    {formatPercent(product.loss_ratio)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setGuidelinesProduct(product)}
                      className="text-sm hover:underline flex items-center justify-center gap-1 mx-auto"
                      style={{ color: 'var(--accelerant-blue)' }}
                    >
                      <FileText className="h-4 w-4" />
                      View guidelines
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Guidelines Modal */}
      {guidelinesProduct && (
        <ProductGuidelinesModal
          product={guidelinesProduct}
          onClose={() => setGuidelinesProduct(null)}
        />
      )}
    </div>
  );
}
