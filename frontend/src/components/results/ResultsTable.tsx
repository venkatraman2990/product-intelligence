import { useState } from 'react';
import { ChevronDown, ChevronRight, Code, Table, Copy, Check } from 'lucide-react';

interface ResultsTableProps {
  data: Record<string, unknown>;
  notes?: string[];
}

// Field categories for organization
const fieldCategories: Record<string, string[]> = {
  'Metadata': [
    'member_name', 'product_name', 'product_description', 'effective_date',
    'document_source', 'extraction_timestamp'
  ],
  'Territory': [
    'permitted_states', 'excluded_states', 'admitted_status', 'territorial_scope',
    'geographic_limitations'
  ],
  'Coverage': [
    'lines_of_business', 'coverage_types', 'policy_forms', 'endorsements',
    'exclusions', 'sub_limits'
  ],
  'Limits & Retention': [
    'minimum_limit', 'maximum_limit', 'minimum_retention', 'maximum_retention',
    'aggregate_limits', 'per_occurrence_limits'
  ],
  'Premium & Rating': [
    'minimum_premium', 'rate_basis', 'commission_rate', 'expense_allowance',
    'profit_commission'
  ],
  'Underwriting': [
    'risk_appetite', 'prohibited_risks', 'required_documentation',
    'underwriting_authority', 'binding_authority'
  ],
  'Claims': [
    'claims_handling', 'notice_requirements', 'claims_authority',
    'settlement_authority', 'claims_reporting'
  ],
};

export default function ResultsTable({ data, notes = [] }: ResultsTableProps) {
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['Metadata', 'Territory', 'Coverage'])
  );
  const [copied, setCopied] = useState(false);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : '-';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  const getCategoryFields = (category: string): Array<{ key: string; value: unknown }> => {
    const fields = fieldCategories[category] || [];
    return fields
      .filter((field) => field in data)
      .map((field) => ({ key: field, value: data[field] }));
  };

  // Get uncategorized fields
  const categorizedFields = new Set(Object.values(fieldCategories).flat());
  const uncategorizedFields = Object.entries(data)
    .filter(([key]) => !categorizedFields.has(key))
    .map(([key, value]) => ({ key, value }));

  const fieldCount = Object.keys(data).length;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-sm font-medium text-gray-900">Extracted Data</h3>
          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
            {fieldCount} fields
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {/* View mode toggle */}
          <div className="flex bg-gray-200 rounded-md p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded ${
                viewMode === 'table' ? 'bg-white shadow-sm' : 'text-gray-500'
              }`}
            >
              <Table className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('json')}
              className={`p-1.5 rounded ${
                viewMode === 'json' ? 'bg-white shadow-sm' : 'text-gray-500'
              }`}
            >
              <Code className="h-4 w-4" />
            </button>
          </div>
          {/* Copy button */}
          <button
            onClick={copyToClipboard}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'table' ? (
        <div className="divide-y divide-gray-200">
          {/* Categorized fields */}
          {Object.keys(fieldCategories).map((category) => {
            const fields = getCategoryFields(category);
            if (fields.length === 0) return null;

            const isExpanded = expandedCategories.has(category);

            return (
              <div key={category}>
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full px-4 py-2 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-400 mr-2" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400 mr-2" />
                    )}
                    <span className="text-sm font-medium text-gray-700">{category}</span>
                  </div>
                  <span className="text-xs text-gray-500">{fields.length} fields</span>
                </button>
                {isExpanded && (
                  <table className="w-full">
                    <tbody className="divide-y divide-gray-100">
                      {fields.map(({ key, value }) => (
                        <tr key={key} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm font-medium text-gray-600 w-1/3">
                            {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {formatValue(value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}

          {/* Uncategorized fields */}
          {uncategorizedFields.length > 0 && (
            <div>
              <button
                onClick={() => toggleCategory('Other')}
                className="w-full px-4 py-2 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center">
                  {expandedCategories.has('Other') ? (
                    <ChevronDown className="h-4 w-4 text-gray-400 mr-2" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400 mr-2" />
                  )}
                  <span className="text-sm font-medium text-gray-700">Other Fields</span>
                </div>
                <span className="text-xs text-gray-500">{uncategorizedFields.length} fields</span>
              </button>
              {expandedCategories.has('Other') && (
                <table className="w-full">
                  <tbody className="divide-y divide-gray-100">
                    {uncategorizedFields.map(({ key, value }) => (
                      <tr key={key} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm font-medium text-gray-600 w-1/3">
                          {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {formatValue(value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      ) : (
        <pre className="p-4 text-sm text-gray-800 overflow-auto max-h-96 bg-gray-50">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}

      {/* Extraction notes */}
      {notes.length > 0 && (
        <div className="px-4 py-3 bg-yellow-50 border-t border-yellow-200">
          <h4 className="text-sm font-medium text-yellow-800 mb-2">Extraction Notes</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            {notes.map((note, idx) => (
              <li key={idx} className="flex items-start">
                <span className="mr-2">•</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
