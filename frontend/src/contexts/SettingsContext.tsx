import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type MappingModelProvider = 'anthropic' | 'openai' | 'landingai';

export interface Settings {
  autoMapping: boolean;
  mappingModelProvider: MappingModelProvider;
}

const defaultSettings: Settings = {
  autoMapping: false,
  mappingModelProvider: 'anthropic',
};

const STORAGE_KEY = 'product-intelligence-settings';

interface SettingsContextType {
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    // Load from localStorage on initial render
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...defaultSettings, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Failed to load settings from localStorage:', e);
    }
    return defaultSettings;
  });

  // Persist to localStorage whenever settings change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings to localStorage:', e);
    }
  }, [settings]);

  const updateSettings = (updates: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
