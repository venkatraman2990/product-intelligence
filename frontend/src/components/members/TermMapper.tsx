import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Link as LinkIcon, Check, Tag, Loader2 } from 'lucide-react';
import { membersApi } from '../../api/client';

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
  const [selectedField, setSelectedField] = useState<string | null>(null);

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

  // Get flattened extraction fields
  const extractedFields = flattenData(extractedData);

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
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

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

                return (
                  <button
                    key={field.path}
                    onClick={() => setSelectedField(isSelected ? null : field.path)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : mappedTo
                        ? 'border-green-300 bg-green-50'
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
