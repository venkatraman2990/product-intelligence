import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { modelsApi } from '../../api/client';
import type { ExtractionModel } from '../../types';

interface ModelPickerProps {
  onSelect: (provider: string, model: string) => void;
  disabled?: boolean;
}

const providerLabels: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  landing_ai: 'Landing AI',
};

export default function ModelPicker({ onSelect, disabled = false }: ModelPickerProps) {
  const [selectedProvider, setSelectedProvider] = useState<string>('anthropic');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['models'],
    queryFn: modelsApi.getAll,
  });

  useEffect(() => {
    if (data) {
      const providerModels = data.models[selectedProvider as keyof typeof data.models] || [];
      const defaultModel = providerModels.find((m: ExtractionModel) => m.is_default && m.is_configured);
      const configuredModel = providerModels.find((m: ExtractionModel) => m.is_configured);

      if (defaultModel) {
        setSelectedModel(defaultModel.model_name);
        onSelect(selectedProvider, defaultModel.model_name);
      } else if (configuredModel) {
        setSelectedModel(configuredModel.model_name);
        onSelect(selectedProvider, configuredModel.model_name);
      }
    }
  }, [data, selectedProvider, onSelect]);

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    setSelectedModel(null);
  };

  const handleModelSelect = (model: ExtractionModel) => {
    if (!model.is_configured || disabled) return;
    setSelectedModel(model.model_name);
    onSelect(selectedProvider, model.model_name);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--slate-400)' }} />
        <span className="ml-2" style={{ color: 'var(--slate-500)' }}>Loading models...</span>
      </div>
    );
  }

  if (error) {
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

  return (
    <div className="space-y-4">
      <div 
        className="flex space-x-2 border-b"
        style={{ borderColor: 'var(--slate-200)' }}
      >
        {providers.map((provider) => {
          const isConfigured = data?.configured_providers?.includes(provider) ?? false;
          const isActive = selectedProvider === provider;

          return (
            <button
              key={provider}
              onClick={() => handleProviderChange(provider)}
              disabled={disabled}
              className="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
              style={{
                borderColor: isActive ? 'var(--accelerant-blue)' : 'transparent',
                color: isActive ? 'var(--accelerant-blue)' : 'var(--slate-500)',
                opacity: !isConfigured ? 0.5 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {providerLabels[provider]}
              {!isConfigured && (
                <span className="ml-1 text-xs" style={{ color: 'var(--slate-400)' }}>(not configured)</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {data?.models[selectedProvider as keyof typeof data.models]?.map((model: ExtractionModel) => {
          const isSelected = selectedModel === model.model_name;
          return (
            <button
              key={model.model_name}
              onClick={() => handleModelSelect(model)}
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
    </div>
  );
}
