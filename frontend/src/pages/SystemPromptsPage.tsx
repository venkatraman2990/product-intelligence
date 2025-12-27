import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Save,
  RotateCcw,
  Check,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Edit3,
  Eye,
} from 'lucide-react';
import { promptsApi } from '../api/client';
import type { SystemPrompt } from '../api/client';

function PromptCard({
  prompt,
  onUpdate,
  onReset,
}: {
  prompt: SystemPrompt;
  onUpdate: (key: string, content: string) => Promise<void>;
  onReset: (key: string) => Promise<void>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(prompt.prompt_content);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [defaultContent, setDefaultContent] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(prompt.prompt_key, editedContent);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset this prompt to the default value?')) {
      return;
    }
    setIsResetting(true);
    try {
      await onReset(prompt.prompt_key);
      setIsEditing(false);
    } finally {
      setIsResetting(false);
    }
  };

  const handleCancel = () => {
    setEditedContent(prompt.prompt_content);
    setIsEditing(false);
  };

  const loadDefaultForComparison = async () => {
    if (!defaultContent) {
      const data = await promptsApi.getDefault(prompt.prompt_key);
      setDefaultContent(data.default_content);
    }
    setShowDiff(!showDiff);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-slate-400" />
          <div className="text-left">
            <h3 className="font-medium text-slate-900">{prompt.display_name}</h3>
            {prompt.description && (
              <p className="text-sm text-slate-500 mt-0.5">{prompt.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {prompt.is_custom && (
            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
              Customized
            </span>
          )}
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-5 pb-5 border-t border-slate-100">
          {/* Actions */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </button>
              ) : (
                <>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || editedContent === prompt.prompt_content}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
              {prompt.is_custom && (
                <button
                  onClick={loadDefaultForComparison}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                >
                  <Eye className="h-4 w-4" />
                  {showDiff ? 'Hide' : 'View'} Default
                </button>
              )}
            </div>
            {prompt.is_custom && (
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                {isResetting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Reset to Default
              </button>
            )}
          </div>

          {/* Prompt Content */}
          {isEditing ? (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full h-96 p-4 font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
              placeholder="Enter prompt content..."
            />
          ) : (
            <pre className="p-4 bg-slate-50 rounded-lg overflow-x-auto text-sm text-slate-700 whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
              {prompt.prompt_content}
            </pre>
          )}

          {/* Default Comparison */}
          {showDiff && defaultContent && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-slate-700 mb-2">Default Prompt:</h4>
              <pre className="p-4 bg-amber-50 border border-amber-200 rounded-lg overflow-x-auto text-sm text-slate-700 whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
                {defaultContent}
              </pre>
            </div>
          )}

          {/* Metadata */}
          <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
            <span>Key: {prompt.prompt_key}</span>
            {prompt.updated_at && (
              <span>Last updated: {new Date(prompt.updated_at).toLocaleString()}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SystemPromptsPage() {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch all prompts
  const {
    data: promptsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['systemPrompts'],
    queryFn: promptsApi.list,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ key, content }: { key: string; content: string }) =>
      promptsApi.update(key, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemPrompts'] });
      setSuccessMessage('Prompt saved successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (err: Error) => {
      setErrorMessage(err.message || 'Failed to save prompt');
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: (key: string) => promptsApi.reset(key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemPrompts'] });
      setSuccessMessage('Prompt reset to default');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (err: Error) => {
      setErrorMessage(err.message || 'Failed to reset prompt');
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  const handleUpdate = async (key: string, content: string) => {
    await updateMutation.mutateAsync({ key, content });
  };

  const handleReset = async (key: string) => {
    await resetMutation.mutateAsync(key);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 rounded-lg border border-red-200">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-red-800">Failed to load prompts: {(error as Error).message}</p>
        </div>
      </div>
    );
  }

  const prompts = promptsData?.prompts || [];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">System Prompts</h1>
        <p className="text-slate-500 mt-1">
          Manage AI system prompts used throughout the application. Customize prompts to adjust
          extraction and analysis behavior.
        </p>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <Check className="h-5 w-5 text-green-600" />
          <p className="text-green-800">{successMessage}</p>
        </div>
      )}
      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-red-800">{errorMessage}</p>
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 flex items-center gap-6 text-sm text-slate-600">
        <span>{prompts.length} prompts total</span>
        <span>{prompts.filter((p) => p.is_custom).length} customized</span>
      </div>

      {/* Prompts List */}
      <div className="space-y-4">
        {prompts.map((prompt) => (
          <PromptCard
            key={prompt.prompt_key}
            prompt={prompt}
            onUpdate={handleUpdate}
            onReset={handleReset}
          />
        ))}
      </div>

      {prompts.length === 0 && (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No system prompts found</p>
        </div>
      )}
    </div>
  );
}
