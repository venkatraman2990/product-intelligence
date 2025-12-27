import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Shield,
  Loader2,
  AlertCircle,
  Save,
  X,
  Quote,
  ChevronRight,
  FileText,
  Edit3,
  Check,
  Trash2,
} from 'lucide-react';
import { authoritiesApi, type Authority, type ExtractedFieldData } from '../api/client';

export default function AuthorityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<Record<string, ExtractedFieldData>>({});
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  const { data: authority, isLoading, error } = useQuery({
    queryKey: ['authority', id],
    queryFn: () => authoritiesApi.get(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { extracted_data: Record<string, ExtractedFieldData> }) =>
      authoritiesApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['authority', id] });
      queryClient.invalidateQueries({ queryKey: ['authorities'] });
      setIsEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => authoritiesApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['authorities'] });
      navigate('/authorities');
    },
  });

  const handleStartEdit = () => {
    setEditedData(authority?.extracted_data || {});
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedData({});
    setIsEditing(false);
  };

  const handleSave = () => {
    updateMutation.mutate({ extracted_data: editedData });
  };

  const handleFieldChange = (fieldPath: string, value: string) => {
    setEditedData((prev) => ({
      ...prev,
      [fieldPath]: {
        ...prev[fieldPath],
        value,
      },
    }));
  };

  const toggleFieldExpanded = (fieldPath: string) => {
    setExpandedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldPath)) {
        next.delete(fieldPath);
      } else {
        next.add(fieldPath);
      }
      return next;
    });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this authority record?')) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--accelerant-blue)' }} />
      </div>
    );
  }

  if (error || !authority) {
    return (
      <div className="p-4 rounded-xl flex items-center" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
        <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
        <span className="text-red-700">Failed to load authority</span>
      </div>
    );
  }

  const currentData = isEditing ? editedData : authority.extracted_data;
  const fieldPaths = Object.keys(currentData).sort();

  // Group fields by prefix
  const groupedFields: Record<string, string[]> = {};
  fieldPaths.forEach((path) => {
    const parts = path.split('.');
    const group = parts.length > 1 ? parts[0] : 'general';
    if (!groupedFields[group]) {
      groupedFields[group] = [];
    }
    groupedFields[group].push(path);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/authorities"
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" style={{ color: 'var(--slate-500)' }} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6" style={{ color: 'var(--accelerant-blue)' }} />
              <h1 className="text-2xl font-bold" style={{ color: 'var(--slate-900)' }}>
                Authority Details
              </h1>
            </div>
            <div className="flex items-center gap-1 text-sm mt-1" style={{ color: 'var(--slate-500)' }}>
              <span>{authority.lob_name}</span>
              <ChevronRight className="h-3 w-3" />
              <span>{authority.cob_name}</span>
              <ChevronRight className="h-3 w-3" />
              <span>{authority.product_name}</span>
              <ChevronRight className="h-3 w-3" />
              <span>{authority.sub_product_name}</span>
              <ChevronRight className="h-3 w-3" />
              <span>{authority.mpp_name}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors"
                style={{ borderColor: 'var(--slate-300)', color: 'var(--slate-600)' }}
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-colors"
                style={{ backgroundColor: 'var(--accelerant-blue)' }}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors hover:bg-red-50"
                style={{ borderColor: 'var(--slate-300)', color: '#DC2626' }}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
              <button
                onClick={handleStartEdit}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-colors"
                style={{ backgroundColor: 'var(--accelerant-blue)' }}
              >
                <Edit3 className="h-4 w-4" />
                Edit Fields
              </button>
            </>
          )}
        </div>
      </div>

      {/* Contract Info Card */}
      <div className="bg-white rounded-xl border p-6" style={{ borderColor: 'var(--slate-200)' }}>
        <div className="flex items-center gap-3 mb-4">
          <FileText className="h-5 w-5" style={{ color: 'var(--slate-500)' }} />
          <h2 className="font-semibold" style={{ color: 'var(--slate-900)' }}>
            Contract Information
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span style={{ color: 'var(--slate-500)' }}>Contract:</span>
            <span className="ml-2 font-medium" style={{ color: 'var(--slate-900)' }}>
              {authority.contract_name}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--slate-500)' }}>Created:</span>
            <span className="ml-2" style={{ color: 'var(--slate-700)' }}>
              {new Date(authority.created_at).toLocaleString()}
            </span>
          </div>
          {authority.updated_at && (
            <div>
              <span style={{ color: 'var(--slate-500)' }}>Last Updated:</span>
              <span className="ml-2" style={{ color: 'var(--slate-700)' }}>
                {new Date(authority.updated_at).toLocaleString()}
              </span>
            </div>
          )}
        </div>
        {authority.analysis_summary && (
          <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--slate-50)' }}>
            <p className="text-sm" style={{ color: 'var(--slate-600)' }}>
              <strong>AI Summary:</strong> {authority.analysis_summary}
            </p>
          </div>
        )}
      </div>

      {/* Extracted Fields */}
      <div className="bg-white rounded-xl border" style={{ borderColor: 'var(--slate-200)' }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--slate-200)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--slate-900)' }}>
            Extracted Fields ({fieldPaths.length})
          </h2>
          {isEditing && (
            <p className="text-sm mt-1" style={{ color: 'var(--slate-500)' }}>
              Click on a field value to edit it. Citations are read-only.
            </p>
          )}
        </div>

        <div className="divide-y" style={{ borderColor: 'var(--slate-100)' }}>
          {Object.entries(groupedFields).map(([group, paths]) => (
            <div key={group} className="px-6 py-4">
              <h3 className="text-sm font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--slate-400)' }}>
                {group.replace(/_/g, ' ')}
              </h3>
              <div className="space-y-4">
                {paths.map((fieldPath) => {
                  const field = currentData[fieldPath];
                  const isExpanded = expandedFields.has(fieldPath);

                  return (
                    <div
                      key={fieldPath}
                      className="rounded-lg border p-4"
                      style={{ borderColor: 'var(--slate-200)', backgroundColor: 'var(--slate-50)' }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium" style={{ color: 'var(--slate-600)' }}>
                            {fieldPath}
                          </p>
                          {isEditing ? (
                            <input
                              type="text"
                              value={field?.value || ''}
                              onChange={(e) => handleFieldChange(fieldPath, e.target.value)}
                              className="mt-2 w-full px-3 py-2 rounded-lg border text-base"
                              style={{
                                borderColor: 'var(--accelerant-blue)',
                                backgroundColor: 'white',
                                color: 'var(--slate-900)',
                              }}
                            />
                          ) : (
                            <p className="text-base mt-1" style={{ color: 'var(--slate-900)' }}>
                              {field?.value || 'N/A'}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {field?.relevance_score !== undefined && (
                            <span
                              className="text-xs px-2 py-1 rounded"
                              style={{
                                backgroundColor: field.relevance_score >= 0.8 ? '#DCFCE7' : field.relevance_score >= 0.5 ? '#FEF3C7' : '#F1F5F9',
                                color: field.relevance_score >= 0.8 ? '#166534' : field.relevance_score >= 0.5 ? '#92400E' : '#475569',
                              }}
                            >
                              {Math.round(field.relevance_score * 100)}%
                            </span>
                          )}
                          {field?.citation && (
                            <button
                              onClick={() => toggleFieldExpanded(fieldPath)}
                              className="p-1.5 rounded transition-colors"
                              style={{
                                backgroundColor: isExpanded ? '#DBEAFE' : 'transparent',
                                color: isExpanded ? '#2563EB' : 'var(--slate-400)',
                              }}
                              title="View citation"
                            >
                              <Quote className="h-4 w-4" />
                            </button>
                          )}
                          {isEditing && (
                            <Check className="h-4 w-4" style={{ color: 'var(--accelerant-blue)' }} />
                          )}
                        </div>
                      </div>

                      {/* Citation (expandable) */}
                      {isExpanded && field?.citation && (
                        <div
                          className="mt-3 p-3 rounded-lg border"
                          style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
                        >
                          <div className="flex items-start gap-2">
                            <Quote className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#3B82F6' }} />
                            <div>
                              <p className="text-sm italic" style={{ color: '#1E40AF' }}>
                                "{field.citation}"
                              </p>
                              {field.reasoning && (
                                <p className="text-xs mt-2" style={{ color: '#3B82F6' }}>
                                  <strong>Reasoning:</strong> {field.reasoning}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {fieldPaths.length === 0 && (
          <div className="text-center py-12">
            <Shield className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--slate-300)' }} />
            <p className="font-medium" style={{ color: 'var(--slate-600)' }}>
              No extracted fields
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
