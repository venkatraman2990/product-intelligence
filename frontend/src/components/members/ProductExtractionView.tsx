import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  X,
  Brain,
  Loader2,
  Check,
  AlertCircle,
  Quote,
  ChevronRight,
  ChevronDown,
  FileText,
  Sparkles,
} from 'lucide-react';
import { membersApi } from '../../api/client';
import type {
  ContractProductLink,
  ProductExtractionResponse,
  ExtractedFieldData,
} from '../../api/client';
import { useSettings } from '../../contexts/SettingsContext';

interface ProductExtractionViewProps {
  link: ContractProductLink;
  extractedData: Record<string, unknown>;
  onBack: () => void;
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

// Field with inline citation display
function FieldWithCitation({
  path,
  data,
}: {
  path: string;
  data: ExtractedFieldData;
}) {
  const [showCitation, setShowCitation] = useState(false);

  const getRelevanceColor = (score?: number) => {
    if (!score) return 'bg-slate-100 text-slate-600';
    if (score >= 0.8) return 'bg-green-100 text-green-700';
    if (score >= 0.5) return 'bg-yellow-100 text-yellow-700';
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="p-3 bg-white rounded-lg border border-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700">{path}</p>
          <p className="text-base text-slate-900 mt-1">{data.value || 'N/A'}</p>
        </div>

        <div className="flex items-center gap-2">
          {data.relevance_score !== undefined && (
            <span className={`text-xs px-2 py-1 rounded ${getRelevanceColor(data.relevance_score)}`}>
              {Math.round(data.relevance_score * 100)}% relevant
            </span>
          )}
          {data.citation && (
            <button
              onClick={() => setShowCitation(!showCitation)}
              className={`p-1.5 rounded transition-colors ${
                showCitation
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50'
              }`}
              title="View citation"
            >
              <Quote className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Citation Inline */}
      {showCitation && data.citation && (
        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-2">
            <Quote className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-800 italic">"{data.citation}"</p>
              {data.reasoning && (
                <p className="text-xs text-blue-600 mt-2">
                  <strong>AI Reasoning:</strong> {data.reasoning}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductExtractionView({
  link,
  extractedData,
  onBack,
  onClose,
}: ProductExtractionViewProps) {
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const [extraction, setExtraction] = useState<ProductExtractionResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['all']));

  // Analyze mutation
  const analyzeMutation = useMutation({
    mutationFn: async (force: boolean = false) => {
      try {
        return await membersApi.analyzeProductExtraction({
          contract_link_id: link.id,
          model_provider: settings.mappingModelProvider,
          force,
        });
      } catch (error) {
        // Extract clean error message to prevent circular reference issues
        const message = error instanceof Error
          ? error.message
          : 'An unexpected error occurred during analysis';
        throw new Error(message);
      }
    },
    onSuccess: (data) => {
      setExtraction(data);
      setIsAnalyzing(false);
      queryClient.invalidateQueries({ queryKey: ['contractProductLinks'] });
      queryClient.invalidateQueries({ queryKey: ['authorities'] });
    },
    onError: (err: Error) => {
      setError(err.message || 'Analysis failed');
      setIsAnalyzing(false);
    },
  });

  // Load existing extraction if available
  useEffect(() => {
    if (link.has_extraction && link.extraction_status === 'completed') {
      membersApi.getProductExtraction(link.id)
        .then(setExtraction)
        .catch(err => console.error('Failed to load extraction:', err));
    }
  }, [link.id, link.has_extraction, link.extraction_status]);

  // Start analysis
  const startAnalysis = (force: boolean = false) => {
    setIsAnalyzing(true);
    setError(null);
    analyzeMutation.mutate(force);
  };

  // Toggle section
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Group fields by prefix (e.g., "coverage", "limits", etc.)
  const groupFields = (data: Record<string, ExtractedFieldData>) => {
    const groups: Record<string, Array<{ path: string; data: ExtractedFieldData }>> = {};

    for (const [path, fieldData] of Object.entries(data)) {
      const parts = path.split('.');
      const group = parts.length > 1 ? parts[0] : 'general';

      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push({ path, data: fieldData });
    }

    // Sort fields within each group by relevance
    for (const group of Object.keys(groups)) {
      groups[group].sort((a, b) => {
        const scoreA = a.data.relevance_score || 0;
        const scoreB = b.data.relevance_score || 0;
        return scoreB - scoreA;
      });
    }

    return groups;
  };

  const groupedFields = extraction?.extracted_data
    ? groupFields(extraction.extracted_data)
    : {};

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-4xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-slate-500" />
              </button>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Product-Specific Analysis
                </h2>
                {link.product_info && (
                  <p className="text-sm text-slate-500 flex items-center gap-1">
                    {link.product_info.lob.name}
                    <ChevronRight className="h-3 w-3" />
                    {link.product_info.cob.name}
                    <ChevronRight className="h-3 w-3" />
                    {link.product_info.product.name}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* No extraction yet - show analyze button */}
          {!extraction && !isAnalyzing && (
            <div className="text-center py-12">
              <Brain className="h-16 w-16 text-purple-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                Analyze Contract for This Product
              </h3>
              <p className="text-slate-500 max-w-md mx-auto mb-6">
                AI will analyze the contract to determine which terms and values
                specifically apply to this product combination.
              </p>
              {link.product_info && (
                <div className="inline-block p-4 bg-slate-50 rounded-lg mb-6 text-left">
                  <p className="text-sm font-medium text-slate-700 mb-2">Product Details:</p>
                  <div className="text-sm text-slate-600 space-y-1">
                    <p><strong>LOB:</strong> {link.product_info.lob.name}</p>
                    <p><strong>COB:</strong> {link.product_info.cob.name}</p>
                    <p><strong>Product:</strong> {link.product_info.product.name}</p>
                    <p><strong>Sub-Product:</strong> {link.product_info.sub_product.name}</p>
                    <p><strong>MPP:</strong> {link.product_info.mpp.name}</p>
                    <p><strong>GWP:</strong> {formatCurrency(link.product_info.total_gwp)}</p>
                  </div>
                </div>
              )}
              <button
                onClick={startAnalysis}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors mx-auto"
              >
                <Brain className="h-5 w-5" />
                Start AI Analysis
              </button>
            </div>
          )}

          {/* Analyzing */}
          {isAnalyzing && (
            <div className="text-center py-12">
              <Loader2 className="h-16 w-16 text-purple-500 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                Analyzing Contract...
              </h3>
              <p className="text-slate-500">
                AI is determining which contract terms apply to this product.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Analysis Failed</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
                <button
                  onClick={startAnalysis}
                  className="mt-3 text-sm text-red-700 underline hover:no-underline"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Extraction Results */}
          {extraction && !isAnalyzing && (
            <div className="space-y-6">
              {/* Summary */}
              {extraction.analysis_summary && (
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-purple-900 mb-1">AI Analysis Summary</p>
                      <p className="text-sm text-purple-800">{extraction.analysis_summary}</p>
                      {extraction.confidence_score !== undefined && (
                        <p className="text-xs text-purple-600 mt-2">
                          Confidence: {Math.round(extraction.confidence_score * 100)}%
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {Object.keys(extraction.extracted_data || {}).length} fields extracted
                </span>
                <span>Model: {extraction.model_name || extraction.model_provider}</span>
                {extraction.completed_at && (
                  <span>
                    Analyzed: {new Date(extraction.completed_at).toLocaleString()}
                  </span>
                )}
              </div>

              {/* Grouped Fields */}
              {Object.keys(groupedFields).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(groupedFields).map(([group, fields]) => (
                    <div key={group} className="border border-slate-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleSection(group)}
                        className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between hover:bg-slate-100 transition-colors"
                      >
                        <span className="font-medium text-slate-700 capitalize">
                          {group.replace(/_/g, ' ')}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">
                            {fields.length} field{fields.length !== 1 ? 's' : ''}
                          </span>
                          {expandedSections.has(group) || expandedSections.has('all') ? (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          )}
                        </div>
                      </button>

                      {(expandedSections.has(group) || expandedSections.has('all')) && (
                        <div className="p-3 space-y-2 bg-slate-50/50">
                          {fields.map(({ path, data }) => (
                            <FieldWithCitation key={path} path={path} data={data} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  No fields extracted for this product
                </div>
              )}

              {/* Re-analyze button */}
              <div className="pt-4 border-t border-slate-200">
                <button
                  onClick={() => startAnalysis(true)}
                  disabled={isAnalyzing}
                  className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
                >
                  <Brain className="h-4 w-4" />
                  Re-analyze (force fresh extraction)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <button
            onClick={onBack}
            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            ← Back to Links
          </button>
          <button onClick={onClose} className="btn-primary">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
