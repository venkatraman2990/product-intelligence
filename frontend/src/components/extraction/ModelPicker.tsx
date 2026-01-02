import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertCircle, Sparkles, ChevronDown, ChevronRight, Check, Settings, X, GripVertical } from 'lucide-react';
import { modelsApi, type AnthropicModel, type OpenAIModel, type FeaturedModelConfig } from '../../api/client';
import type { ExtractionModel } from '../../types';

interface ModelPickerProps {
  onSelect: (provider: string, model: string) => void;
  disabled?: boolean;
  initialModel?: { provider: string; model: string } | null;
}

const providerLabels: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  landing_ai: 'Landing AI',
};

// Interface for model in settings modal
interface ModelForConfig {
  id: string;
  display_name: string;
  family?: string;
}

export default function ModelPicker({ onSelect, disabled = false, initialModel = null }: ModelPickerProps) {
  const [selectedProvider, setSelectedProvider] = useState<string>(initialModel?.provider || 'anthropic');
  const [selectedModel, setSelectedModel] = useState<string | null>(initialModel?.model || null);
  const [showMoreModels, setShowMoreModels] = useState(false);
  const [showMoreOpenAIModels, setShowMoreOpenAIModels] = useState(false);

  // Featured models configuration state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsProvider, setSettingsProvider] = useState<'anthropic' | 'openai'>('anthropic');
  const [featuredConfigs, setFeaturedConfigs] = useState<FeaturedModelConfig[]>([]);
  const queryClient = useQueryClient();

  const { data: pickerData, isLoading: isPickerLoading, error: pickerError } = useQuery({
    queryKey: ['models'],
    queryFn: modelsApi.getAll,
  });

  const { data: anthropicData, isLoading: isAnthropicLoading, error: anthropicError } = useQuery({
    queryKey: ['models', 'anthropic'],
    queryFn: modelsApi.getAnthropic,
    enabled: selectedProvider === 'anthropic',
    retry: 1,
  });

  const { data: openaiData, isLoading: isOpenAILoading, error: openaiError } = useQuery({
    queryKey: ['models', 'openai'],
    queryFn: modelsApi.getOpenAI,
    enabled: selectedProvider === 'openai',
    retry: 1,
  });

  // Query for featured models configuration
  const { data: featuredData } = useQuery({
    queryKey: ['models', 'featured', settingsProvider],
    queryFn: () => modelsApi.getFeatured(settingsProvider),
    enabled: showSettingsModal,
  });

  // Mutation to update featured models
  const updateFeaturedMutation = useMutation({
    mutationFn: ({ provider, models }: { provider: string; models: FeaturedModelConfig[] }) =>
      modelsApi.updateFeatured(provider, models),
    onSuccess: (_, variables) => {
      // Invalidate queries to refresh model lists
      queryClient.invalidateQueries({ queryKey: ['models', variables.provider] });
      queryClient.invalidateQueries({ queryKey: ['models', 'featured', variables.provider] });
      setShowSettingsModal(false);
    },
  });

  // Initialize featuredConfigs when modal opens and data loads
  useEffect(() => {
    if (showSettingsModal && featuredData) {
      setFeaturedConfigs(
        featuredData.models.map((m) => ({
          model_id: m.model_id,
          display_name: m.display_name || undefined,
          sort_order: m.sort_order,
        }))
      );
    }
  }, [showSettingsModal, featuredData]);

  useEffect(() => {
    // Skip auto-select if an initial model was provided
    if (initialModel) return;

    if (selectedProvider === 'anthropic' && anthropicData?.is_configured) {
      const defaultModel = anthropicData.featured_models.find(m => m.family === 'sonnet');
      if (defaultModel && !selectedModel) {
        setSelectedModel(defaultModel.id);
        onSelect('anthropic', defaultModel.id);
      }
    } else if (selectedProvider === 'openai' && openaiData?.is_configured) {
      // Auto-select gpt-4o as default for OpenAI
      const defaultModel = openaiData.featured_models.find(m => m.family === 'gpt-4o');
      if (defaultModel && !selectedModel) {
        setSelectedModel(defaultModel.id);
        onSelect('openai', defaultModel.id);
      }
    } else if (pickerData?.models) {
      const providerModels = pickerData.models[selectedProvider as keyof typeof pickerData.models] || [];
      const defaultModel = providerModels.find((m: ExtractionModel) => m.is_default && m.is_configured);
      const configuredModel = providerModels.find((m: ExtractionModel) => m.is_configured);

      if (defaultModel && !selectedModel) {
        setSelectedModel(defaultModel.model_name);
        onSelect(selectedProvider, defaultModel.model_name);
      } else if (configuredModel && !selectedModel) {
        setSelectedModel(configuredModel.model_name);
        onSelect(selectedProvider, configuredModel.model_name);
      }
    }
  }, [pickerData, anthropicData, openaiData, selectedProvider, onSelect, selectedModel, initialModel]);

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    setSelectedModel(null);
    setShowMoreModels(false);
    setShowMoreOpenAIModels(false);
  };

  const handleModelSelect = (modelId: string, provider: string) => {
    if (disabled) return;
    setSelectedModel(modelId);
    onSelect(provider, modelId);
  };

  const handleLegacyModelSelect = (model: ExtractionModel) => {
    if (!model.is_configured || disabled) return;
    setSelectedModel(model.model_name);
    onSelect(selectedProvider, model.model_name);
  };

  // Settings modal helpers
  const openSettings = (provider: 'anthropic' | 'openai', e: React.MouseEvent) => {
    e.stopPropagation();
    setSettingsProvider(provider);
    setFeaturedConfigs([]);
    setShowSettingsModal(true);
  };

  const toggleFeatured = (modelId: string) => {
    setFeaturedConfigs((prev) => {
      const exists = prev.find((m) => m.model_id === modelId);
      if (exists) {
        return prev.filter((m) => m.model_id !== modelId);
      } else {
        return [...prev, { model_id: modelId, sort_order: prev.length }];
      }
    });
  };

  const updateDisplayName = (modelId: string, displayName: string) => {
    setFeaturedConfigs((prev) =>
      prev.map((m) =>
        m.model_id === modelId
          ? { ...m, display_name: displayName || undefined }
          : m
      )
    );
  };

  const saveFeaturedModels = () => {
    updateFeaturedMutation.mutate({
      provider: settingsProvider,
      models: featuredConfigs.map((m, idx) => ({ ...m, sort_order: idx })),
    });
  };

  // Get all models for the settings modal
  const getAllModelsForSettings = (): ModelForConfig[] => {
    if (settingsProvider === 'anthropic' && anthropicData?.is_configured) {
      return [
        ...anthropicData.featured_models,
        ...anthropicData.other_models,
      ].map((m) => ({ id: m.id, display_name: m.display_name, family: m.family }));
    }
    if (settingsProvider === 'openai' && openaiData?.is_configured) {
      return [
        ...openaiData.featured_models,
        ...openaiData.other_models,
      ].map((m) => ({ id: m.id, display_name: m.display_name, family: m.family }));
    }
    return [];
  };

  // Settings Modal Component
  const renderSettingsModal = () => {
    if (!showSettingsModal) return null;

    const allModels = getAllModelsForSettings();
    const featuredIds = new Set(featuredConfigs.map((m) => m.model_id));

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div
          className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
          style={{ border: '1px solid var(--slate-200)' }}
        >
          {/* Modal Header */}
          <div
            className="flex items-center justify-between p-4 border-b"
            style={{ borderColor: 'var(--slate-200)' }}
          >
            <div>
              <h3 className="font-semibold text-lg" style={{ color: 'var(--slate-900)' }}>
                Configure Featured Models
              </h3>
              <p className="text-sm" style={{ color: 'var(--slate-500)' }}>
                {settingsProvider === 'anthropic' ? 'Anthropic (Claude)' : 'OpenAI (GPT)'} - Select models to feature prominently
              </p>
            </div>
            <button
              onClick={() => setShowSettingsModal(false)}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="h-5 w-5" style={{ color: 'var(--slate-500)' }} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 140px)' }}>
            {allModels.length === 0 ? (
              <div className="text-center py-8" style={{ color: 'var(--slate-500)' }}>
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Loading models...
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm mb-3" style={{ color: 'var(--slate-600)' }}>
                  Check models to feature. Featured models appear prominently; others go under "More models".
                </p>
                {allModels.map((model) => {
                  const isFeatured = featuredIds.has(model.id);
                  const config = featuredConfigs.find((m) => m.model_id === model.id);

                  return (
                    <div
                      key={model.id}
                      className="p-3 rounded-lg border transition-colors"
                      style={{
                        borderColor: isFeatured ? 'var(--accelerant-blue)' : 'var(--slate-200)',
                        backgroundColor: isFeatured ? 'var(--accelerant-blue-light)' : 'white',
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isFeatured}
                          onChange={() => toggleFeatured(model.id)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm" style={{ color: 'var(--slate-900)' }}>
                              {model.id}
                            </span>
                            {model.family && (
                              <span
                                className="text-xs px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: 'var(--slate-100)', color: 'var(--slate-600)' }}
                              >
                                {model.family}
                              </span>
                            )}
                          </div>
                          {isFeatured && (
                            <div className="mt-2">
                              <label className="text-xs" style={{ color: 'var(--slate-500)' }}>
                                Custom display name (optional)
                              </label>
                              <input
                                type="text"
                                value={config?.display_name || ''}
                                onChange={(e) => updateDisplayName(model.id, e.target.value)}
                                placeholder={model.display_name}
                                className="mt-1 w-full px-2 py-1 text-sm rounded border focus:outline-none focus:ring-2"
                                style={{
                                  borderColor: 'var(--slate-300)',
                                  backgroundColor: 'white',
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div
            className="flex items-center justify-between p-4 border-t"
            style={{ borderColor: 'var(--slate-200)', backgroundColor: 'var(--slate-50)' }}
          >
            <span className="text-sm" style={{ color: 'var(--slate-600)' }}>
              {featuredConfigs.length} model{featuredConfigs.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                style={{
                  backgroundColor: 'white',
                  border: '1px solid var(--slate-300)',
                  color: 'var(--slate-700)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveFeaturedModels}
                disabled={updateFeaturedMutation.isPending}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                style={{
                  backgroundColor: 'var(--accelerant-blue)',
                  color: 'white',
                  opacity: updateFeaturedMutation.isPending ? 0.7 : 1,
                }}
              >
                {updateFeaturedMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isPickerLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--slate-400)' }} />
        <span className="ml-2" style={{ color: 'var(--slate-500)' }}>Loading models...</span>
      </div>
    );
  }

  if (pickerError) {
    return (
      <div 
        className="p-4 rounded-xl flex items-center"
        style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}
      >
        <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
        <span className="text-red-700">Failed to load models</span>
      </div>
    );
  }

  const providers = ['anthropic', 'openai', 'landing_ai'];

  const renderAnthropicModels = () => {
    if (isAnthropicLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--slate-400)' }} />
          <span className="ml-2 text-sm" style={{ color: 'var(--slate-500)' }}>Loading Claude models...</span>
        </div>
      );
    }

    if (anthropicError) {
      return (
        <div 
          className="p-4 rounded-xl"
          style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}
        >
          <div className="flex items-center mb-2">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-red-700 font-medium">Unable to load Claude models</span>
          </div>
          <p className="text-sm text-red-600">Please check your connection and try again. You can also use the static models below.</p>
        </div>
      );
    }

    if (!anthropicData?.is_configured) {
      return (
        <div 
          className="p-4 rounded-xl text-center"
          style={{ backgroundColor: 'var(--slate-50)', border: '1px solid var(--slate-200)' }}
        >
          <p style={{ color: 'var(--slate-600)' }}>Anthropic API key not configured</p>
          <p className="text-sm mt-1" style={{ color: 'var(--slate-500)' }}>Add ANTHROPIC_API_KEY to use Claude models</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {anthropicData.featured_models.map((model: AnthropicModel) => {
          const isSelected = selectedModel === model.id;
          return (
            <button
              key={model.id}
              onClick={() => handleModelSelect(model.id, 'anthropic')}
              disabled={disabled}
              className="w-full p-4 text-left rounded-xl transition-all"
              style={{
                border: `1px solid ${isSelected ? 'var(--accelerant-blue)' : 'var(--slate-200)'}`,
                backgroundColor: isSelected ? 'var(--accelerant-blue-light)' : 'white',
                boxShadow: isSelected ? '0 0 0 2px var(--accelerant-blue-border)' : 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center">
                    <span className="font-medium" style={{ color: 'var(--slate-900)' }}>
                      {model.display_name}
                    </span>
                    {model.family === 'sonnet' && (
                      <span 
                        className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        style={{ 
                          backgroundColor: 'var(--accelerant-blue-light)',
                          color: 'var(--accelerant-blue)'
                        }}
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--slate-500)' }}>
                    {model.description}
                  </p>
                </div>
                {isSelected && (
                  <Check className="h-5 w-5" style={{ color: 'var(--accelerant-blue)' }} />
                )}
              </div>
            </button>
          );
        })}

        {anthropicData.other_models.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowMoreModels(!showMoreModels)}
              className="w-full p-3 text-left rounded-lg flex items-center justify-between transition-colors hover:bg-slate-50"
              style={{ 
                border: '1px solid var(--slate-200)',
                color: 'var(--slate-600)'
              }}
            >
              <span className="text-sm font-medium">More models</span>
              {showMoreModels ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {showMoreModels && (
              <div className="mt-2 space-y-1 pl-2 border-l-2" style={{ borderColor: 'var(--slate-200)' }}>
                {anthropicData.other_models.map((model: AnthropicModel) => {
                  const isSelected = selectedModel === model.id;
                  return (
                    <button
                      key={model.id}
                      onClick={() => handleModelSelect(model.id, 'anthropic')}
                      disabled={disabled}
                      className="w-full p-3 text-left rounded-lg flex items-center justify-between transition-colors"
                      style={{
                        backgroundColor: isSelected ? 'var(--accelerant-blue-light)' : 'transparent',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <span 
                        className="text-sm"
                        style={{ color: isSelected ? 'var(--accelerant-blue)' : 'var(--slate-600)' }}
                      >
                        {model.display_name}
                      </span>
                      {isSelected && (
                        <Check className="h-4 w-4" style={{ color: 'var(--accelerant-blue)' }} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderOpenAIModels = () => {
    if (isOpenAILoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--slate-400)' }} />
          <span className="ml-2 text-sm" style={{ color: 'var(--slate-500)' }}>Loading OpenAI models...</span>
        </div>
      );
    }

    if (openaiError) {
      return (
        <div
          className="p-4 rounded-xl"
          style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}
        >
          <div className="flex items-center mb-2">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-red-700 font-medium">Unable to load OpenAI models</span>
          </div>
          <p className="text-sm text-red-600">Please check your connection and try again.</p>
        </div>
      );
    }

    if (!openaiData?.is_configured) {
      return (
        <div
          className="p-4 rounded-xl text-center"
          style={{ backgroundColor: 'var(--slate-50)', border: '1px solid var(--slate-200)' }}
        >
          <p style={{ color: 'var(--slate-600)' }}>OpenAI API key not configured</p>
          <p className="text-sm mt-1" style={{ color: 'var(--slate-500)' }}>Add OPENAI_API_KEY to use OpenAI models</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {openaiData.featured_models.map((model: OpenAIModel) => {
          const isSelected = selectedModel === model.id;
          return (
            <button
              key={model.id}
              onClick={() => handleModelSelect(model.id, 'openai')}
              disabled={disabled}
              className="w-full p-4 text-left rounded-xl transition-all"
              style={{
                border: `1px solid ${isSelected ? 'var(--accelerant-blue)' : 'var(--slate-200)'}`,
                backgroundColor: isSelected ? 'var(--accelerant-blue-light)' : 'white',
                boxShadow: isSelected ? '0 0 0 2px var(--accelerant-blue-border)' : 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center">
                    <span className="font-medium" style={{ color: 'var(--slate-900)' }}>
                      {model.display_name}
                    </span>
                    {model.family === 'gpt-4o' && (
                      <span
                        className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: 'var(--accelerant-blue-light)',
                          color: 'var(--accelerant-blue)'
                        }}
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--slate-500)' }}>
                    {model.description}
                  </p>
                </div>
                {isSelected && (
                  <Check className="h-5 w-5" style={{ color: 'var(--accelerant-blue)' }} />
                )}
              </div>
            </button>
          );
        })}

        {openaiData.other_models.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowMoreOpenAIModels(!showMoreOpenAIModels)}
              className="w-full p-3 text-left rounded-lg flex items-center justify-between transition-colors hover:bg-slate-50"
              style={{
                border: '1px solid var(--slate-200)',
                color: 'var(--slate-600)'
              }}
            >
              <span className="text-sm font-medium">More models</span>
              {showMoreOpenAIModels ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {showMoreOpenAIModels && (
              <div className="mt-2 space-y-1 pl-2 border-l-2" style={{ borderColor: 'var(--slate-200)' }}>
                {openaiData.other_models.map((model: OpenAIModel) => {
                  const isSelected = selectedModel === model.id;
                  return (
                    <button
                      key={model.id}
                      onClick={() => handleModelSelect(model.id, 'openai')}
                      disabled={disabled}
                      className="w-full p-3 text-left rounded-lg flex items-center justify-between transition-colors"
                      style={{
                        backgroundColor: isSelected ? 'var(--accelerant-blue-light)' : 'transparent',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <span
                        className="text-sm"
                        style={{ color: isSelected ? 'var(--accelerant-blue)' : 'var(--slate-600)' }}
                      >
                        {model.display_name}
                      </span>
                      {isSelected && (
                        <Check className="h-4 w-4" style={{ color: 'var(--accelerant-blue)' }} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderLegacyModels = () => {
    const models = pickerData?.models?.[selectedProvider as keyof typeof pickerData.models] ?? [];
    
    return (
      <div className="space-y-2">
        {models.map((model: ExtractionModel) => {
          const isSelected = selectedModel === model.model_name;
          return (
            <button
              key={model.model_name}
              onClick={() => handleLegacyModelSelect(model)}
              disabled={!model.is_configured || disabled}
              className="w-full p-4 text-left rounded-xl transition-all"
              style={{
                border: `1px solid ${isSelected ? 'var(--accelerant-blue)' : 'var(--slate-200)'}`,
                backgroundColor: isSelected ? 'var(--accelerant-blue-light)' : 'white',
                boxShadow: isSelected ? '0 0 0 2px var(--accelerant-blue-border)' : 'none',
                opacity: !model.is_configured ? 0.5 : 1,
                cursor: !model.is_configured || disabled ? 'not-allowed' : 'pointer',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div
                    className="w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center"
                    style={{
                      borderColor: isSelected ? 'var(--accelerant-blue)' : 'var(--slate-300)',
                      backgroundColor: isSelected ? 'var(--accelerant-blue)' : 'transparent',
                    }}
                  >
                    {isSelected && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center">
                      <span className="font-medium" style={{ color: 'var(--slate-900)' }}>
                        {model.display_name}
                      </span>
                      {model.is_default && (
                        <span 
                          className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                          style={{ 
                            backgroundColor: 'var(--accelerant-blue-light)',
                            color: 'var(--accelerant-blue)'
                          }}
                        >
                          <Sparkles className="h-3 w-3 mr-1" />
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--slate-500)' }}>
                      {model.description}
                    </p>
                  </div>
                </div>
                {!model.is_configured && (
                  <span 
                    className="text-xs px-2 py-1 rounded"
                    style={{ backgroundColor: 'var(--slate-100)', color: 'var(--slate-500)' }}
                  >
                    API key required
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {renderSettingsModal()}
      <div className="space-y-4">
        <div
          className="flex border-b"
          style={{ borderColor: 'var(--slate-200)' }}
        >
          {providers.map((provider) => {
            const isConfigured = pickerData?.configured_providers?.includes(provider) ?? false;
            const isActive = selectedProvider === provider;
            const showGear = (provider === 'anthropic' || provider === 'openai') && isConfigured && isActive;

            return (
              <button
                key={provider}
                onClick={() => handleProviderChange(provider)}
                disabled={disabled}
                className="flex-1 px-2 py-2 text-center border-b-2 transition-colors"
                style={{
                  borderColor: isActive ? 'var(--accelerant-blue)' : 'transparent',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
              >
                <span
                  className="text-sm font-medium inline-flex items-center justify-center gap-1.5"
                  style={{
                    color: isActive ? 'var(--accelerant-blue)' : 'var(--slate-600)',
                    opacity: !isConfigured ? 0.6 : 1,
                  }}
                >
                  {providerLabels[provider]}
                  {showGear && (
                    <Settings
                      className="h-3.5 w-3.5 cursor-pointer hover:opacity-70 transition-opacity"
                      style={{ color: 'var(--slate-400)' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openSettings(provider as 'anthropic' | 'openai', e);
                      }}
                    />
                  )}
                </span>
                {!isConfigured && (
                  <span
                    className="text-xs block mt-0.5"
                    style={{ color: 'var(--slate-400)' }}
                  >
                    (not configured)
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {selectedProvider === 'anthropic'
          ? renderAnthropicModels()
          : selectedProvider === 'openai'
            ? renderOpenAIModels()
            : renderLegacyModels()}
      </div>
    </>
  );
}
