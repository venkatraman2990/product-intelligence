import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle, Sparkles, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { modelsApi, type AnthropicModel, type OpenAIModel } from '../../api/client';
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

export default function ModelPicker({ onSelect, disabled = false, initialModel = null }: ModelPickerProps) {
  const [selectedProvider, setSelectedProvider] = useState<string>(initialModel?.provider || 'anthropic');
  const [selectedModel, setSelectedModel] = useState<string | null>(initialModel?.model || null);
  const [showMoreModels, setShowMoreModels] = useState(false);
  const [showMoreOpenAIModels, setShowMoreOpenAIModels] = useState(false);

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
    <div className="space-y-4">
      <div 
        className="flex border-b"
        style={{ borderColor: 'var(--slate-200)' }}
      >
        {providers.map((provider) => {
          const isConfigured = pickerData?.configured_providers?.includes(provider) ?? false;
          const isActive = selectedProvider === provider;

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
                className="text-sm font-medium block"
                style={{ 
                  color: isActive ? 'var(--accelerant-blue)' : 'var(--slate-600)',
                  opacity: !isConfigured ? 0.6 : 1,
                }}
              >
                {providerLabels[provider]}
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
  );
}
