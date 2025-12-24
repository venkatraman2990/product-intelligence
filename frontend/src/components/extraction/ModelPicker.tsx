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

const providerColors: Record<string, string> = {
  anthropic: 'bg-orange-100 text-orange-800 border-orange-200',
  openai: 'bg-green-100 text-green-800 border-green-200',
  landing_ai: 'bg-blue-100 text-blue-800 border-blue-200',
};

export default function ModelPicker({ onSelect, disabled = false }: ModelPickerProps) {
  const [selectedProvider, setSelectedProvider] = useState<string>('anthropic');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['models'],
    queryFn: modelsApi.getAll,
  });

  // Auto-select default model when data loads
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
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading models...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
        <AlertCircle className="h-5 w-5 mr-2" />
        <span>Failed to load models</span>
      </div>
    );
  }

  const providers = ['anthropic', 'openai', 'landing_ai'];

  return (
    <div className="space-y-4">
      {/* Provider tabs */}
      <div className="flex space-x-2 border-b border-gray-200">
        {providers.map((provider) => {
          const isConfigured = data?.configured_providers.includes(provider);
          const isActive = selectedProvider === provider;

          return (
            <button
              key={provider}
              onClick={() => handleProviderChange(provider)}
              disabled={disabled}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } ${!isConfigured ? 'opacity-50' : ''} ${disabled ? 'cursor-not-allowed' : ''}`}
            >
              {providerLabels[provider]}
              {!isConfigured && (
                <span className="ml-1 text-xs text-gray-400">(not configured)</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Model list */}
      <div className="space-y-2">
        {data?.models[selectedProvider as keyof typeof data.models]?.map((model: ExtractionModel) => (
          <button
            key={model.model_name}
            onClick={() => handleModelSelect(model)}
            disabled={!model.is_configured || disabled}
            className={`w-full p-4 text-left border rounded-lg transition-all ${
              selectedModel === model.model_name
                ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                : model.is_configured
                ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div
                  className={`w-4 h-4 rounded-full border-2 mr-3 ${
                    selectedModel === model.model_name
                      ? 'border-indigo-500 bg-indigo-500'
                      : 'border-gray-300'
                  }`}
                >
                  {selectedModel === model.model_name && (
                    <div className="w-full h-full rounded-full bg-white scale-50" />
                  )}
                </div>
                <div>
                  <div className="flex items-center">
                    <span className="font-medium text-gray-900">{model.display_name}</span>
                    {model.is_default && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{model.description}</p>
                </div>
              </div>
              {!model.is_configured && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                  API key required
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
