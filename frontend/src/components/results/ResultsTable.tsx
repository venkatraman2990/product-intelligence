import { useState } from 'react';
import { ChevronDown, ChevronRight, Code, Table, Copy, Check, Quote, Edit3, Save, X, Loader2 } from 'lucide-react';
import DocumentViewer from './DocumentViewer';
import { extractionsApi } from '../../api/client';

interface ResultsTableProps {
  data: Record<string, unknown>;
  notes?: string[];
  documentText?: string;
  contractId?: string;
  extractionId?: string;
  editable?: boolean;
  onDataUpdate?: () => void;
}

const fieldCategories: Record<string, string[]> = {
  'Contract Overview': [
    'member_name', 'product_name', 'product_description', 'effective_date',
    'expiration_date', 'admitted_status'
  ],
  'Counterparties': [
    'accelerant_agency', 'carrier', 'insurer_branch'
  ],
  'Metadata': [
    'document_source', 'extraction_timestamp'
  ],
  'Territory': [
    'permitted_states', 'excluded_states', 'territorial_scope',
    'geographic_limitations'
  ],
  'Coverage': [
    'lines_of_business', 'coverage_types', 'policy_forms', 'endorsements',
    'exclusions', 'sub_limits'
  ],
  'Limits and Deductibles': [
    'minimum_limit', 'maximum_limit', 'minimum_retention', 'maximum_retention',
    'aggregate_limits', 'per_occurrence_limits', 'max_policy_limit', 'max_location_limit',
    'max_limits_of_liability', 'deductible_options', 'deductible_min', 'deductible_max',
    'max_revenue_per_insured', 'max_tiv_per_insured', 'max_locations_per_insured'
  ],
  'Premium Information': [
    'max_annual_premium', 'max_premium_per_insured', 'min_premium_per_insured',
    'max_policy_period', 'premium_cap_basis', 'minimum_earned_premium'
  ],
  'Commission': [
    'commission_rate'
  ],
  'Underwriting': [
    'risk_appetite', 'prohibited_risks', 'required_documentation',
    'underwriting_authority', 'binding_authority'
  ],
  'Underwriting Period': [
    'underwriting_year_start', 'underwriting_year_end'
  ],
  'Claims': [
    'claims_handling', 'notice_requirements', 'claims_authority',
    'settlement_authority', 'claims_reporting'
  ],
  'Classes and Operations': [
    'target_classes', 'eligible_classes', 'excluded_classes',
    'target_operations', 'eligible_operations', 'ineligible_operations'
  ],
};

