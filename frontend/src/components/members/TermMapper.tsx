import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Link as LinkIcon, Check, Tag, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { membersApi } from '../../api/client';
import { useSettings } from '../../contexts/SettingsContext';

interface ProductCombination {
  id: string;
  cob: { code: string; name: string };
  lob: { code: string; name: string };
  product: { code: string; name: string };
  sub_product: { code: string; name: string };
  mpp: { code: string; name: string };
  total_gwp: string;
}

interface TermMapperProps {
  extractionId: string;
  extractedData: Record<string, unknown>;
  memberId: string;
  memberName: string;
  onClose: () => void;
}

interface AISuggestion {
  field_path: string;
  gwp_breakdown_id: string;
  confidence: number;
  reason: string;
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

// Flatten extracted data into key-value pairs for display
function flattenData(
  data: Record<string, unknown>,
  prefix = ''
): Array<{ path: string; value: string }> {
  const result: Array<{ path: string; value: string }> = [];

  for (const [key, value] of Object.entries(data)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result.push(...flattenData(value as Record<string, unknown>, path));
    } else if (value !== null && value !== undefined) {
      result.push({
        path,
        value: Array.isArray(value) ? JSON.stringify(value) : String(value),
      });
    }
  }

  return result;
}

export default function TermMapper({
  extractionId,
  extractedData,
  memberId,
  memberName,
  onClose,
}: TermMapperProps) {
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [isSuggestingMappings, setIsSuggestingMappings] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [hasAutoSuggested, setHasAutoSuggested] = useState(false);

  // Get member's GWP tree
  const { data: gwpTree, isLoading: treeLoading } = useQuery({
    queryKey: ['memberGwpTree', memberId],
    queryFn: () => membersApi.getGWPTree(memberId),
  });

  // Get existing mappings for this extraction
  const { data: existingMappings } = useQuery({
    queryKey: ['termMappings', extractionId],
    queryFn: () => membersApi.getTermMappingsForExtraction(extractionId),
  });

  // Create mapping mutation
  const createMappingMutation = useMutation({
    mutationFn: (data: { gwp_breakdown_id: string; field_path: string }) =>
      membersApi.createTermMapping({
        extraction_id: extractionId,
        ...data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['termMappings', extractionId] });
      setSelectedField(null);
    },
  });

  // Get flattened extraction fields (moved up for use in suggestions)
  const extractedFields = flattenData(extractedData);

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

  // Sort by GWP descending
  const sortedCombinations = [...productCombinations].sort((a, b) => {
    const gwpA = parseFloat(a.total_gwp) || 0;
    const gwpB = parseFloat(b.total_gwp) || 0;
    return gwpB - gwpA;
  });

  // Function to request AI suggestions
  const requestSuggestions = async () => {
    if (sortedCombinations.length === 0 || extractedFields.length === 0) {
      setSuggestError('No data available for suggestions');
      return;
    }

    setIsSuggestingMappings(true);
    setSuggestError(null);

    try {
      const response = await membersApi.suggestMappings({
        extraction_id: extractionId,
        member_id: memberId,
        model_provider: settings.mappingModelProvider,
        extracted_fields: extractedFields,
        product_combinations: sortedCombinations,
      });

      setSuggestions(response.suggestions);

      // If autoMapping is enabled, apply all suggestions automatically
      if (settings.autoMapping && response.suggestions.length > 0) {
        for (const suggestion of response.suggestions) {
          // Only apply if not already mapped
          if (!getMappedProductId(suggestion.field_path)) {
            await membersApi.createTermMapping({
              extraction_id: extractionId,
              gwp_breakdown_id: suggestion.gwp_breakdown_id,
              field_path: suggestion.field_path,
            });
          }
        }
        queryClient.invalidateQueries({ queryKey: ['termMappings', extractionId] });
      }
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      setSuggestError('Failed to get AI suggestions. Please try again.');
    } finally {
      setIsSuggestingMappings(false);
    }
  };

  // Auto-suggest on load if autoMapping is enabled
  useEffect(() => {
    if (
      settings.autoMapping &&
      !hasAutoSuggested &&
      sortedCombinations.length > 0 &&
      extractedFields.length > 0 &&
      !treeLoading
    ) {
      setHasAutoSuggested(true);
      requestSuggestions();
    }
  }, [settings.autoMapping, hasAutoSuggested, sortedCombinations.length, extractedFields.length, treeLoading]);

  // Apply a single suggestion
  const applySuggestion = async (suggestion: AISuggestion) => {
    try {
      await membersApi.createTermMapping({
        extraction_id: extractionId,
        gwp_breakdown_id: suggestion.gwp_breakdown_id,
        field_path: suggestion.field_path,
      });
      queryClient.invalidateQueries({ queryKey: ['termMappings', extractionId] });
      // Remove from suggestions list
      setSuggestions(prev => prev.filter(s => s.field_path !== suggestion.field_path));
    } catch (error) {
      console.error('Failed to apply suggestion:', error);
    }
  };

  // Apply all suggestions
  const applyAllSuggestions = async () => {
    for (const suggestion of suggestions) {
      if (!getMappedProductId(suggestion.field_path)) {
        await applySuggestion(suggestion);
      }
    }
  };

  // Get suggestion for a field
  const getSuggestionForField = (fieldPath: string) => {
    return suggestions.find(s => s.field_path === fieldPath);
  };

  // Get confidence badge color
  const getConfidenceBadgeColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-700';
    if (confidence >= 0.5) return 'bg-yellow-100 text-yellow-700';
    return 'bg-slate-100 text-slate-600';
  };

  // Check if a field is already mapped
  const getMappedProductId = (fieldPath: string) => {
    return existingMappings?.mappings.find((m) => m.field_path === fieldPath)?.gwp_breakdown_id;
  };

  // Check if a product has mappings
  const getFieldsMappedToProduct = (productId: string) => {
    return existingMappings?.mappings
      .filter((m) => m.gwp_breakdown_id === productId)
      .map((m) => m.field_path) || [];
  };

  const handleProductClick = (productId: string) => {
    if (selectedField) {
      createMappingMutation.mutate({
        gwp_breakdown_id: productId,
        field_path: selectedField,
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-6xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Map Contract Terms to Products
            </h2>
            <p className="text-sm text-slate-500">
              Member: <span className="font-medium">{memberName}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={requestSuggestions}
              disabled={isSuggestingMappings || sortedCombinations.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSuggestingMappings ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Suggest Mappings
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

        {/* AI Suggestions Banner */}
        {suggestError && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-200 text-red-700 text-sm">
            {suggestError}
          </div>
        )}
        {suggestions.length > 0 && !settings.autoMapping && (
          <div className="px-6 py-3 bg-purple-50 border-b border-purple-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-purple-700">
              <Wand2 className="h-4 w-4" />
              <span className="text-sm font-medium">
                {suggestions.length} AI suggestion{suggestions.length !== 1 ? 's' : ''} available
              </span>
            </div>
            <button
              onClick={applyAllSuggestions}
              className="text-sm px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
            >
              Apply All
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left: Extracted Fields */}
          <div className="w-1/2 border-r border-slate-200 flex flex-col">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h3 className="font-medium text-slate-700 flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Extracted Fields
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Click a field, then click a product to create a mapping
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {extractedFields.map((field) => {
                const mappedTo = getMappedProductId(field.path);
                const isSelected = selectedField === field.path;
                const suggestion = getSuggestionForField(field.path);

                return (
                  <div key={field.path} className="relative">
                    <button
                      onClick={() => setSelectedField(isSelected ? null : field.path)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : mappedTo
                          ? 'border-green-300 bg-green-50'
                          : suggestion
                          ? 'border-purple-300 bg-purple-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {field.path}
                          </p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {field.value}
                          </p>
                        </div>
                        {mappedTo && (
                          <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                    {/* AI Suggestion Card */}
                    {suggestion && !mappedTo && (
                      <div className="mt-1 ml-2 p-2 bg-purple-50 rounded border border-purple-200 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-purple-600" />
                            <span className="font-medium text-purple-700">AI Suggestion</span>
                            <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${getConfidenceBadgeColor(suggestion.confidence)}`}>
                              {Math.round(suggestion.confidence * 100)}%
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              applySuggestion(suggestion);
                            }}
                            className="px-2 py-0.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                          >
                            Apply
                          </button>
                        </div>
                        <p className="text-slate-600 mt-1">{suggestion.reason}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Product Combinations */}
          <div className="w-1/2 flex flex-col">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h3 className="font-medium text-slate-700 flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                Product Combinations
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {selectedField
                  ? `Click to map "${selectedField}"`
                  : 'Select a field first'}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {treeLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  <span className="ml-2 text-slate-500">Loading products...</span>
                </div>
              ) : sortedCombinations.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  No product combinations found
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white border-b border-slate-200">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium text-slate-600">Product</th>
                      <th className="text-right py-2 px-3 font-medium text-slate-600">GWP</th>
                      <th className="text-center py-2 px-3 font-medium text-slate-600 w-16">Mapped</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCombinations.map((combo) => {
                      const mappedFields = getFieldsMappedToProduct(combo.id);
                      const hasMappings = mappedFields.length > 0;

                      return (
                        <tr
                          key={combo.id}
                          onClick={() => selectedField && handleProductClick(combo.id)}
                          className={`border-b border-slate-100 ${
                            selectedField
                              ? 'cursor-pointer hover:bg-blue-50'
                              : ''
                          } ${hasMappings ? 'bg-green-50' : ''}`}
                        >
                          <td className="py-2 px-3">
                            <div className="space-y-0.5">
                              <p className="text-slate-800">
                                {combo.cob.name} / {combo.lob.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {combo.product.name} &rarr; {combo.sub_product.name} &rarr; {combo.mpp.name}
                              </p>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-green-600">
                            {formatCurrency(combo.total_gwp)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {hasMappings && (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                                {mappedFields.length}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="text-sm text-slate-500">
            {existingMappings?.total || 0} mappings created
          </div>
          <button onClick={onClose} className="btn-primary">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
