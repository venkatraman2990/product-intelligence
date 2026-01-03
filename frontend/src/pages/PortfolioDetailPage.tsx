import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Save,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { portfoliosApi, type PortfolioCreate, type PortfolioUpdate } from '../api/client';
import type { Portfolio, InsuranceProduct, PortfolioItem } from '../types';
import ProductGuidelinesModal from '../components/portfolio/ProductGuidelinesModal';

// Format currency
function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '$0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

// Format percentage
function formatPercent(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0%';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0%';
  // Handle both decimal (0.65) and percentage (65) formats
  const pct = num > 1 ? num : num * 100;
  return `${pct.toFixed(1)}%`;
}

// Get field value helper
function getFieldValue(data: Record<string, unknown>, key: string): string | null {
  const field = data[key];
  if (field === null || field === undefined) return null;
  if (typeof field === 'string') return field;
  if (typeof field === 'number') return String(field);
  if (Array.isArray(field)) return field.join(', ');
  if (typeof field === 'object' && 'value' in field) {
    const val = (field as { value: unknown }).value;
    if (val === null || val === undefined) return null;
    if (Array.isArray(val)) return val.join(', ');
    return String(val);
  }
  return null;
}

interface PortfolioItemWithAllocation {
  authority_id: string;
  allocation_pct: number;
  product?: InsuranceProduct;
  item?: PortfolioItem;
}

