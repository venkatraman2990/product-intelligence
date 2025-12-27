import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Link as LinkIcon,
  Check,
  Loader2,
  Sparkles,
  ChevronRight,
  Trash2,
  Search,
  CheckSquare,
  Square,
  Brain,
  AlertCircle,
} from 'lucide-react';
import { membersApi } from '../../api/client';
import type {
  ContractProductLink,
  ProductInfo,
  ProductSuggestion,
} from '../../api/client';
import { useSettings } from '../../contexts/SettingsContext';
import ProductExtractionView from './ProductExtractionView';

interface ProductCombination {
  id: string;
  cob: { code: string; name: string };
  lob: { code: string; name: string };
  product: { code: string; name: string };
  sub_product: { code: string; name: string };
  mpp: { code: string; name: string };
  total_gwp: string;
}

interface ContractProductLinkerProps {
  extractionId: string;
  extractedData: Record<string, unknown>;
  memberId: string;
  memberName: string;
  onClose: () => void;
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export default function ContractProductLinker({
  extractionId,
  extractedData,
  memberId,
  memberName,
  onClose,
}: ContractProductLinkerProps) {
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState('');
  const [lobFilter, setLobFilter] = useState<string>('');
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [selectedLinkForAnalysis, setSelectedLinkForAnalysis] = useState<ContractProductLink | null>(null);

  // Get member's GWP tree
  const { data: gwpTree, isLoading: treeLoading } = useQuery({
    queryKey: ['memberGwpTree', memberId],
    queryFn: () => membersApi.getGWPTree(memberId),
  });

  // Get existing contract-product links
  const { data: existingLinks, isLoading: linksLoading } = useQuery({
    queryKey: ['contractProductLinks', extractionId],
    queryFn: () => membersApi.getContractProductLinks(extractionId),
  });

  // Create links mutation
  const createLinksMutation = useMutation({
    mutationFn: (gwpBreakdownIds: string[]) =>
      membersApi.createContractProductLinks({
        extraction_id: extractionId,
        gwp_breakdown_ids: gwpBreakdownIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractProductLinks', extractionId] });
      setSelectedProducts(new Set());
    },
    onError: (error) => {
      console.error('Failed to create links:', error);
      alert('Failed to create links. Check console for details.');
    },
  });

  // Delete link mutation
  const deleteLinkMutation = useMutation({
    mutationFn: (linkId: string) => membersApi.deleteContractProductLink(linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractProductLinks', extractionId] });
    },
  });

  // Build product combinations from tree
  const productCombinations: ProductCombination[] = [];
  if (gwpTree?.tree) {
    const flattenTree = (
      lobNode: { code: string; name: string; children?: unknown[]; total_gwp?: string }
    ) => {
      if (!lobNode.children) return;
      for (const cobNode of lobNode.children as { code: string; name: string; children?: unknown[]; total_gwp?: string }[]) {
        if (!cobNode.children) continue;
        for (const productNode of cobNode.children as { code: string; name: string; children?: unknown[]; total_gwp?: string }[]) {
          if (!productNode.children) continue;
          for (const subProductNode of productNode.children as { code: string; name: string; children?: unknown[]; total_gwp?: string; gwp_breakdown_ids?: string[] }[]) {
            if (!subProductNode.children) continue;
            for (const mppNode of subProductNode.children as { code: string; name: string; total_gwp?: string; gwp_breakdown_ids?: string[] }[]) {
              productCombinations.push({
                id: mppNode.gwp_breakdown_ids?.[0] || `${lobNode.code}-${cobNode.code}-${productNode.code}-${subProductNode.code}-${mppNode.code}`,
                cob: { code: cobNode.code, name: cobNode.name },
                lob: { code: lobNode.code, name: lobNode.name },
                product: { code: productNode.code, name: productNode.name },
                sub_product: { code: subProductNode.code, name: subProductNode.name },
                mpp: { code: mppNode.code, name: mppNode.name },
                total_gwp: mppNode.total_gwp || '0',
              });
            }
          }
        }
      }
    };
    gwpTree.tree.forEach(flattenTree);
  }

  // Get unique LOBs for filter
  const uniqueLOBs = Array.from(new Set(productCombinations.map(p => p.lob.name))).sort();

  // Filter products
  const filteredProducts = productCombinations.filter(combo => {
    if (lobFilter && combo.lob.name !== lobFilter) return false;
    if (searchFilter) {
      const search = searchFilter.toLowerCase();
      return (
        combo.lob.name.toLowerCase().includes(search) ||
        combo.cob.name.toLowerCase().includes(search) ||
        combo.product.name.toLowerCase().includes(search) ||
        combo.sub_product.name.toLowerCase().includes(search) ||
        combo.mpp.name.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // Sort by GWP descending
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const gwpA = parseFloat(a.total_gwp) || 0;
    const gwpB = parseFloat(b.total_gwp) || 0;
    return gwpB - gwpA;
  });

  // Check if a product is already linked
  const isLinked = (productId: string) => {
    return existingLinks?.links.some(l => l.gwp_breakdown_id === productId);
  };

  // Get link for a product
  const getLinkForProduct = (productId: string) => {
    return existingLinks?.links.find(l => l.gwp_breakdown_id === productId);
  };

  // Toggle product selection
  const toggleProduct = (productId: string) => {
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

  // Select all visible products
  const selectAllVisible = () => {
    const unlinkedVisible = sortedProducts.filter(p => !isLinked(p.id));
    setSelectedProducts(new Set(unlinkedVisible.map(p => p.id)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedProducts(new Set());
  };

  // Link selected products
  const linkSelected = () => {
    if (selectedProducts.size > 0) {
      createLinksMutation.mutate(Array.from(selectedProducts));
    }
  };

  // Request AI suggestions
  const requestSuggestions = async () => {
    if (productCombinations.length === 0) {
      setSuggestError('No products available for suggestions');
      return;
    }

    setIsSuggesting(true);
    setSuggestError(null);

    try {
      const response = await membersApi.suggestProductsForContract({
        extraction_id: extractionId,
        member_id: memberId,
        model_provider: settings.mappingModelProvider,
      });

      setSuggestions(response.suggestions);

      // Auto-select suggested products
      const suggestedIds = response.suggestions
        .filter(s => s.confidence >= 0.5)
        .map(s => s.gwp_breakdown_id);
      setSelectedProducts(new Set(suggestedIds.filter(id => !isLinked(id))));
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      setSuggestError('Failed to get AI suggestions. Please try again.');
    } finally {
      setIsSuggesting(false);
    }
  };

  // Get suggestion for a product
  const getSuggestion = (productId: string) => {
    return suggestions.find(s => s.gwp_breakdown_id === productId);
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.5) return 'text-yellow-600 bg-yellow-100';
    return 'text-slate-500 bg-slate-100';
  };

  // If viewing analysis for a specific link
  if (selectedLinkForAnalysis) {
    return (
      <ProductExtractionView
        link={selectedLinkForAnalysis}
        extractedData={extractedData}
        onBack={() => setSelectedLinkForAnalysis(null)}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-6xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Link Contract to Products
            </h2>
            <p className="text-sm text-slate-500">
              Member: <span className="font-medium">{memberName}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={requestSuggestions}
              disabled={isSuggesting || productCombinations.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSuggesting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Suggest Products
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {suggestError && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-200 flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4" />
            {suggestError}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left: Available Products */}
          <div className="w-1/2 border-r border-slate-200 flex flex-col">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-slate-700 flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  Available Products
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAllVisible}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={clearSelection}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    Clear
                  </button>
                </div>
              </div>
              {/* Filters */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchFilter}
                    onChange={e => setSearchFilter(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={lobFilter}
                  onChange={e => setLobFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All LOBs</option>
                  {uniqueLOBs.map(lob => (
                    <option key={lob} value={lob}>{lob}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {treeLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  <span className="ml-2 text-slate-500">Loading products...</span>
                </div>
              ) : sortedProducts.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  No products found
                </div>
              ) : (
                sortedProducts.map(combo => {
                  const linked = isLinked(combo.id);
                  const selected = selectedProducts.has(combo.id);
                  const suggestion = getSuggestion(combo.id);

                  return (
                    <div
                      key={combo.id}
                      className={`p-3 rounded-lg border transition-all ${
                        linked
                          ? 'border-green-300 bg-green-50 opacity-60'
                          : selected
                          ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
                          : suggestion
                          ? 'border-purple-300 bg-purple-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => !linked && toggleProduct(combo.id)}
                          disabled={linked}
                          className="mt-0.5"
                        >
                          {linked ? (
                            <Check className="h-5 w-5 text-green-600" />
                          ) : selected ? (
                            <CheckSquare className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Square className="h-5 w-5 text-slate-400" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-800">
                              {combo.lob.name}
                            </span>
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                            <span className="text-sm text-slate-600">
                              {combo.cob.name}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {combo.product.name} → {combo.sub_product.name} → {combo.mpp.name}
                          </div>
                          {suggestion && (
                            <div className="flex items-center gap-2 mt-2">
                              <Sparkles className="h-3 w-3 text-purple-600" />
                              <span className={`text-xs px-1.5 py-0.5 rounded ${getConfidenceColor(suggestion.confidence)}`}>
                                {Math.round(suggestion.confidence * 100)}% match
                              </span>
                              <span className="text-xs text-slate-500 truncate">
                                {suggestion.reason}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-sm font-medium text-green-600">
                          {formatCurrency(combo.total_gwp)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selection Actions */}
            {selectedProducts.size > 0 && (
              <div className="px-4 py-3 border-t border-slate-200 bg-blue-50">
                <button
                  onClick={linkSelected}
                  disabled={createLinksMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {createLinksMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Linking...
                    </>
                  ) : (
                    <>
                      <LinkIcon className="h-4 w-4" />
                      Link {selectedProducts.size} Product{selectedProducts.size !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Right: Linked Products */}
          <div className="w-1/2 flex flex-col">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h3 className="font-medium text-slate-700 flex items-center gap-2">
                <Check className="h-4 w-4" />
                Linked Products ({existingLinks?.total || 0})
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Click "Analyze" to extract product-specific data
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {linksLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                </div>
              ) : !existingLinks?.links.length ? (
                <div className="py-12 text-center">
                  <LinkIcon className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No products linked yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Select products from the left panel to link them
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {existingLinks.links.map(link => (
                    <div
                      key={link.id}
                      className="p-4 rounded-lg border border-slate-200 bg-white hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {link.product_info && (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-800">
                                  {link.product_info.lob.name}
                                </span>
                                <ChevronRight className="h-3 w-3 text-slate-400" />
                                <span className="text-sm text-slate-600">
                                  {link.product_info.cob.name}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {link.product_info.product.name} → {link.product_info.sub_product.name} → {link.product_info.mpp.name}
                              </div>
                              <div className="text-sm font-medium text-green-600 mt-1">
                                {formatCurrency(link.product_info.total_gwp)}
                              </div>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Analysis Status */}
                          {link.has_extraction && link.extraction_status === 'completed' ? (
                            <button
                              onClick={() => setSelectedLinkForAnalysis(link)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm"
                            >
                              <Check className="h-4 w-4" />
                              View Analysis
                            </button>
                          ) : link.has_extraction && link.extraction_status === 'processing' ? (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Analyzing...
                            </span>
                          ) : (
                            <button
                              onClick={() => setSelectedLinkForAnalysis(link)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm"
                            >
                              <Brain className="h-4 w-4" />
                              Analyze
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => deleteLinkMutation.mutate(link.id)}
                            disabled={deleteLinkMutation.isPending}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="text-sm text-slate-500">
            {existingLinks?.total || 0} product{existingLinks?.total !== 1 ? 's' : ''} linked
          </div>
          <button onClick={onClose} className="btn-primary">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
