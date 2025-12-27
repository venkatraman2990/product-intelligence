import { Settings, Cpu } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import type { MappingModelProvider } from '../contexts/SettingsContext';

const modelProviders: { value: MappingModelProvider; label: string; description: string }[] = [
  { value: 'anthropic', label: 'Anthropic (Claude)', description: 'Claude AI models for intelligent mapping' },
  { value: 'openai', label: 'OpenAI (GPT)', description: 'GPT models for mapping suggestions' },
  { value: 'landingai', label: 'LandingAI', description: 'LandingAI for document understanding' },
];

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-description mt-1">Configure application preferences</p>
      </div>

      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: 'var(--accelerant-blue-light)' }}
          >
            <Settings className="h-5 w-5" style={{ color: 'var(--accelerant-blue)' }} />
          </div>
          <h2 className="section-header">Term Mapping</h2>
        </div>

        <div className="space-y-4">
          {/* Auto-approve toggle */}
          <div
            className="flex items-center justify-between p-4 rounded-lg border"
            style={{ borderColor: 'var(--slate-200)', backgroundColor: 'var(--slate-50)' }}
          >
            <div>
              <p className="font-medium" style={{ color: 'var(--slate-900)' }}>
                Auto-approve Mappings
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--slate-500)' }}>
                Automatically approve AI-suggested mappings without manual confirmation
              </p>
            </div>
            <button
              onClick={() => updateSettings({ autoMapping: !settings.autoMapping })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.autoMapping ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
              role="switch"
              aria-checked={settings.autoMapping}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.autoMapping ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Model provider selection */}
          <div
            className="p-4 rounded-lg border"
            style={{ borderColor: 'var(--slate-200)', backgroundColor: 'var(--slate-50)' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="h-4 w-4" style={{ color: 'var(--slate-600)' }} />
              <p className="font-medium" style={{ color: 'var(--slate-900)' }}>
                AI Model Provider
              </p>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--slate-500)' }}>
              Select the AI provider for generating mapping suggestions
            </p>
            <div className="space-y-2">
              {modelProviders.map((provider) => (
                <label
                  key={provider.value}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                    settings.mappingModelProvider === provider.value
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="modelProvider"
                    value={provider.value}
                    checked={settings.mappingModelProvider === provider.value}
                    onChange={(e) => updateSettings({ mappingModelProvider: e.target.value as MappingModelProvider })}
                    className="sr-only"
                  />
                  <div
                    className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                      settings.mappingModelProvider === provider.value
                        ? 'border-blue-500'
                        : 'border-slate-300'
                    }`}
                  >
                    {settings.mappingModelProvider === provider.value && (
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm" style={{ color: 'var(--slate-900)' }}>
                      {provider.label}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--slate-500)' }}>
                      {provider.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        className="text-sm p-4 rounded-lg"
        style={{ backgroundColor: 'var(--slate-100)', color: 'var(--slate-600)' }}
      >
        Settings are automatically saved to your browser and will persist across sessions.
      </div>
    </div>
  );
}