export default function PortfolioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isNewPortfolio = !id || id === 'new';

  // State for portfolio data
  const [portfolioName, setPortfolioName] = useState('');
  const [portfolioDescription, setPortfolioDescription] = useState('');
  const [items, setItems] = useState<PortfolioItemWithAllocation[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [guidelinesProduct, setGuidelinesProduct] = useState<InsuranceProduct | null>(null);

  // Get selected products from navigation state (when coming from InsuranceProductsPage)
  const selectedProductIds = (location.state as { selectedProductIds?: string[] })?.selectedProductIds || [];

  // Load existing portfolio if editing
  const { data: portfolio, isLoading: isLoadingPortfolio } = useQuery({
    queryKey: ['portfolio', id],
    queryFn: () => portfoliosApi.get(id!),
    enabled: !isNewPortfolio,
  });

  // Load products list for product selection
  const { data: productsData } = useQuery({
    queryKey: ['insurance-products-all'],
    queryFn: () => portfoliosApi.listProducts({ limit: 500 }),
  });

  const allProducts = productsData?.products || [];

  // Initialize from portfolio or selected products
  useEffect(() => {
    if (!isNewPortfolio && portfolio) {
      setPortfolioName(portfolio.name);
      setPortfolioDescription(portfolio.description || '');
      setItems(
        portfolio.items.map(item => ({
          authority_id: item.authority_id,
          allocation_pct: parseFloat(item.allocation_pct),
          item: item,
        }))
      );
    } else if (isNewPortfolio && selectedProductIds.length > 0 && allProducts.length > 0) {
      // Initialize with selected products from InsuranceProductsPage
      const initialItems = selectedProductIds
        .map(productId => {
          const product = allProducts.find(p => p.id === productId);
          if (!product) return null;
          return {
            authority_id: productId,
            allocation_pct: 0,
            product: product,
          };
        })
        .filter((item): item is PortfolioItemWithAllocation => item !== null);
      setItems(initialItems);
    }
  }, [portfolio, isNewPortfolio, selectedProductIds, allProducts]);

  // Compute summary metrics
  const summary = useMemo(() => {
    let totalPremium = 0;
    let maxAnnualPremium = 0;
    let weightedLossRatioSum = 0;
    let lossRatioWeight = 0;
    let weightedLimitSum = 0;
    let limitWeight = 0;
    let totalAllocation = 0;

    items.forEach(item => {
      const allocation = item.allocation_pct || 0;
      totalAllocation += allocation;

      // Get data from either product or item.authority
      const source = item.product || item.item?.authority;
      if (!source) return;

      // Premium (GWP)
      const gwp = parseFloat(String(source.total_gwp || source.premium_volume || 0).replace(/[,$]/g, ''));
      if (!isNaN(gwp)) {
        totalPremium += gwp * allocation / 100;
      }

      // Loss ratio
      const lossRatio = parseFloat(String(source.loss_ratio || 0));
      if (!isNaN(lossRatio) && lossRatio > 0) {
        weightedLossRatioSum += lossRatio * allocation;
        lossRatioWeight += allocation;
      }

      // Get extracted data
      const extractedData = source.extracted_data || {};

      // Max annual premium
      const maxPremiumVal = getFieldValue(extractedData, 'max_annual_premium');
      if (maxPremiumVal) {
        const maxPremium = parseFloat(maxPremiumVal.replace(/[,$]/g, ''));
        if (!isNaN(maxPremium)) {
          maxAnnualPremium += maxPremium * allocation / 100;
        }
      }

      // Max liability limit
      const maxLimitVal = getFieldValue(extractedData, 'max_limits_of_liability') || getFieldValue(extractedData, 'max_policy_limit');
      if (maxLimitVal) {
        const maxLimit = parseFloat(maxLimitVal.replace(/[,$]/g, ''));
        if (!isNaN(maxLimit)) {
          weightedLimitSum += maxLimit * allocation;
          limitWeight += allocation;
        }
      }
    });

    const avgLossRatio = lossRatioWeight > 0 ? weightedLossRatioSum / lossRatioWeight : 0;
    const avgLimit = limitWeight > 0 ? weightedLimitSum / limitWeight : 0;
    const growthPotential = maxAnnualPremium > 0 ? ((maxAnnualPremium - totalPremium) / maxAnnualPremium) * 100 : 0;

    return {
      totalPremium,
      maxAnnualPremium,
      avgLossRatio,
      avgLimit,
      growthPotential,
      totalAllocation,
    };
  }, [items]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: PortfolioCreate) => portfoliosApi.create(data),
    onSuccess: (newPortfolio) => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      navigate(`/portfolios/${newPortfolio.id}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: PortfolioUpdate) => portfoliosApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio', id] });
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => portfoliosApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      navigate('/portfolios');
    },
  });

  const handleSave = () => {
    const data = {
      name: portfolioName,
      description: portfolioDescription || undefined,
      items: items.map(item => ({
        authority_id: item.authority_id,
        allocation_pct: item.allocation_pct,
      })),
    };

    if (isNewPortfolio) {
      createMutation.mutate(data);
    } else {
      updateMutation.mutate(data);
    }
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this portfolio?')) {
      deleteMutation.mutate();
    }
  };

  const updateAllocation = (authorityId: string, allocation: number) => {
    setItems(prev =>
      prev.map(item =>
        item.authority_id === authorityId
          ? { ...item, allocation_pct: Math.min(100, Math.max(0, allocation)) }
          : item
      )
    );
  };

  const removeItem = (authorityId: string) => {
    setItems(prev => prev.filter(item => item.authority_id !== authorityId));
  };

  const addProduct = (product: InsuranceProduct) => {
    if (items.some(item => item.authority_id === product.id)) {
      return; // Already in portfolio
    }
    setItems(prev => [...prev, {
      authority_id: product.id,
      allocation_pct: 0,
      product: product,
    }]);
    setShowAddProductModal(false);
  };

  const toggleItemExpanded = (authorityId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(authorityId)) {
        next.delete(authorityId);
      } else {
        next.add(authorityId);
      }
      return next;
    });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (!isNewPortfolio && isLoadingPortfolio) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--slate-400)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/portfolios"
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" style={{ color: 'var(--slate-500)' }} />
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--slate-900)' }}>
            {isNewPortfolio ? 'Create Portfolio' : 'Edit Portfolio'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {!isNewPortfolio && (
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              style={{
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || !portfolioName}
            className="px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            style={{
              backgroundColor: portfolioName ? 'var(--accelerant-blue)' : 'var(--slate-200)',
              color: portfolioName ? 'white' : 'var(--slate-500)',
            }}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Portfolio
          </button>
        </div>
      </div>

      {/* Portfolio Name */}
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--slate-700)' }}>
          Portfolio Name
        </label>
        <input
          type="text"
          value={portfolioName}
          onChange={(e) => setPortfolioName(e.target.value)}
          placeholder="Enter portfolio name"
          className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2"
          style={{
            borderColor: 'var(--accelerant-blue)',
            backgroundColor: 'white',
          }}
        />
      </div>

      {/* Portfolio Summary Card */}
      <div
        className="p-6 rounded-xl"
        style={{ backgroundColor: 'var(--slate-50)', border: '1px solid var(--slate-200)' }}
      >
        <h2 className="font-semibold text-lg mb-4" style={{ color: 'var(--slate-900)' }}>
          Portfolio Summary
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
          <div>
            <span className="text-sm" style={{ color: 'var(--slate-500)' }}>Total Current Premium</span>
            <p className="text-2xl font-bold" style={{ color: 'var(--slate-900)' }}>
              {formatCurrency(summary.totalPremium)}
            </p>
          </div>
          <div>
            <span className="text-sm" style={{ color: 'var(--slate-500)' }}>Maximum Annual Premium</span>
            <p className="text-2xl font-bold" style={{ color: 'var(--slate-900)' }}>
              {formatCurrency(summary.maxAnnualPremium)}
            </p>
          </div>
          <div>
            <span className="text-sm" style={{ color: 'var(--slate-500)' }}>Average Loss Ratio</span>
            <p className="text-2xl font-bold" style={{ color: 'var(--slate-900)' }}>
              {formatPercent(summary.avgLossRatio)}
            </p>
          </div>
          <div>
            <span className="text-sm" style={{ color: 'var(--slate-500)' }}>Average Limit</span>
            <p className="text-2xl font-bold" style={{ color: 'var(--slate-900)' }}>
              {formatCurrency(summary.avgLimit)}
            </p>
          </div>
        </div>

        {/* Premium Growth Potential Bar */}
        <div>
          <span className="text-sm" style={{ color: 'var(--slate-500)' }}>Premium Growth Potential</span>
          <div className="mt-2 h-6 rounded-full overflow-hidden" style={{ backgroundColor: '#E5F6E7' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, (summary.totalPremium / Math.max(1, summary.maxAnnualPremium)) * 100)}%`,
                backgroundColor: 'var(--accelerant-blue)',
              }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs" style={{ color: 'var(--slate-500)' }}>
            <span>Current Premium</span>
            <span>Max Annual Premium</span>
          </div>
          <div className="flex justify-between text-xs" style={{ color: 'var(--slate-700)' }}>
            <span>{formatCurrency(summary.totalPremium)}</span>
            <span>{formatCurrency(summary.maxAnnualPremium)}</span>
          </div>
        </div>
      </div>

      {/* Selected Products */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg" style={{ color: 'var(--slate-900)' }}>
            Selected Products
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-sm" style={{ color: 'var(--slate-500)' }}>
              Total Allocation: {summary.totalAllocation.toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {items.map((item) => {
            const source = item.product || item.item?.authority;
            if (!source) return null;

            const productName = (item.product?.product_name) ||
              [item.item?.authority.product_name, item.item?.authority.sub_product_name, item.item?.authority.mpp_name]
                .filter(Boolean)
                .join(' - ');
            const lobName = source.lob_name;
            const cobName = source.cob_name;
            const premiumVolume = source.total_gwp || (item.product?.premium_volume);
            const lossRatio = source.loss_ratio;
            const isExpanded = expandedItems.has(item.authority_id);

            return (
              <div
                key={item.authority_id}
                className="rounded-lg overflow-hidden"
                style={{ border: '1px solid var(--slate-200)' }}
              >
                <div className="p-4 bg-white">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium" style={{ color: 'var(--slate-900)' }}>
                        {productName}
                      </h3>
                      <p className="text-sm" style={{ color: 'var(--slate-500)' }}>
                        {lobName} | {cobName}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--slate-500)' }}>
                        Premium Volume: {formatCurrency(premiumVolume)} | Loss Ratio: {formatPercent(lossRatio)}
                      </p>
                      <button
                        onClick={() => toggleItemExpanded(item.authority_id)}
                        className="flex items-center gap-1 text-sm mt-2"
                        style={{ color: 'var(--accelerant-blue)' }}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {isExpanded ? 'Hide' : 'View'} underwriting guidelines
                      </button>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.allocation_pct}
                          onChange={(e) => updateAllocation(item.authority_id, parseFloat(e.target.value) || 0)}
                          className="w-16 px-2 py-1 text-right rounded border focus:outline-none focus:ring-2"
                          style={{ borderColor: 'var(--slate-300)' }}
                        />
                        <span style={{ color: 'var(--slate-500)' }}>%</span>
                      </div>
                      <button
                        onClick={() => removeItem(item.authority_id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Guidelines */}
                {isExpanded && (() => {
                  const extractedData = source.extracted_data || {};
                  const productDescription = getFieldValue(extractedData, 'product_description');
                  const targetOperations = getFieldValue(extractedData, 'target_operations');
                  const eligibleRisks = getFieldValue(extractedData, 'eligible_classes') || getFieldValue(extractedData, 'target_classes');
                  const exclusions = getFieldValue(extractedData, 'exclusions');
                  const permittedTerritories = getFieldValue(extractedData, 'permitted_states');
                  const excludedTerritories = getFieldValue(extractedData, 'excluded_states');

                  return (
                    <div className="p-4 border-t space-y-4" style={{ backgroundColor: 'var(--slate-50)', borderColor: 'var(--slate-200)' }}>
                      {/* Product Description */}
                      {productDescription && (
                        <p className="text-sm" style={{ color: 'var(--slate-600)' }}>{productDescription}</p>
                      )}

                      {/* Premium & Liability Info */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <h4 className="font-medium mb-2" style={{ color: 'var(--slate-800)' }}>Premium Information</h4>
                          <p><span style={{ color: 'var(--slate-500)' }}>Max Annual Premium:</span> {formatCurrency(getFieldValue(extractedData, 'max_annual_premium'))}</p>
                          <p><span style={{ color: 'var(--slate-500)' }}>Rating Basis:</span> {getFieldValue(extractedData, 'rating_basis') || 'N/A'}</p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2" style={{ color: 'var(--slate-800)' }}>Liability Information</h4>
                          <p><span style={{ color: 'var(--slate-500)' }}>Max Liability Limit:</span> {formatCurrency(getFieldValue(extractedData, 'max_limits_of_liability'))}</p>
                          <p><span style={{ color: 'var(--slate-500)' }}>Max Policy Period:</span> {getFieldValue(extractedData, 'max_policy_period') || 'N/A'}</p>
                        </div>
                      </div>

                      {/* Target Operations */}
                      {targetOperations && (
                        <div className="text-sm">
                          <h4 className="font-medium mb-1" style={{ color: 'var(--slate-800)' }}>Target Operations</h4>
                          <p style={{ color: 'var(--slate-600)' }}>{targetOperations}</p>
                        </div>
                      )}

                      {/* Eligible Risks */}
                      {eligibleRisks && (
                        <div className="text-sm">
                          <h4 className="font-medium mb-1" style={{ color: 'var(--slate-800)' }}>Eligible Risks</h4>
                          <p style={{ color: 'var(--slate-600)' }}>{eligibleRisks}</p>
                        </div>
                      )}

                      {/* Exclusions */}
                      {exclusions && (
                        <div className="text-sm">
                          <h4 className="font-medium mb-1" style={{ color: 'var(--slate-800)' }}>Exclusions</h4>
                          <p style={{ color: 'var(--slate-600)' }}>{exclusions}</p>
                        </div>
                      )}

                      {/* Territorial Coverage */}
                      {(permittedTerritories || excludedTerritories) && (
                        <div className="text-sm">
                          <h4 className="font-medium mb-1" style={{ color: 'var(--slate-800)' }}>Territorial Coverage</h4>
                          <div className="grid grid-cols-2 gap-4">
                            {permittedTerritories && (
                              <div>
                                <span style={{ color: 'var(--slate-500)' }}>Permitted Territories:</span>
                                <p style={{ color: 'var(--slate-600)' }}>{permittedTerritories}</p>
                              </div>
                            )}
                            {excludedTerritories && (
                              <div>
                                <span style={{ color: 'var(--slate-500)' }}>Excluded Territories:</span>
                                <p style={{ color: 'var(--slate-600)' }}>{excludedTerritories}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}

          {items.length === 0 && (
            <div className="text-center py-8" style={{ color: 'var(--slate-500)' }}>
              No products selected. Add products to build your portfolio.
            </div>
          )}
        </div>

        {/* Add Product Button */}
        <button
          onClick={() => setShowAddProductModal(true)}
          className="mt-4 w-full py-3 rounded-lg border-2 border-dashed flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
          style={{ borderColor: 'var(--slate-300)', color: 'var(--slate-600)' }}
        >
          <Plus className="h-5 w-5" />
          Add Product
        </button>
      </div>

      {/* Add Product Modal */}
      {showAddProductModal && (
        <AddProductModal
          products={allProducts.filter(p => !items.some(item => item.authority_id === p.id))}
          onSelect={addProduct}
          onClose={() => setShowAddProductModal(false)}
        />
      )}

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

// Add Product Modal Component
function AddProductModal({
  products,
  onSelect,
  onClose,
}: {
  products: InsuranceProduct[];
  onSelect: (product: InsuranceProduct) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedLob, setSelectedLob] = useState('');
  const [selectedCob, setSelectedCob] = useState('');

  const lobOptions = [...new Set(products.map(p => p.lob_name))].filter(Boolean).sort();
  const cobOptions = [...new Set(products.filter(p => !selectedLob || p.lob_name === selectedLob).map(p => p.cob_name))].filter(Boolean).sort();

  const filteredProducts = products.filter(p => {
    if (search && !p.product_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (selectedLob && p.lob_name !== selectedLob) return false;
    if (selectedCob && p.cob_name !== selectedCob) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden"
        style={{ border: '1px solid var(--slate-200)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--slate-200)' }}>
          <h2 className="font-semibold text-lg" style={{ color: 'var(--slate-900)' }}>
            Add Products
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
            <X className="h-5 w-5" style={{ color: 'var(--slate-500)' }} />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b flex gap-4" style={{ borderColor: 'var(--slate-200)' }}>
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border focus:outline-none"
            style={{ borderColor: 'var(--slate-300)' }}
          />
          <select
            value={selectedLob}
            onChange={(e) => { setSelectedLob(e.target.value); setSelectedCob(''); }}
            className="px-3 py-2 rounded-lg border"
            style={{ borderColor: 'var(--slate-300)' }}
          >
            <option value="">All Lines</option>
            {lobOptions.map(lob => <option key={lob} value={lob}>{lob}</option>)}
          </select>
          <select
            value={selectedCob}
            onChange={(e) => setSelectedCob(e.target.value)}
            className="px-3 py-2 rounded-lg border"
            style={{ borderColor: 'var(--slate-300)' }}
          >
            <option value="">All Classes</option>
            {cobOptions.map(cob => <option key={cob} value={cob}>{cob}</option>)}
          </select>
        </div>

        {/* Products Table */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 200px)' }}>
          <table className="w-full">
            <thead className="sticky top-0" style={{ backgroundColor: 'var(--slate-50)' }}>
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium" style={{ color: 'var(--slate-600)' }}>Product</th>
                <th className="px-4 py-2 text-left text-sm font-medium" style={{ color: 'var(--slate-600)' }}>LOB</th>
                <th className="px-4 py-2 text-left text-sm font-medium" style={{ color: 'var(--slate-600)' }}>Class</th>
                <th className="px-4 py-2 text-right text-sm font-medium" style={{ color: 'var(--slate-600)' }}>Premium</th>
                <th className="px-4 py-2 text-right text-sm font-medium" style={{ color: 'var(--slate-600)' }}>Loss Ratio</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-slate-50 border-t" style={{ borderColor: 'var(--slate-100)' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--slate-900)' }}>{product.product_name}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--slate-600)' }}>{product.lob_name}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--slate-600)' }}>{product.cob_name}</td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--slate-900)' }}>{formatCurrency(product.premium_volume)}</td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--slate-600)' }}>{formatPercent(product.loss_ratio)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onSelect(product)}
                      className="px-3 py-1 rounded text-sm font-medium"
                      style={{ backgroundColor: 'var(--accelerant-blue)', color: 'white' }}
                    >
                      Add
                    </button>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--slate-500)' }}>
                    No products available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