export default function ResultsTable({
  data,
  notes = [],
  documentText = '',
  contractId = '',
  extractionId,
  editable = false,
  onDataUpdate
}: ResultsTableProps) {
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['Contract Overview', 'Metadata', 'Territory', 'Coverage'])
  );
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewField, setPreviewField] = useState<string>('');
  const [previewCitation, setPreviewCitation] = useState<string>('');

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<Record<string, unknown>>({});
  const [editedCitations, setEditedCitations] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const citations = (data._citations as Record<string, string>) || {};
  
  const displayData = { ...data };
  delete displayData._citations;

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
    navigator.clipboard.writeText(JSON.stringify(displayData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openCitation = (fieldKey: string) => {
    const citation = citations[fieldKey];
    if (citation && documentText) {
      setPreviewField(fieldKey);
      setPreviewCitation(citation);
      setPreviewOpen(true);
    }
  };

  // Edit mode handlers
  const handleStartEdit = () => {
    setEditedData({ ...displayData });
    setEditedCitations({ ...citations });  // Copy original citations
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedData({});
    setEditedCitations({});
    setIsEditing(false);
  };

  const handleFieldChange = (key: string, value: string) => {
    setEditedData((prev) => ({
      ...prev,
      [key]: value,
    }));
    // Remove citation for this field since value was manually edited
    setEditedCitations((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  const handleSave = async () => {
    if (!extractionId) return;

    setIsSaving(true);
    try {
      // Include updated citations in the save payload
      const dataToSave = {
        ...editedData,
        _citations: editedCitations,
      };
      await extractionsApi.update(extractionId, dataToSave);
      setIsEditing(false);
      onDataUpdate?.();
    } catch (error) {
      console.error('Failed to save extraction data:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Get the current data to display (edited or original)
  const currentDisplayData = isEditing ? editedData : displayData;

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
      .filter((field) => field in currentDisplayData)
      .map((field) => ({ key: field, value: currentDisplayData[field] }));
  };

  const categorizedFields = new Set(Object.values(fieldCategories).flat());
  const uncategorizedFields = Object.entries(currentDisplayData)
    .filter(([key]) => !categorizedFields.has(key) && key !== '_citations')
    .map(([key, value]) => ({ key, value }));

  const fieldCount = Object.keys(currentDisplayData).length;
  const citationCount = Object.keys(citations).length;

  return (
    <div 
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: 'white', border: '1px solid var(--slate-200)' }}
    >
      <div 
        className="px-5 py-3 flex items-center justify-between border-b"
        style={{ backgroundColor: 'var(--slate-50)', borderColor: 'var(--slate-200)' }}
      >
        <div className="flex items-center space-x-4">
          <h3 className="card-title">Extracted Data</h3>
          <span className="count-badge">{fieldCount} fields</span>
        </div>
        <div className="flex items-center space-x-2">
          {/* Edit mode buttons */}
          {isEditing ? (
            <>
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors"
                style={{ borderColor: 'var(--slate-300)', color: 'var(--slate-600)' }}
                disabled={isSaving}
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white transition-colors"
                style={{ backgroundColor: 'var(--accelerant-blue)' }}
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save
              </button>
            </>
          ) : (
            <>
              {editable && extractionId && (
                <button
                  onClick={handleStartEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white transition-colors"
                  style={{ backgroundColor: 'var(--accelerant-blue)' }}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit
                </button>
              )}
              <div
                className="flex rounded-lg p-0.5"
                style={{ backgroundColor: 'var(--slate-200)' }}
              >
                <button
                  onClick={() => setViewMode('table')}
                  className="p-1.5 rounded-md transition-all"
                  style={{
                    backgroundColor: viewMode === 'table' ? 'white' : 'transparent',
                    boxShadow: viewMode === 'table' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    color: viewMode === 'table' ? 'var(--slate-900)' : 'var(--slate-500)',
                  }}
                >
                  <Table className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('json')}
                  className="p-1.5 rounded-md transition-all"
                  style={{
                    backgroundColor: viewMode === 'json' ? 'white' : 'transparent',
                    boxShadow: viewMode === 'json' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    color: viewMode === 'json' ? 'var(--slate-900)' : 'var(--slate-500)',
                  }}
                >
                  <Code className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={copyToClipboard}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--slate-500)' }}
              >
                {copied ? <Check className="h-4 w-4" style={{ color: 'var(--success-green)' }} /> : <Copy className="h-4 w-4" />}
              </button>
            </>
          )}
        </div>
      </div>

      {viewMode === 'table' ? (
        <div>
          {Object.keys(fieldCategories).filter(c => c !== 'Metadata').map((category) => {
            const fields = getCategoryFields(category);
            if (fields.length === 0) return null;

            const isExpanded = expandedCategories.has(category);

            return (
              <div key={category} className="border-b" style={{ borderColor: 'var(--slate-200)' }}>
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full px-5 py-3 flex items-center justify-between transition-colors"
                  style={{ backgroundColor: 'var(--slate-50)' }}
                >
                  <div className="flex items-center">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 mr-2" style={{ color: 'var(--slate-400)' }} />
                    ) : (
                      <ChevronRight className="h-4 w-4 mr-2" style={{ color: 'var(--slate-400)' }} />
                    )}
                    <span className="text-sm font-medium" style={{ color: 'var(--slate-600)' }}>{category}</span>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--slate-500)' }}>{fields.length} fields</span>
                </button>
                {isExpanded && (
                  <table className="w-full">
                    <tbody>
                      {fields.map(({ key, value }) => (
                        <tr 
                          key={key} 
                          className="border-t transition-colors"
                          style={{ borderColor: 'var(--slate-100)' }}
                        >
                          <td 
                            className="px-5 py-3 text-sm font-medium w-1/3"
                            style={{ color: 'var(--slate-600)' }}
                          >
                            {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                          </td>
                          <td
                            className="px-5 py-3 text-sm"
                            style={{ color: 'var(--slate-900)' }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={formatValue(value)}
                                  onChange={(e) => handleFieldChange(key, e.target.value)}
                                  className="w-full px-2 py-1 rounded border text-sm"
                                  style={{
                                    borderColor: 'var(--accelerant-blue)',
                                    backgroundColor: 'white',
                                    color: 'var(--slate-900)',
                                  }}
                                />
                              ) : (
                                <span>{formatValue(value)}</span>
                              )}
                              {citations[key] && documentText && !isEditing && (
                                <button
                                  onClick={() => openCitation(key)}
                                  className="shrink-0 p-1 rounded transition-colors hover:bg-blue-50"
                                  style={{ color: 'var(--accelerant-blue)' }}
                                  title="View source in document"
                                >
                                  <Quote className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}

          {uncategorizedFields.length > 0 && (
            <div className="border-b" style={{ borderColor: 'var(--slate-200)' }}>
              <button
                onClick={() => toggleCategory('Other')}
                className="w-full px-5 py-3 flex items-center justify-between transition-colors"
                style={{ backgroundColor: 'var(--slate-50)' }}
              >
                <div className="flex items-center">
                  {expandedCategories.has('Other') ? (
                    <ChevronDown className="h-4 w-4 mr-2" style={{ color: 'var(--slate-400)' }} />
                  ) : (
                    <ChevronRight className="h-4 w-4 mr-2" style={{ color: 'var(--slate-400)' }} />
                  )}
                  <span className="text-sm font-medium" style={{ color: 'var(--slate-600)' }}>Other Fields</span>
                </div>
                <span className="text-xs" style={{ color: 'var(--slate-500)' }}>{uncategorizedFields.length} fields</span>
              </button>
              {expandedCategories.has('Other') && (
                <table className="w-full">
                  <tbody>
                    {uncategorizedFields.map(({ key, value }) => (
                      <tr 
                        key={key} 
                        className="border-t transition-colors"
                        style={{ borderColor: 'var(--slate-100)' }}
                      >
                        <td 
                          className="px-5 py-3 text-sm font-medium w-1/3"
                          style={{ color: 'var(--slate-600)' }}
                        >
                          {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </td>
                        <td
                          className="px-5 py-3 text-sm"
                          style={{ color: 'var(--slate-900)' }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            {isEditing ? (
                              <input
                                type="text"
                                value={formatValue(value)}
                                onChange={(e) => handleFieldChange(key, e.target.value)}
                                className="w-full px-2 py-1 rounded border text-sm"
                                style={{
                                  borderColor: 'var(--accelerant-blue)',
                                  backgroundColor: 'white',
                                  color: 'var(--slate-900)',
                                }}
                              />
                            ) : (
                              <span>{formatValue(value)}</span>
                            )}
                            {citations[key] && documentText && !isEditing && (
                              <button
                                onClick={() => openCitation(key)}
                                className="shrink-0 p-1 rounded transition-colors hover:bg-blue-50"
                                style={{ color: 'var(--accelerant-blue)' }}
                                title="View source in document"
                              >
                                <Quote className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {(() => {
            const category = 'Metadata';
            const fields = getCategoryFields(category);
            if (fields.length === 0) return null;
            const isExpanded = expandedCategories.has(category);

            return (
              <div key={category} className="border-b" style={{ borderColor: 'var(--slate-200)' }}>
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full px-5 py-3 flex items-center justify-between transition-colors"
                  style={{ backgroundColor: 'var(--slate-50)' }}
                >
                  <div className="flex items-center">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 mr-2" style={{ color: 'var(--slate-400)' }} />
                    ) : (
                      <ChevronRight className="h-4 w-4 mr-2" style={{ color: 'var(--slate-400)' }} />
                    )}
                    <span className="text-sm font-medium" style={{ color: 'var(--slate-600)' }}>{category}</span>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--slate-500)' }}>{fields.length} fields</span>
                </button>
                {isExpanded && (
                  <table className="w-full">
                    <tbody>
                      {fields.map(({ key, value }) => (
                        <tr 
                          key={key} 
                          className="border-t transition-colors"
                          style={{ borderColor: 'var(--slate-100)' }}
                        >
                          <td 
                            className="px-5 py-3 text-sm font-medium w-1/3"
                            style={{ color: 'var(--slate-600)' }}
                          >
                            {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                          </td>
                          <td
                            className="px-5 py-3 text-sm"
                            style={{ color: 'var(--slate-900)' }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={formatValue(value)}
                                  onChange={(e) => handleFieldChange(key, e.target.value)}
                                  className="w-full px-2 py-1 rounded border text-sm"
                                  style={{
                                    borderColor: 'var(--accelerant-blue)',
                                    backgroundColor: 'white',
                                    color: 'var(--slate-900)',
                                  }}
                                />
                              ) : (
                                <span>{formatValue(value)}</span>
                              )}
                              {citations[key] && documentText && !isEditing && (
                                <button
                                  onClick={() => openCitation(key)}
                                  className="shrink-0 p-1 rounded transition-colors hover:bg-blue-50"
                                  style={{ color: 'var(--accelerant-blue)' }}
                                  title="View source in document"
                                >
                                  <Quote className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })()}
        </div>
      ) : (
        <pre 
          className="p-5 text-sm overflow-auto max-h-96"
          style={{ backgroundColor: 'var(--slate-50)', color: 'var(--slate-900)' }}
        >
          {JSON.stringify(displayData, null, 2)}
        </pre>
      )}

      {notes.length > 0 && (
        <div 
          className="px-5 py-3 border-t"
          style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}
        >
          <h4 className="text-sm font-medium mb-2" style={{ color: '#92400E' }}>Extraction Notes</h4>
          <ul className="text-sm space-y-1" style={{ color: '#B45309' }}>
            {notes.map((note, idx) => (
              <li key={idx} className="flex items-start">
                <span className="mr-2">&bull;</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {citationCount > 0 && documentText && (
        <div 
          className="px-5 py-2 border-t text-xs flex items-center"
          style={{ backgroundColor: 'var(--slate-50)', borderColor: 'var(--slate-200)', color: 'var(--slate-500)' }}
        >
          <Quote className="h-3 w-3 mr-1.5" style={{ color: 'var(--accelerant-blue)' }} />
          {citationCount} fields have source citations. Click the quote icon to view the source text.
        </div>
      )}

      {previewOpen && contractId && (
        <DocumentViewer
          contractId={contractId}
          citation={previewCitation}
          documentText={documentText}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
